import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getStore, type Store as NetlifyBlobStore } from '@netlify/blobs';
import {
  getStoreFileName,
  runAwardPrizeCommand,
  runCompletePassportActivityCommand,
  runRegisterKidCommand,
  runRestoreWritableDataCommand,
  runSavePrizeCommand,
  type StoreAdapter,
  type StoreFile,
} from './store.js';
import type {
  ConferenceData,
  Kid,
  PassportActivitiesByKid,
  PassportActivity,
  Prize,
  PrizeAward,
  StoreData,
} from './types.js';

const defaultBlobStoreName = 'kid-a-data';
const passportPrefix = 'passports/';
const prizeAwardsPrefix = 'prizes-kid/';
const seedMarkerKey = 'seeded-v1.json';
const jsonDocumentKeys = {
  conference: 'conference.json',
  kids: 'kids.json',
  prizeAwards: 'prizes-won.json',
  prizes: 'wheel-prizes.json',
} as const satisfies Partial<Record<StoreFile, string>>;

function getSeedDataDirs() {
  if (process.env.KID_A_SEED_DATA_DIR) {
    return [path.resolve(process.env.KID_A_SEED_DATA_DIR)];
  }

  const runtimeRoots = [process.cwd(), process.env.LAMBDA_TASK_ROOT].filter(
    (runtimeRoot): runtimeRoot is string => Boolean(runtimeRoot),
  );

  return Array.from(
    new Set(
      runtimeRoots.flatMap((runtimeRoot) => [
        path.resolve(runtimeRoot, 'server/data'),
        path.resolve(runtimeRoot, 'src/data'),
      ]),
    ),
  );
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function readSeedJson<T>(fileName: string): Promise<T> {
  const attemptedPaths: string[] = [];

  for (const seedDataDir of getSeedDataDirs()) {
    const seedPath = path.join(seedDataDir, fileName);
    attemptedPaths.push(seedPath);

    try {
      return JSON.parse(await readFile(seedPath, 'utf8')) as T;
    } catch (error) {
      if (isMissingFileError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Missing seed data file ${fileName}; checked ${attemptedPaths.join(', ')}`,
  );
}

function passportKey(kidId: string) {
  return `${passportPrefix}${kidId}.json`;
}

function kidIdFromPassportKey(key: string) {
  return key.slice(passportPrefix.length, -'.json'.length);
}

function prizeAwardsKey(kidId: string) {
  return `${prizeAwardsPrefix}${kidId}.json`;
}

function kidIdFromPrizeAwardsKey(key: string) {
  return key.slice(prizeAwardsPrefix.length, -'.json'.length);
}

async function readRequiredBlobJson<T>(store: NetlifyBlobStore, key: string) {
  const value = (await store.get(key, {
    type: 'json',
  })) as T | null;

  if (value === null) {
    throw new Error(`Missing Netlify Blob document after seed: ${key}`);
  }

  return value;
}

function groupPrizeAwardsByKid(prizeAwards: PrizeAward[]) {
  return prizeAwards.reduce<Record<string, PrizeAward[]>>((groups, award) => {
    const group = groups[award.kidId] ?? [];
    group.push(award);
    groups[award.kidId] = group;
    return groups;
  }, {});
}

function dedupePrizeAwards(prizeAwards: PrizeAward[]) {
  return Array.from(
    new Map(prizeAwards.map((award) => [award.id, award])).values(),
  );
}

async function writeStoreFile(
  store: NetlifyBlobStore,
  storeFile: StoreFile,
  snapshot: StoreData,
) {
  if (storeFile === 'passportActivitiesByKid') {
    const expectedKeys = new Set(
      Object.keys(snapshot.passportActivitiesByKid).map(passportKey),
    );
    const existingKeys: string[] = [];

    for await (const passportList of store.list({
      paginate: true,
      prefix: passportPrefix,
    })) {
      existingKeys.push(...passportList.blobs.map(({ key }) => key));
    }

    await Promise.all(
      [
        ...existingKeys
          .filter((key) => !expectedKeys.has(key))
          .map((key) => store.delete(key)),
        ...Object.entries(snapshot.passportActivitiesByKid).map(([kidId, passport]) =>
          store.setJSON(passportKey(kidId), passport),
        ),
      ],
    );
    return;
  }

  if (storeFile === 'prizeAwards') {
    await Promise.all([
      store.setJSON(jsonDocumentKeys.prizeAwards, snapshot.prizeAwards),
      ...Object.entries(groupPrizeAwardsByKid(snapshot.prizeAwards)).map(
        ([kidId, awards]) => store.setJSON(prizeAwardsKey(kidId), awards),
      ),
    ]);
    return;
  }

  await store.setJSON(jsonDocumentKeys[storeFile], snapshot[storeFile]);
}

async function readSeedSnapshot(): Promise<StoreData> {
  const [conference, kids, passportActivitiesByKid, prizeAwards, prizes] =
    await Promise.all([
      readSeedJson<ConferenceData>(getStoreFileName('conference')),
      readSeedJson<Kid[]>(getStoreFileName('kids')),
      readSeedJson<PassportActivitiesByKid>(
        getStoreFileName('passportActivitiesByKid'),
      ),
      readSeedJson<PrizeAward[]>(getStoreFileName('prizeAwards')),
      readSeedJson<Prize[]>(getStoreFileName('prizes')),
    ]);

  return {
    conference,
    kids,
    passportActivitiesByKid,
    prizeAwards,
    prizes,
  };
}

export function createBlobStore(
  store = getStore(process.env.KID_A_BLOBS_STORE ?? defaultBlobStoreName),
): StoreAdapter {
  let seedPromise: Promise<void> | undefined;
  let writeQueue: Promise<void> = Promise.resolve();

  async function ensureSeeded() {
    seedPromise ??= (async () => {
      const seedMarker = await store.getMetadata(seedMarkerKey);

      if (seedMarker) {
        return;
      }

      const seedSnapshot = await readSeedSnapshot();

      await store.setJSON(jsonDocumentKeys.conference, seedSnapshot.conference);
      await store.setJSON(jsonDocumentKeys.kids, seedSnapshot.kids);
      await store.setJSON(jsonDocumentKeys.prizeAwards, seedSnapshot.prizeAwards);
      await store.setJSON(jsonDocumentKeys.prizes, seedSnapshot.prizes);

      await Promise.all(
        Object.entries(groupPrizeAwardsByKid(seedSnapshot.prizeAwards)).map(
          ([kidId, awards]) =>
            store.setJSON(prizeAwardsKey(kidId), awards, { onlyIfNew: true }),
        ),
      );

      for (const [kidId, passport] of Object.entries(
        seedSnapshot.passportActivitiesByKid,
      )) {
        await store.setJSON(passportKey(kidId), passport);
      }

      await store.setJSON(
        seedMarkerKey,
        { seededAt: new Date().toISOString(), version: 1 },
        { onlyIfNew: true },
      );
    })();

    return seedPromise;
  }

  async function readPassportActivitiesByKid() {
    const passportEntries: Array<readonly [string, PassportActivity[]]> = [];

    for await (const passportList of store.list({
      paginate: true,
      prefix: passportPrefix,
    })) {
      passportEntries.push(
        ...(await Promise.all(
          passportList.blobs.map(async ({ key }) => {
            const passport = await readRequiredBlobJson<PassportActivity[]>(store, key);
            return [kidIdFromPassportKey(key), passport] as const;
          }),
        )),
      );
    }

    return Object.fromEntries(passportEntries) as PassportActivitiesByKid;
  }

  async function readPrizeAwards() {
    const [legacyPrizeAwards, prizeAwardsByKid] = await Promise.all([
      readRequiredBlobJson<PrizeAward[]>(store, jsonDocumentKeys.prizeAwards),
      (async () => {
        const awardEntries: PrizeAward[] = [];

        for await (const prizeAwardsList of store.list({
          paginate: true,
          prefix: prizeAwardsPrefix,
        })) {
          awardEntries.push(
            ...(await Promise.all(
              prizeAwardsList.blobs.map(async ({ key }) => {
                const awards = await readRequiredBlobJson<PrizeAward[]>(store, key);
                return awards.map((award) => ({
                  ...award,
                  kidId: kidIdFromPrizeAwardsKey(key),
                }));
              }),
            )).flat(),
          );
        }

        return awardEntries;
      })(),
    ]);

    return dedupePrizeAwards([...legacyPrizeAwards, ...prizeAwardsByKid]);
  }

  async function readSnapshotUnlocked(): Promise<StoreData> {
    await ensureSeeded();

    const [conference, kids, passportActivitiesByKid, prizeAwards, prizes] =
      await Promise.all([
        readRequiredBlobJson<ConferenceData>(store, jsonDocumentKeys.conference),
        readRequiredBlobJson<Kid[]>(store, jsonDocumentKeys.kids),
        readPassportActivitiesByKid(),
        readPrizeAwards(),
        readRequiredBlobJson<Prize[]>(store, jsonDocumentKeys.prizes),
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
          changedFiles.map((storeFile) => writeStoreFile(store, storeFile, snapshot)),
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
    const previousWrite = writeQueue;
    const nextWrite = previousWrite
      .catch(() => undefined)
      .then(async () => {
        const snapshot = await readSnapshotUnlocked();
        const result = await mutator(snapshot);
        const passport = snapshot.passportActivitiesByKid[kidId];

        if (!passport) {
          throw new Error(`Passport update did not produce a passport for ${kidId}`);
        }

        await store.setJSON(passportKey(kidId), passport);

        return result;
      });

    writeQueue = nextWrite.then(
      () => undefined,
      () => undefined,
    );

    return nextWrite;
  }

  async function updatePrizeAwardsForKid<T>(
    kidId: string,
    mutator: (snapshot: StoreData) => T | Promise<T>,
  ) {
    const previousWrite = writeQueue;
    const nextWrite = previousWrite
      .catch(() => undefined)
      .then(async () => {
        const snapshot = await readSnapshotUnlocked();
        const result = await mutator(snapshot);
        const awards = snapshot.prizeAwards.filter((award) => award.kidId === kidId);

        await store.setJSON(prizeAwardsKey(kidId), awards);

        return result;
      });

    writeQueue = nextWrite.then(
      () => undefined,
      () => undefined,
    );

    return nextWrite;
  }

  return {
    awardPrize: (command) => runAwardPrizeCommand(command, updatePrizeAwardsForKid),
    completePassportActivity: (command) =>
      runCompletePassportActivityCommand(command, updatePassportForKid),
    readSnapshot,
    registerKid: (command) => runRegisterKidCommand(command, updateSnapshot),
    restoreWritableData: (data) => runRestoreWritableDataCommand(data, updateSnapshot),
    savePrize: (command) => runSavePrizeCommand(command, updateSnapshot),
    updatePassportForKid,
    updatePrizeAwardsForKid,
    updateSnapshot,
  };
}
