export type ConferenceData = {
  kidIdPrefix: string;
  shortName: string;
  title: string;
};

export type Kid = {
  age: number;
  gender: string;
  id: string;
  language: string;
  name: string;
};

export type PassportActivity = {
  completedAt?: string;
  id: number;
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

export type PrizeAward = {
  awardedAt: string;
  id: string;
  kidId: string;
  prizeId: string;
};

export type UserRole = 'desk' | 'lead' | 'wheel';

export type User = {
  activityId?: number;
  id: string;
  name: string;
  role: UserRole;
};

export type StoreData = {
  conference: ConferenceData;
  kids: Kid[];
  passportActivitiesByKid: PassportActivitiesByKid;
  prizeAwards: PrizeAward[];
  prizes: Prize[];
};
