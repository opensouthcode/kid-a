import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getStore, type Store as NetlifyBlobStore } from '@netlify/blobs';
import type { UserRole } from './types.js';

export type MagicLinkTokenRecord = {
  activityId?: number;
  createdAt: string;
  expiresAt: string;
  role: UserRole;
  tokenHash: string;
};

export type MagicLinkSession = Omit<MagicLinkTokenRecord, 'tokenHash'>;

export type CreatedMagicLink = MagicLinkSession & {
  token: string;
};

export type MagicLinkScope = {
  activityId?: number;
  role: UserRole;
};

export type MagicLinkTokenStore = {
  readTokens(): Promise<MagicLinkTokenRecord[]>;
  writeTokens(tokens: MagicLinkTokenRecord[]): Promise<void>;
};

const defaultBlobStoreName = 'kid-a-data';
const magicTokensBlobKey = 'admin/magic-tokens.json';
const defaultMagicTokensFile = path.resolve(
  process.env.KID_A_MAGIC_TOKENS_FILE ??
    path.join(process.env.KID_A_DATA_DIR ?? 'server/data', 'magicTokens.json'),
);

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isActiveToken(token: MagicLinkTokenRecord, now = Date.now()) {
  return new Date(token.expiresAt).getTime() > now;
}

function toSession(token: MagicLinkTokenRecord): MagicLinkSession {
  return {
    ...(token.activityId ? { activityId: token.activityId } : {}),
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    role: token.role,
  };
}

export function createFileMagicTokenStore(filePath = defaultMagicTokensFile) {
  return {
    async readTokens() {
      try {
        return JSON.parse(await readFile(filePath, 'utf8')) as MagicLinkTokenRecord[];
      } catch (error) {
        if (isMissingFileError(error)) {
          return [];
        }

        throw error;
      }
    },
    async writeTokens(tokens: MagicLinkTokenRecord[]) {
      await mkdir(path.dirname(filePath), { recursive: true });

      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(tokens, null, 2)}\n`);
      await rename(tempPath, filePath);
    },
  } satisfies MagicLinkTokenStore;
}

export function createBlobMagicTokenStore(
  store: NetlifyBlobStore = getStore(
    process.env.KID_A_BLOBS_STORE ?? defaultBlobStoreName,
  ),
) {
  return {
    async readTokens() {
      const tokens = (await store.get(magicTokensBlobKey, {
        type: 'json',
      })) as MagicLinkTokenRecord[] | null;

      if (tokens) {
        return tokens;
      }

      await store.setJSON(magicTokensBlobKey, [], { onlyIfNew: true });
      return [];
    },
    async writeTokens(tokens: MagicLinkTokenRecord[]) {
      await store.setJSON(magicTokensBlobKey, tokens);
    },
  } satisfies MagicLinkTokenStore;
}

let activeMagicTokenStore: MagicLinkTokenStore = createFileMagicTokenStore();
let writeQueue: Promise<void> = Promise.resolve();

export function setMagicTokenStore(store: MagicLinkTokenStore) {
  activeMagicTokenStore = store;
  writeQueue = Promise.resolve();
}

async function updateMagicTokens<T>(
  mutator: (tokens: MagicLinkTokenRecord[]) => T | Promise<T>,
) {
  const nextWrite = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const activeTokens = (await activeMagicTokenStore.readTokens()).filter(
        isActiveToken,
      );
      const result = await mutator(activeTokens);

      await activeMagicTokenStore.writeTokens(activeTokens);

      return result;
    });

  writeQueue = nextWrite.then(
    () => undefined,
    () => undefined,
  );

  return nextWrite;
}

export async function createMagicLinkToken(
  scope: MagicLinkScope,
  durationMilliseconds: number,
): Promise<CreatedMagicLink> {
  const token = randomBytes(24).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + durationMilliseconds).toISOString();
  const record: MagicLinkTokenRecord = {
    ...(scope.activityId ? { activityId: scope.activityId } : {}),
    createdAt: createdAt.toISOString(),
    expiresAt,
    role: scope.role,
    tokenHash: hashToken(token),
  };

  await updateMagicTokens((tokens) => {
    tokens.push(record);
  });

  return {
    ...toSession(record),
    token,
  };
}

export async function validateMagicLinkToken(
  rawToken: string,
): Promise<MagicLinkSession | undefined> {
  const token = rawToken.trim();

  if (!token) {
    return undefined;
  }

  const tokenHash = hashToken(token);
  const records = await activeMagicTokenStore.readTokens();
  const record = records.find(
    (entry) => isActiveToken(entry) && constantTimeEquals(entry.tokenHash, tokenHash),
  );

  return record ? toSession(record) : undefined;
}
