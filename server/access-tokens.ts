import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
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
  appendToken(token: MagicLinkTokenRecord): Promise<void>;
  readTokens(): Promise<MagicLinkTokenRecord[]>;
  writeTokens(tokens: MagicLinkTokenRecord[]): Promise<void>;
};

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

let activeMagicTokenStore: MagicLinkTokenStore | undefined;

export function setMagicTokenStore(store: MagicLinkTokenStore) {
  activeMagicTokenStore = store;
}

function requireMagicTokenStore() {
  if (!activeMagicTokenStore) {
    throw new Error('Magic token store has not been configured');
  }

  return activeMagicTokenStore;
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

  await requireMagicTokenStore().appendToken(record);

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
  const records = await requireMagicTokenStore().readTokens();
  const record = records.find(
    (entry) => isActiveToken(entry) && constantTimeEquals(entry.tokenHash, tokenHash),
  );

  return record ? toSession(record) : undefined;
}
