import type { Kid, PassportActivity, Prize, PrizeAward, StoreData } from './types.js';

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
  resetData(data: StoreData): Promise<StoreData>;
  restoreWritableData(data: WritableStoreData): Promise<StoreData>;
  savePrize(command: SavePrizeCommand): Promise<PrizeMutationResult>;
};

const storeFiles = {
  conference: 'conference.json',
  kids: 'kids.json',
  passportActivitiesByKid: 'passportActivities.json',
  prizeAwards: 'prizeAwards.json',
  prizes: 'prizes.json',
} as const;

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

let activeStore: StoreAdapter | undefined;

export function getStoreFileName(storeFile: StoreFile) {
  return storeFiles[storeFile];
}

export function getPrizeGiven(prizeAwards: PrizeAward[], prizeId: string) {
  return prizeAwards.filter((award) => award.prizeId === prizeId).length;
}

export function syncPrizeGivenCache(prizes: Prize[], prizeAwards: PrizeAward[]) {
  return prizes.map((prize) => ({
    ...prize,
    given: getPrizeGiven(prizeAwards, prize.id),
  }));
}

export function setStoreAdapter(store: StoreAdapter) {
  activeStore = store;
}

function requireStore() {
  if (!activeStore) {
    throw new Error('Store adapter has not been configured');
  }

  return activeStore;
}

export async function readSnapshot() {
  return requireStore().readSnapshot();
}

export async function registerKid(command: RegisterKidCommand) {
  return requireStore().registerKid(command);
}

export async function completePassportActivity(
  command: CompletePassportActivityCommand,
) {
  return requireStore().completePassportActivity(command);
}

export async function savePrize(command: SavePrizeCommand) {
  return requireStore().savePrize(command);
}

export async function awardPrize(command: AwardPrizeCommand) {
  return requireStore().awardPrize(command);
}

export async function restoreWritableData(data: WritableStoreData) {
  return requireStore().restoreWritableData(data);
}
