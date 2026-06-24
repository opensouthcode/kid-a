import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ConferenceData,
  Kid,
  PassportActivitiesByKid,
  PassportActivity,
  Prize,
  PrizeAward,
  StoreData,
} from './types.js';

export type StoreFile = keyof typeof storeFiles;

export type RegisterKidCommand = {
  age: number;
  gender: string;
  language: string;
  lastKnownKidId?: string;
  name: string;
};

export type CompletePassportActivityCommand = {
  activityId: number;
  completedAt: string;
  kidId: string;
};

export type SavePrizeCommand =
  | {
      initialUnits: number;
      title: string;
      type: 'create';
    }
  | {
      initialUnits?: number;
      prizeId: string;
      prizeKind?: Prize['kind'];
      title?: string;
      type: 'update';
    };

export type PrizeMutationResult = {
  prize?: Prize;
  prizeAwards: PrizeAward[];
  prizes: Prize[];
};

export type AwardPrizeCommand = {
  awardId: string;
  awardedAt: string;
  kidId: string;
  prizeId: string;
  source?: PrizeAward['source'];
};

export type WritableStoreData = Pick<
  StoreData,
  'passportActivitiesByKid' | 'prizeAwards' | 'prizes'
>;

export type StoreAdapter = {
  awardPrize(command: AwardPrizeCommand): Promise<PrizeAward[]>;
  completePassportActivity(
    command: CompletePassportActivityCommand,
  ): Promise<PassportActivity[]>;
  readSnapshot(): Promise<StoreData>;
  registerKid(command: RegisterKidCommand): Promise<Kid>;
  restoreWritableData(data: WritableStoreData): Promise<StoreData>;
  savePrize(command: SavePrizeCommand): Promise<PrizeMutationResult>;
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

class StaleKidIdReadError extends Error {}

export class KidIdAllocationError extends Error {
  constructor() {
    super('Unable to allocate a fresh kid id');
  }
}

export class UnknownPrizeError extends Error {
  constructor(prizeId: string) {
    super(`Unknown prize: ${prizeId}`);
  }
}

export class PrizeOutOfStockError extends Error {
  constructor(prizeId: string) {
    super(`Prize is out of stock: ${prizeId}`);
  }
}

const kidRegistrationRetryDelayMs = 250;
const maxKidRegistrationAttempts = 20;

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

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getNextKidId(existingKids: Kid[], kidIdPrefix: string) {
  const existingIds = new Set(existingKids.map((kid) => kid.id.toLowerCase()));
  let sequence = existingKids.length + 1;
  let nextId = `${kidIdPrefix}${sequence.toString().padStart(4, '0')}`;

  while (existingIds.has(nextId.toLowerCase())) {
    sequence += 1;
    nextId = `${kidIdPrefix}${sequence.toString().padStart(4, '0')}`;
  }

  return nextId;
}

function passportTemplate(
  passportActivitiesByKid: PassportActivitiesByKid,
): PassportActivity[] {
  return (
    Object.values(passportActivitiesByKid)[0]?.map((activity) => ({
      id: activity.id,
    })) ?? []
  );
}

function ensurePassportForKid(
  passportActivitiesByKid: PassportActivitiesByKid,
  kidId: string,
  activityId: number,
) {
  const existingPassport = passportActivitiesByKid[kidId];

  if (existingPassport) {
    return existingPassport;
  }

  const template = passportTemplate(passportActivitiesByKid);
  const passport =
    template.length > 0 ? template : ([{ id: activityId }] satisfies PassportActivity[]);

  passportActivitiesByKid[kidId] = passport;
  return passport;
}

function getPrizeGiven(prizeAwards: PrizeAward[], prizeId: string) {
  return prizeAwards.filter((award) => award.prizeId === prizeId).length;
}

export function syncPrizeGivenCache(prizes: Prize[], prizeAwards: PrizeAward[]) {
  return prizes.map((prize) => ({
    ...prize,
    given: getPrizeGiven(prizeAwards, prize.id),
  }));
}

function getPrizeRemaining(prize: Prize) {
  return Math.max(prize.initialUnits - prize.given, 0);
}

function createPrizeId(prizes: Prize[]) {
  let suffix = prizes.length + 1;
  let candidate = `prize-${suffix}`;

  while (prizes.some((prize) => prize.id === candidate)) {
    suffix += 1;
    candidate = `prize-${suffix}`;
  }

  return candidate;
}

function snapshotPrizeResponse(snapshot: StoreData, prize?: Prize): PrizeMutationResult {
  return {
    prize,
    prizeAwards: snapshot.prizeAwards,
    prizes: syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards),
  };
}

function applyRegisterKid(snapshot: StoreData, command: RegisterKidCommand) {
  const kidId = getNextKidId(snapshot.kids, snapshot.conference.kidIdPrefix);

  if (kidId.toLowerCase() === command.lastKnownKidId) {
    throw new StaleKidIdReadError();
  }

  const kid: Kid = {
    age: command.age,
    gender: command.gender,
    id: kidId,
    language: command.language,
    name: command.name,
  };
  const passport = passportTemplate(snapshot.passportActivitiesByKid);

  snapshot.kids.push(kid);
  snapshot.passportActivitiesByKid[kid.id] = passport;

  return kid;
}

function applyCompletePassportActivity(
  snapshot: StoreData,
  command: CompletePassportActivityCommand,
) {
  const passport = ensurePassportForKid(
    snapshot.passportActivitiesByKid,
    command.kidId,
    command.activityId,
  );
  const matchingActivity = passport.find(
    (activity) => activity.id === command.activityId,
  );

  if (matchingActivity) {
    matchingActivity.completedAt ??= command.completedAt;
  } else {
    passport.push({ completedAt: command.completedAt, id: command.activityId });
    passport.sort((left, right) => left.id - right.id);
  }

  return passport;
}

function applySavePrize(snapshot: StoreData, command: SavePrizeCommand) {
  if (command.type === 'create') {
    const prize: Prize = {
      given: 0,
      id: createPrizeId(snapshot.prizes),
      initialUnits: command.initialUnits,
      kind: 'normal',
      title: command.title,
    };

    snapshot.prizes.push(prize);
    return snapshotPrizeResponse(snapshot, prize);
  }

  const syncedPrizes = syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards);
  const prize = syncedPrizes.find((entry) => entry.id === command.prizeId);

  if (!prize) {
    throw new UnknownPrizeError(command.prizeId);
  }

  const initialUnits =
    command.initialUnits === undefined
      ? prize.initialUnits
      : Math.max(command.initialUnits, getPrizeGiven(snapshot.prizeAwards, prize.id));

  snapshot.prizes = snapshot.prizes.map((entry) =>
    entry.id === prize.id
      ? {
          ...entry,
          given: getPrizeGiven(snapshot.prizeAwards, prize.id),
          initialUnits,
          kind: command.prizeKind ?? prize.kind,
          title: command.title ?? prize.title,
        }
      : entry,
  );

  return snapshotPrizeResponse(
    snapshot,
    snapshot.prizes.find((entry) => entry.id === prize.id),
  );
}

function applyAwardPrize(snapshot: StoreData, command: AwardPrizeCommand) {
  const syncedPrizes = syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards);
  const prize = syncedPrizes.find((entry) => entry.id === command.prizeId);

  if (!prize) {
    throw new UnknownPrizeError(command.prizeId);
  }

  if (command.source === 'passportCompletion') {
    const existingAward = snapshot.prizeAwards.find(
      (award) => award.kidId === command.kidId && award.source === 'passportCompletion',
    );

    if (existingAward) {
      return snapshot.prizeAwards.filter((award) => award.kidId === command.kidId);
    }
  }

  if (getPrizeRemaining(prize) <= 0) {
    throw new PrizeOutOfStockError(command.prizeId);
  }

  snapshot.prizeAwards.push({
    awardedAt: command.awardedAt,
    id: command.awardId,
    kidId: command.kidId,
    prizeId: prize.id,
    ...(command.source ? { source: command.source } : {}),
  });

  return snapshot.prizeAwards.filter((award) => award.kidId === command.kidId);
}

type SnapshotUpdater = <T>(
  mutator: (snapshot: StoreData) => T | Promise<T>,
  changedFiles: readonly StoreFile[],
) => Promise<T>;

type KidScopedUpdater = <T>(
  kidId: string,
  mutator: (snapshot: StoreData) => T | Promise<T>,
) => Promise<T>;

export async function runRegisterKidCommand(
  command: RegisterKidCommand,
  updateSnapshot: SnapshotUpdater,
) {
  for (let attempt = 1; attempt <= maxKidRegistrationAttempts; attempt += 1) {
    try {
      return await updateSnapshot(
        (snapshot) => applyRegisterKid(snapshot, command),
        ['kids', 'passportActivitiesByKid'],
      );
    } catch (error) {
      if (
        error instanceof StaleKidIdReadError &&
        attempt < maxKidRegistrationAttempts
      ) {
        await delay(kidRegistrationRetryDelayMs);
        continue;
      }

      if (error instanceof StaleKidIdReadError) {
        throw new KidIdAllocationError();
      }

      throw error;
    }
  }

  throw new KidIdAllocationError();
}

export function runCompletePassportActivityCommand(
  command: CompletePassportActivityCommand,
  updatePassportForKid: KidScopedUpdater,
) {
  return updatePassportForKid(command.kidId, (snapshot) =>
    applyCompletePassportActivity(snapshot, command),
  );
}

export function runSavePrizeCommand(
  command: SavePrizeCommand,
  updateSnapshot: SnapshotUpdater,
) {
  return updateSnapshot((snapshot) => applySavePrize(snapshot, command), ['prizes']);
}

export function runAwardPrizeCommand(
  command: AwardPrizeCommand,
  updatePrizeAwardsForKid: KidScopedUpdater,
) {
  return updatePrizeAwardsForKid(command.kidId, (snapshot) =>
    applyAwardPrize(snapshot, command),
  );
}

export function runRestoreWritableDataCommand(
  data: WritableStoreData,
  updateSnapshot: SnapshotUpdater,
) {
  return updateSnapshot(
    (snapshot) => {
      snapshot.passportActivitiesByKid = data.passportActivitiesByKid;
      snapshot.prizeAwards = data.prizeAwards;
      snapshot.prizes = syncPrizeGivenCache(data.prizes, data.prizeAwards);

      return snapshot;
    },
    ['passportActivitiesByKid', 'prizeAwards', 'prizes'],
  );
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

let activeStore = createFileStore();

export function setStoreAdapter(store: StoreAdapter) {
  activeStore = store;
}

export async function readSnapshot() {
  return activeStore.readSnapshot();
}

export async function registerKid(command: RegisterKidCommand) {
  return activeStore.registerKid(command);
}

export async function completePassportActivity(
  command: CompletePassportActivityCommand,
) {
  return activeStore.completePassportActivity(command);
}

export async function savePrize(command: SavePrizeCommand) {
  return activeStore.savePrize(command);
}

export async function awardPrize(command: AwardPrizeCommand) {
  return activeStore.awardPrize(command);
}

export async function restoreWritableData(data: WritableStoreData) {
  return activeStore.restoreWritableData(data);
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
