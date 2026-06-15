import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import activitiesJson from '../data/activities.json';
import conferenceJson from '../data/conference.json';
import kidsJson from '../data/kids.json';
import passportActivitiesJson from '../data/passportActivities.json';
import prizeAwardsJson from '../data/prizeAwards.json';
import prizesJson from '../data/prizes.json';
import usersJson from '../data/users.json';
import {
  createKidQrIdData,
  getKidSequenceNumber,
  getNextKidId,
} from '../utils/kid-id';
import type { KidGender, RegistrationInput } from '../utils/kid-registration';
import type { Locale } from '../i18n/messages';

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
};

type PassportActivitiesByKid = Record<string, PassportActivity[]>;

export type Prize = {
  given: number;
  id: string;
  initialUnits: number;
  isValuable: boolean;
  title: string;
};

export type PrizeAward = {
  awardedAt: string;
  id: string;
  kidId: string;
  prizeId: string;
};

export type PrizeAwardRecord = PrizeAward & {
  prizeTitle: string;
};

export type WheelShotSummary = {
  availableShots: number;
  awards: PrizeAwardRecord[];
  earnedShots: number;
  usedShots: number;
};

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
  qrIdData: string;
};

export type CurrentUser =
  | {
      id: string;
      kid: Kid;
      name: string;
      role: 'kid';
    }
  | User;

type DataLayerContextValue = {
  activities: Activity[];
  addRegisteredKid: (registration: RegistrationInput) => Kid;
  awardPrizeToKid: (kidId: string, prizeId: string) => PrizeAward;
  conference: ConferenceData;
  currentUser: CurrentUser;
  findKidByManualNumber: (rawSearchValue: string) => Kid | undefined;
  findKidByQrIdData: (qrIdData: string) => Kid | undefined;
  getPassportForKid: (kidId: string) => PassportData;
  getWheelShotSummaryForKid: (kidId: string) => WheelShotSummary;
  kids: Kid[];
  markPassportActivityDone: (kidId: string, activityId: number) => number;
  passport: PassportData;
  prizes: Prize[];
  reloadPassportActivities: () => void;
  users: User[];
  setCurrentUser: (user: Kid | User) => void;
  updatePrize: (prizeId: string, updates: Partial<Prize>) => void;
};

const initialActivities: Activity[] = activitiesJson;
const initialKids: Kid[] = kidsJson as Kid[];
const initialPrizeAwards: PrizeAward[] = prizeAwardsJson;
const initialPrizes: Prize[] = prizesJson;
const initialUsers: User[] = usersJson as User[];
const initialPassportActivitiesByUser =
  passportActivitiesJson as PassportActivitiesByKid;

function clonePassportActivities(
  passportActivitiesByKid: PassportActivitiesByKid,
): PassportActivitiesByKid {
  return Object.fromEntries(
    Object.entries(passportActivitiesByKid).map(([kidId, activities]) => [
      kidId,
      activities.map((activity) => ({ ...activity })),
    ]),
  );
}

function clonePrizes(prizes: Prize[]): Prize[] {
  return prizes.map((prize) => ({ ...prize }));
}

function clonePrizeAwards(prizeAwards: PrizeAward[]): PrizeAward[] {
  return prizeAwards.map((award) => ({ ...award }));
}

export function getPrizeRemaining(prize: Prize) {
  return Math.max(prize.initialUnits - prize.given, 0);
}

function normalizePrizeCount(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error('Prize stock must be a number');
  }

  return Math.max(0, Math.floor(value));
}

function getDefaultUser() {
  const defaultUser =
    initialUsers.find((user) => user.role === 'desk') ?? initialUsers[0];

  if (!defaultUser) {
    throw new Error('users.json must include at least one user');
  }

  return defaultUser;
}

const defaultUser = getDefaultUser();

function getDefaultKid() {
  const defaultKid = initialKids[0];

  if (!defaultKid) {
    throw new Error('kids.json must include at least one kid');
  }

  return defaultKid;
}

const defaultKid = getDefaultKid();

const missingKidPassportUsers = initialKids.filter(
  (kid) => !initialPassportActivitiesByUser[kid.id],
);

if (missingKidPassportUsers.length > 0) {
  throw new Error(
    `passportActivities.json is missing kids: ${missingKidPassportUsers
      .map((kid) => kid.id)
      .join(', ')}`,
  );
}

function wrapKid(kid: Kid): CurrentUser {
  return {
    id: kid.id,
    kid,
    name: kid.name,
    role: 'kid',
  };
}

const emptyPassportTemplate =
  Object.values(initialPassportActivitiesByUser)[0]?.map((activity) => ({
    id: activity.id,
  })) ?? [];

const DataLayerContext = createContext<DataLayerContextValue | undefined>(
  undefined,
);

export function DataLayerProvider({ children }: PropsWithChildren) {
  const [kidList, setKidList] = useState(initialKids);
  const [prizeList, setPrizeList] = useState(() => clonePrizes(initialPrizes));
  const [prizeAwards, setPrizeAwards] = useState(() =>
    clonePrizeAwards(initialPrizeAwards),
  );
  const [userList] = useState(initialUsers);
  const [passportActivitiesByUser, setPassportActivitiesByUser] = useState(
    () => clonePassportActivities(initialPassportActivitiesByUser),
  );
  const [selectedCurrentUser, setSelectedCurrentUser] =
    useState<CurrentUser>(wrapKid(defaultKid));
  const currentUser =
    selectedCurrentUser.role === 'kid'
      ? wrapKid(
          kidList.find((kid) => kid.id === selectedCurrentUser.id) ?? defaultKid,
        )
      : (userList.find((user) => user.id === selectedCurrentUser.id) ??
        defaultUser);
  const setCurrentUser = (nextUser: Kid | User) => {
    const nextCurrentUser =
      'role' in nextUser ? nextUser : wrapKid(nextUser);

    if (
      nextCurrentUser.role === 'kid' &&
      !kidList.some((kid) => kid.id === nextCurrentUser.id)
    ) {
      throw new Error(`Unknown kid: ${nextCurrentUser.id}`);
    }

    if (
      nextCurrentUser.role !== 'kid' &&
      !userList.some((user) => user.id === nextCurrentUser.id)
    ) {
      throw new Error(`Unknown user: ${nextCurrentUser.id}`);
    }

    setSelectedCurrentUser(nextCurrentUser);
  };
  const addRegisteredKid = (registration: RegistrationInput) => {
    const kidId = getNextKidId(kidList, conferenceJson.kidIdPrefix);
    const registeredKid: Kid = {
      age: registration.age,
      gender: registration.gender,
      id: kidId,
      language: registration.language,
      name: registration.nickname.trim(),
      qrIdData: createKidQrIdData(kidId),
    };

    setKidList((currentKids) => [...currentKids, registeredKid]);
    setPassportActivitiesByUser((currentPassportActivities) => ({
      ...currentPassportActivities,
      [registeredKid.id]: emptyPassportTemplate,
    }));

    return registeredKid;
  };
  const getPassportForKid = (kidId: string): PassportData => ({
    activities: passportActivitiesByUser[kidId] ?? [],
  });
  const getWheelShotSummaryForKid = (kidId: string): WheelShotSummary => {
    const kidActivities = passportActivitiesByUser[kidId];

    if (!kidActivities) {
      throw new Error(`Unknown passport kid: ${kidId}`);
    }

    const earnedShots = Math.floor(
      kidActivities.filter((activity) => activity.completedAt).length / 4,
    );
    const awards = prizeAwards
      .filter((award) => award.kidId === kidId)
      .map((award) => {
        const prize = prizeList.find((entry) => entry.id === award.prizeId);

        return {
          ...award,
          prizeTitle: prize?.title ?? award.prizeId,
        };
      });

    return {
      availableShots: Math.max(earnedShots - awards.length, 0),
      awards,
      earnedShots,
      usedShots: awards.length,
    };
  };
  const findKidByManualNumber = (rawSearchValue: string) => {
    const searchedNumber = Number(rawSearchValue);

    if (!Number.isInteger(searchedNumber)) {
      return undefined;
    }

    return kidList.find((kid) => getKidSequenceNumber(kid.id) === searchedNumber);
  };
  const findKidByQrIdData = (qrIdData: string) =>
    kidList.find((kid) => kid.qrIdData === qrIdData);
  const reloadPassportActivities = () => {
    setPassportActivitiesByUser((currentPassportActivities) =>
      clonePassportActivities(currentPassportActivities),
    );
  };
  const markPassportActivityDone = (kidId: string, activityId: number) => {
    const kidActivities = passportActivitiesByUser[kidId];

    if (!kidActivities) {
      throw new Error(`Unknown passport kid: ${kidId}`);
    }

    const nextActivities = kidActivities.map((activity) => {
      if (activity.id !== activityId) {
        return activity;
      }

      return {
        ...activity,
        completedAt: activity.completedAt ?? new Date().toISOString(),
      };
    });
    const completedActivities = nextActivities.filter(
      (activity) => activity.completedAt,
    ).length;

    const nextPassportActivities = {
      ...passportActivitiesByUser,
      [kidId]: nextActivities,
    };

    setPassportActivitiesByUser(nextPassportActivities);

    return completedActivities;
  };
  const awardPrizeToKid = (kidId: string, prizeId: string) => {
    if (!kidList.some((kid) => kid.id === kidId)) {
      throw new Error(`Unknown kid: ${kidId}`);
    }

    const shotSummary = getWheelShotSummaryForKid(kidId);

    if (shotSummary.availableShots <= 0) {
      throw new Error(`Kid has no wheel shots available: ${kidId}`);
    }

    if (!prizeList.some((prize) => getPrizeRemaining(prize) > 0)) {
      throw new Error('No prizes remaining');
    }

    const prize = prizeList.find((entry) => entry.id === prizeId);

    if (!prize) {
      throw new Error(`Unknown prize: ${prizeId}`);
    }

    if (getPrizeRemaining(prize) <= 0) {
      throw new Error(`Prize is out of stock: ${prizeId}`);
    }

    const award: PrizeAward = {
      awardedAt: new Date().toISOString(),
      id: `${kidId}-${Date.now()}`,
      kidId,
      prizeId,
    };

    setPrizeList((currentPrizes) =>
      currentPrizes.map((currentPrize) =>
        currentPrize.id === prizeId
          ? {
              ...currentPrize,
              given: currentPrize.given + 1,
            }
          : currentPrize,
      ),
    );
    setPrizeAwards((currentAwards) => [...currentAwards, award]);

    return award;
  };
  const updatePrize = (prizeId: string, updates: Partial<Prize>) => {
    setPrizeList((currentPrizes) => {
      if (!currentPrizes.some((prize) => prize.id === prizeId)) {
        throw new Error(`Unknown prize: ${prizeId}`);
      }

      return currentPrizes.map((prize) => {
        if (prize.id !== prizeId) {
          return prize;
        }

        const title = updates.title ?? prize.title;
        const initialUnits = normalizePrizeCount(
          updates.initialUnits ?? prize.initialUnits,
        );
        const given = Math.min(
          normalizePrizeCount(updates.given ?? prize.given),
          initialUnits,
        );

        if (!title.trim()) {
          throw new Error(`Prize title cannot be empty: ${prizeId}`);
        }

        return {
          ...prize,
          given,
          initialUnits,
          isValuable: updates.isValuable ?? prize.isValuable,
          title: title.trim(),
        };
      });
    });
  };
  const value = useMemo<DataLayerContextValue>(
    () => ({
      activities: initialActivities,
      addRegisteredKid,
      awardPrizeToKid,
      conference: conferenceJson,
      currentUser,
      findKidByManualNumber,
      findKidByQrIdData,
      getPassportForKid,
      getWheelShotSummaryForKid,
      kids: kidList,
      markPassportActivityDone,
      passport: {
        activities:
          currentUser.role === 'kid'
            ? (passportActivitiesByUser[currentUser.id] ?? [])
            : [],
      },
      prizes: prizeList,
      reloadPassportActivities,
      setCurrentUser,
      updatePrize,
      users: userList,
    }),
    [
      currentUser,
      kidList,
      passportActivitiesByUser,
      prizeAwards,
      prizeList,
      userList,
    ],
  );

  return (
    <DataLayerContext.Provider value={value}>{children}</DataLayerContext.Provider>
  );
}

function useDataLayer() {
  const context = useContext(DataLayerContext);

  if (!context) {
    throw new Error('useDataLayer must be used within DataLayerProvider');
  }

  return context;
}

export function useConferenceData() {
  return useDataLayer().conference;
}

export function useActivitiesData() {
  return useDataLayer().activities;
}

export function useCurrentUser() {
  return useDataLayer().currentUser;
}

export function useFindKidByManualNumber() {
  return useDataLayer().findKidByManualNumber;
}

export function useFindKidByQrIdData() {
  return useDataLayer().findKidByQrIdData;
}

export function useKidsData() {
  return useDataLayer().kids;
}

export function usePassportData() {
  return useDataLayer().passport;
}

export function useReloadPassportActivities() {
  return useDataLayer().reloadPassportActivities;
}

export function useGetPassportForKid() {
  return useDataLayer().getPassportForKid;
}

export function useUsersData() {
  return useDataLayer().users;
}

export function useAddRegisteredKid() {
  return useDataLayer().addRegisteredKid;
}

export function useMarkPassportActivityDone() {
  return useDataLayer().markPassportActivityDone;
}

export function usePrizesData() {
  return useDataLayer().prizes;
}

export function useGetWheelShotSummaryForKid() {
  return useDataLayer().getWheelShotSummaryForKid;
}

export function useAwardPrizeToKid() {
  return useDataLayer().awardPrizeToKid;
}

export function useUpdatePrize() {
  return useDataLayer().updatePrize;
}

export function useSetCurrentUser() {
  return useDataLayer().setCurrentUser;
}
