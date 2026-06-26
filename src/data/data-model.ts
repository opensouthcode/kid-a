import type { Locale } from '../i18n/messages';
import type { KidGender } from '../utils/kid-registration';

export type ConferenceData = {
  kidIdPrefix: string;
  shortName: string;
  title: string;
};

export type Activity = {
  details?: string;
  id: string;
  issueUrl: string;
  title: string;
};

export type PassportActivity = {
  completedAt?: string;
  id: number;
};

export type PassportData = {
  activities: PassportActivity[];
  wheelShotSummary?: PassportWheelShotSummary;
};

export type PassportActivitiesByKid = Record<string, PassportActivity[]>;

export type PrizeKind = 'final' | 'normal' | 'valuable';

export type Prize = {
  given: number;
  id: string;
  initialUnits: number;
  kind: PrizeKind;
  title: string;
};

export type PrizeSettingsUpdate = Partial<Omit<Prize, 'given'>>;
export type PrizeAwardSource = 'passportCompletion' | 'wheel';

export type PrizeAward = {
  awardedAt: string;
  id: string;
  kidId: string;
  prizeId: string;
  source?: PrizeAwardSource;
};

export type PrizeAwardRecord = PrizeAward & {
  prizeKind: PrizeKind;
  prizeTitle: string;
};

export type WheelShotSummary = {
  availableShots: number;
  awards: PrizeAwardRecord[];
  completionAward?: PrizeAwardRecord;
  earnedShots: number;
  usedShots: number;
};

export type PassportWheelShotSummary = Pick<
  WheelShotSummary,
  'availableShots' | 'earnedShots' | 'usedShots'
>;

export type UserRole = 'desk' | 'wheel' | 'lead';

export type User = {
  activityId?: number;
  id: string;
  name: string;
  role: UserRole;
};

export type Kid = {
  age: number;
  gender: KidGender;
  id: string;
  language: Locale;
  name: string;
};

export type CurrentUser =
  | {
      id: 'guest';
      name: 'Guest';
      role: 'guest';
    }
  | {
      id: string;
      kid: Kid;
      name: string;
      role: 'kid';
    }
  | User;

export function clonePassportActivities(
  passportActivitiesByKid: PassportActivitiesByKid,
): PassportActivitiesByKid {
  return Object.fromEntries(
    Object.entries(passportActivitiesByKid).map(([kidId, activities]) => [
      kidId,
      activities.map((activity) => ({ ...activity })),
    ]),
  );
}

export function clonePrizes(prizes: Prize[]): Prize[] {
  return prizes.map((prize) => ({ ...prize }));
}

export function clonePrizeAwards(prizeAwards: PrizeAward[]): PrizeAward[] {
  return prizeAwards.map((award) => ({ ...award }));
}

export function getPrizeRemaining(prize: Prize) {
  return Math.max(prize.initialUnits - prize.given, 0);
}

export function getPrizeGiven(prizeAwards: PrizeAward[], prizeId: string) {
  return prizeAwards.filter((award) => award.prizeId === prizeId).length;
}

export function isWheelAward(award: PrizeAward) {
  return (award.source ?? 'wheel') === 'wheel';
}

export function syncPrizeGivenCache(
  prizes: Prize[],
  prizeAwards: PrizeAward[],
): Prize[] {
  return prizes.map((prize) => ({
    ...prize,
    given: getPrizeGiven(prizeAwards, prize.id),
  }));
}
