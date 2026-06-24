import type { MagicLinkTokenRecord, MagicLinkTokenStore } from './access-tokens.js';
import type {
  AwardPrizeCommand,
  CompletePassportActivityCommand,
  PrizeMutationResult,
  RegisterKidCommand,
  SavePrizeCommand,
  StoreAdapter,
  StoreFile,
  WritableStoreData,
} from './store.js';
import type { Kid, PassportActivity, PrizeAward, StoreData } from './types.js';

type DualStoreOptions = {
  primary: StoreAdapter;
  secondary: StoreAdapter;
  strict: boolean;
};

function checkMatchingJson(
  strict: boolean,
  label: string,
  primary: unknown,
  secondary: unknown,
) {
  if (JSON.stringify(primary) !== JSON.stringify(secondary)) {
    const message = `Dual store ${label} mismatch between primary and secondary`;

    if (strict) {
      throw new Error(message);
    }

    console.error(message);
  }
}

async function writeSecondary<T>(
  strict: boolean,
  label: string,
  write: () => Promise<T>,
) {
  try {
    return await write();
  } catch (error) {
    if (strict) {
      throw error;
    }

    console.error(`Dual store secondary ${label} failed`, error);
    return undefined;
  }
}

export function createDualStore({
  primary,
  secondary,
  strict,
}: DualStoreOptions): StoreAdapter {
  async function mirrorSnapshotToSecondary(
    primarySnapshot: StoreData,
    changedFiles: readonly StoreFile[],
  ) {
    await writeSecondary(strict, 'snapshot write', () =>
      secondary.updateSnapshot((secondarySnapshot) => {
        for (const changedFile of changedFiles) {
          switch (changedFile) {
            case 'conference':
              secondarySnapshot.conference = primarySnapshot.conference;
              break;
            case 'kids':
              secondarySnapshot.kids = primarySnapshot.kids;
              break;
            case 'passportActivitiesByKid':
              secondarySnapshot.passportActivitiesByKid =
                primarySnapshot.passportActivitiesByKid;
              break;
            case 'prizeAwards':
              secondarySnapshot.prizeAwards = primarySnapshot.prizeAwards;
              break;
            case 'prizes':
              secondarySnapshot.prizes = primarySnapshot.prizes;
              break;
          }
        }
      }, changedFiles),
    );
  }

  return {
    async awardPrize(command: AwardPrizeCommand): Promise<PrizeAward[]> {
      const primaryResult = await primary.awardPrize(command);
      const secondaryResult = await writeSecondary(strict, 'awardPrize', () =>
        secondary.awardPrize(command),
      );

      if (secondaryResult) {
        checkMatchingJson(strict, 'awardPrize result', primaryResult, secondaryResult);
      }

      return primaryResult;
    },
    async completePassportActivity(
      command: CompletePassportActivityCommand,
    ): Promise<PassportActivity[]> {
      const primaryResult = await primary.completePassportActivity(command);
      const secondaryResult = await writeSecondary(
        strict,
        'completePassportActivity',
        () => secondary.completePassportActivity(command),
      );

      if (secondaryResult) {
        checkMatchingJson(
          strict,
          'completePassportActivity result',
          primaryResult,
          secondaryResult,
        );
      }

      return primaryResult;
    },
    readSnapshot() {
      return primary.readSnapshot();
    },
    async registerKid(command: RegisterKidCommand): Promise<Kid> {
      const primaryResult = await primary.registerKid(command);
      const secondaryResult = await writeSecondary(strict, 'registerKid', () =>
        secondary.registerKid(command),
      );

      if (secondaryResult) {
        checkMatchingJson(strict, 'registerKid result', primaryResult, secondaryResult);
      }

      return primaryResult;
    },
    async restoreWritableData(data: WritableStoreData): Promise<StoreData> {
      const primaryResult = await primary.restoreWritableData(data);
      const secondaryResult = await writeSecondary(strict, 'restoreWritableData', () =>
        secondary.restoreWritableData(data),
      );

      if (secondaryResult) {
        checkMatchingJson(
          strict,
          'restoreWritableData result',
          primaryResult,
          secondaryResult,
        );
      }

      return primaryResult;
    },
    async savePrize(command: SavePrizeCommand): Promise<PrizeMutationResult> {
      const primaryResult = await primary.savePrize(command);
      const secondaryResult = await writeSecondary(strict, 'savePrize', () =>
        secondary.savePrize(command),
      );

      if (secondaryResult) {
        checkMatchingJson(strict, 'savePrize result', primaryResult, secondaryResult);
      }

      return primaryResult;
    },
    async updatePassportForKid<T>(
      kidId: string,
      mutator: (snapshot: StoreData) => T | Promise<T>,
    ) {
      const primaryResult = await primary.updatePassportForKid(kidId, mutator);
      const primarySnapshot = await primary.readSnapshot();
      await writeSecondary(strict, 'updatePassportForKid', () =>
        secondary.updatePassportForKid(kidId, (secondarySnapshot) => {
          secondarySnapshot.passportActivitiesByKid[kidId] =
            primarySnapshot.passportActivitiesByKid[kidId] ?? [];
        }),
      );
      return primaryResult;
    },
    async updatePrizeAwardsForKid<T>(
      kidId: string,
      mutator: (snapshot: StoreData) => T | Promise<T>,
    ) {
      const primaryResult = await primary.updatePrizeAwardsForKid(kidId, mutator);
      const primarySnapshot = await primary.readSnapshot();
      await writeSecondary(strict, 'updatePrizeAwardsForKid', () =>
        secondary.updatePrizeAwardsForKid(kidId, (secondarySnapshot) => {
          secondarySnapshot.prizeAwards = primarySnapshot.prizeAwards;
        }),
      );
      return primaryResult;
    },
    async updateSnapshot<T>(
      mutator: (snapshot: StoreData) => T | Promise<T>,
      changedFiles: readonly StoreFile[],
    ) {
      const primaryResult = await primary.updateSnapshot(mutator, changedFiles);
      await mirrorSnapshotToSecondary(await primary.readSnapshot(), changedFiles);
      return primaryResult;
    },
  };
}

export function createDualMagicTokenStore({
  primary,
  secondary,
  strict,
}: {
  primary: MagicLinkTokenStore;
  secondary: MagicLinkTokenStore;
  strict: boolean;
}): MagicLinkTokenStore {
  return {
    readTokens() {
      return primary.readTokens();
    },
    async writeTokens(tokens: MagicLinkTokenRecord[]) {
      await primary.writeTokens(tokens);
      await writeSecondary(strict, 'magic token write', () =>
        secondary.writeTokens(tokens),
      );
    },
  };
}
