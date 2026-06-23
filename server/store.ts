import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ConferenceData,
  Kid,
  PassportActivitiesByKid,
  Prize,
  PrizeAward,
  StoreData,
} from './types.js';

export type StoreFile = keyof typeof storeFiles;

export type StoreAdapter = {
  readSnapshot(): Promise<StoreData>;
  updatePassportForKid<T>(
    kidId: string,
    mutator: (snapshot: StoreData) => T | Promise<T>,
  ): Promise<T>;
  updatePrizeAwardsForKid<T>(
    kidId: string,
    mutator: (snapshot: StoreData) => T | Promise<T>,
  ): Promise<T>;
  updateSnapshot<T>(
    mutator: (snapshot: StoreData) => T | Promise<T>,
    changedFiles: readonly StoreFile[],
  ): Promise<T>;
};

const storeFiles = {
  conference: 'conference.json',
  kids: 'kids.json',
  passportActivitiesByKid: 'passportActivities.json',
  prizeAwards: 'prizeAwards.json',
  prizes: 'prizes.json',
} as const;

const defaultDataDir = path.resolve(process.env.KID_A_DATA_DIR ?? 'server/data');
const seedDataDir = path.resolve(process.env.KID_A_SEED_DATA_DIR ?? 'src/data');

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getStoreFileName(storeFile: StoreFile) {
  return storeFiles[storeFile];
}

export function createFileStore(): StoreAdapter {
  let seedPromise: Promise<void> | undefined;
  let writeQueue: Promise<void> = Promise.resolve();

  function getStorePath(storeFile: StoreFile) {
    return path.join(defaultDataDir, storeFiles[storeFile]);
  }

  async function ensureDataFiles() {
    seedPromise ??= (async () => {
      await mkdir(defaultDataDir, { recursive: true });

      await Promise.all(
        Object.entries(storeFiles).map(async ([storeFile, fileName]) => {
          const targetPath = getStorePath(storeFile as StoreFile);

          if (await pathExists(targetPath)) {
            return;
          }

          await copyFile(path.join(seedDataDir, fileName), targetPath);
        }),
      );
    })();

    return seedPromise;
  }

  async function readJson<T>(storeFile: StoreFile): Promise<T> {
    return JSON.parse(await readFile(getStorePath(storeFile), 'utf8')) as T;
  }

  async function writeJson(storeFile: StoreFile, value: unknown) {
    const targetPath = getStorePath(storeFile);
    const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;

    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
    await rename(tempPath, targetPath);
  }

  async function readSnapshotUnlocked(): Promise<StoreData> {
    await ensureDataFiles();

    const [conference, kids, passportActivitiesByKid, prizeAwards, prizes] =
      await Promise.all([
        readJson<ConferenceData>('conference'),
        readJson<Kid[]>('kids'),
        readJson<PassportActivitiesByKid>('passportActivitiesByKid'),
        readJson<PrizeAward[]>('prizeAwards'),
        readJson<Prize[]>('prizes'),
      ]);

    return {
      conference,
      kids,
      passportActivitiesByKid,
      prizeAwards,
      prizes,
    };
  }

  async function readSnapshot() {
    await writeQueue.catch(() => undefined);
    return readSnapshotUnlocked();
  }

  async function updateSnapshot<T>(
    mutator: (snapshot: StoreData) => T | Promise<T>,
    changedFiles: readonly StoreFile[],
  ) {
    const previousWrite = writeQueue;
    const nextWrite = previousWrite
      .catch(() => undefined)
      .then(async () => {
        const snapshot = await readSnapshotUnlocked();
        const result = await mutator(snapshot);

        await Promise.all(
          changedFiles.map((storeFile) => writeJson(storeFile, snapshot[storeFile])),
        );

        return result;
      });

    writeQueue = nextWrite.then(
      () => undefined,
      () => undefined,
    );

    return nextWrite;
  }

  async function updatePassportForKid<T>(
    kidId: string,
    mutator: (snapshot: StoreData) => T | Promise<T>,
  ) {
    void kidId;
    return updateSnapshot(mutator, ['passportActivitiesByKid']);
  }

  async function updatePrizeAwardsForKid<T>(
    kidId: string,
    mutator: (snapshot: StoreData) => T | Promise<T>,
  ) {
    void kidId;
    return updateSnapshot(mutator, ['prizeAwards']);
  }

  return {
    readSnapshot,
    updatePassportForKid,
    updatePrizeAwardsForKid,
    updateSnapshot,
  };
}

let activeStore = createFileStore();

export function setStoreAdapter(store: StoreAdapter) {
  activeStore = store;
}

export async function readSnapshot() {
  return activeStore.readSnapshot();
}

export async function updateSnapshot<T>(
  mutator: (snapshot: StoreData) => T | Promise<T>,
  changedFiles: readonly StoreFile[],
) {
  return activeStore.updateSnapshot(mutator, changedFiles);
}

export async function updatePassportForKid<T>(
  kidId: string,
  mutator: (snapshot: StoreData) => T | Promise<T>,
) {
  return activeStore.updatePassportForKid(kidId, mutator);
}

export async function updatePrizeAwardsForKid<T>(
  kidId: string,
  mutator: (snapshot: StoreData) => T | Promise<T>,
) {
  return activeStore.updatePrizeAwardsForKid(kidId, mutator);
}
