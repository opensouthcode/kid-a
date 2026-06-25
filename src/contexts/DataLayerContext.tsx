import {
  createContext,
  useEffect,
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
  clonePassportActivities,
  clonePrizeAwards,
  clonePrizes,
  getPrizeGiven,
  getPrizeRemaining,
  isWheelAward,
  syncPrizeGivenCache,
  type Activity,
  type ConferenceData,
  type CurrentUser,
  type Kid,
  type PassportActivitiesByKid,
  type PassportData,
  type Prize,
  type PrizeAward,
  type PrizeSettingsUpdate,
  type User,
  type UserRole,
  type WheelShotSummary,
} from '../data/data-model';
import {
  clearMagicLinkSession,
  getActiveMagicLinkToken,
  resolveBuiltInMagicLink,
} from '../access/magic-links';
import {
  fetchRemoteDataSnapshot,
  fetchRemoteKid,
  fetchRemoteMagicLinkSession,
  fetchRemotePassport,
  fetchRemotePassports,
  fetchRemotePrizeAwardsForKid,
  isRemoteDataLayerEnabled,
  saveRemotePassportActivity,
  saveRemotePrize,
  saveRemotePrizeAward,
  saveRemoteRegisteredKid,
  type RemoteDataSnapshot,
} from '../data/remote-data-client';
import {
  getKidSequenceNumber,
  getNextKidId,
  parseKidQrPayload,
} from '../utils/kid-id';
import type { RegistrationInput } from '../utils/kid-registration';

export { getPrizeRemaining } from '../data/data-model';
export type {
  Activity,
  ConferenceData,
  CurrentUser,
  Kid,
  PassportActivity,
  PassportData,
  Prize,
  PrizeAward,
  PrizeAwardRecord,
  PrizeKind,
  PrizeSettingsUpdate,
  User,
  UserRole,
  WheelShotSummary,
} from '../data/data-model';

type DataLayerContextValue = {
  accessSessionStatus: AccessSessionStatus;
  activities: Activity[];
  addRegisteredKid: (registration: RegistrationInput) => Promise<Kid>;
  addPrize: (title: string) => Prize;
  awardPassportCompletionPrize: (kidId: string) => PrizeAward;
  awardPrizeToKid: (kidId: string, prizeId: string) => PrizeAward;
  conference: ConferenceData;
  currentUser: CurrentUser;
  findKidById: (kidId: string) => Promise<Kid | undefined>;
  findKidByManualNumber: (rawSearchValue: string) => Promise<Kid | undefined>;
  findKidByQrIdData: (qrPayload: string) => Promise<Kid | undefined>;
  getPassportForKid: (kidId: string) => PassportData;
  getWheelShotSummaryForKid: (kidId: string) => WheelShotSummary;
  kids: Kid[];
  markPassportActivityDone: (kidId: string, activityId: number) => number;
  passport: PassportData;
  prizes: Prize[];
  refreshPrizes: () => Prize[];
  reloadPassportActivities: (kidId?: string) => void;
  reloadPassportActivitiesForKids: (kidIds: string[]) => Promise<void>;
  reloadPrizeAwardsForKid: (kidId: string) => void;
  users: User[];
  resetCurrentUser: () => void;
  setCurrentUser: (user: Kid | User) => void;
  updatePrize: (prizeId: string, updates: PrizeSettingsUpdate) => void;
};

type AccessSessionStatus =
  | {
      state: 'idle' | 'loading' | 'ready';
    }
  | {
      error: string;
      state: 'error';
    };

const initialActivities: Activity[] = activitiesJson;
const initialKids: Kid[] = kidsJson as Kid[];
const initialPrizeAwards = prizeAwardsJson as PrizeAward[];
const initialPrizes = prizesJson as Prize[];
const initialUsers: User[] = usersJson as User[];
const initialPassportActivitiesByUser =
  passportActivitiesJson as PassportActivitiesByKid;

function normalizePrizeCount(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error('Prize stock must be a number');
  }

  return Math.max(0, Math.floor(value));
}

function createPrizeId(prizes: Prize[]) {
  const nextPrizeNumber = prizes.length + 1;
  let candidateId = `prize-${nextPrizeNumber}`;
  let suffix = nextPrizeNumber;

  while (prizes.some((prize) => prize.id === candidateId)) {
    suffix += 1;
    candidateId = `prize-${suffix}`;
  }

  return candidateId;
}

function mergeKid(kids: Kid[], kid: Kid) {
  return kids.some((currentKid) => currentKid.id === kid.id)
    ? kids.map((currentKid) => (currentKid.id === kid.id ? kid : currentKid))
    : [...kids, kid];
}

const guestUser: CurrentUser = {
  id: 'guest',
  name: 'Guest',
  role: 'guest',
};

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

function createMagicLinkUser(role: UserRole, activityId?: number): User {
  return {
    ...(activityId ? { activityId } : {}),
    id: activityId ? `magic-link-${role}-${activityId}` : `magic-link-${role}`,
    name: role,
    role,
  };
}

function getInitialMagicLinkUser(isRemoteDataLayer: boolean): CurrentUser | undefined {
  if (isRemoteDataLayer) {
    return undefined;
  }

  const builtInMagicLink = resolveBuiltInMagicLink(getActiveMagicLinkToken());

  if (!builtInMagicLink) {
    return undefined;
  }

  return createMagicLinkUser(builtInMagicLink.role, builtInMagicLink.activityId);
}

const emptyPassportTemplate =
  Object.values(initialPassportActivitiesByUser)[0]?.map((activity) => ({
    id: activity.id,
  })) ?? [];

const DataLayerContext = createContext<DataLayerContextValue | undefined>(
  undefined,
);

export function DataLayerProvider({ children }: PropsWithChildren) {
  const isRemoteDataLayer = isRemoteDataLayerEnabled();
  const [kidList, setKidList] = useState(() =>
    isRemoteDataLayer ? [] : initialKids,
  );
  const [prizeAwards, setPrizeAwards] = useState(() =>
    isRemoteDataLayer ? [] : clonePrizeAwards(initialPrizeAwards),
  );
  const [prizeList, setPrizeList] = useState(() =>
    isRemoteDataLayer
      ? clonePrizes(initialPrizes)
      : syncPrizeGivenCache(clonePrizes(initialPrizes), initialPrizeAwards),
  );
  const [userList] = useState(initialUsers);
  const [passportActivitiesByUser, setPassportActivitiesByUser] = useState(
    () =>
      isRemoteDataLayer
        ? {}
        : clonePassportActivities(initialPassportActivitiesByUser),
  );
  const [selectedCurrentUser, setSelectedCurrentUser] = useState<CurrentUser>(
    () => getInitialMagicLinkUser(isRemoteDataLayer) ?? guestUser,
  );
  const [accessSessionStatus, setAccessSessionStatus] =
    useState<AccessSessionStatus>(() =>
      getActiveMagicLinkToken()
        ? isRemoteDataLayer
          ? { state: 'loading' }
          : getInitialMagicLinkUser(isRemoteDataLayer)
            ? { state: 'ready' }
            : { error: 'Unknown sample magic link', state: 'error' }
        : { state: 'idle' },
    );
  const prizes = useMemo<Prize[]>(
    () =>
      isRemoteDataLayer
        ? prizeList
        : syncPrizeGivenCache(prizeList, prizeAwards),
    [isRemoteDataLayer, prizeAwards, prizeList],
  );
  const applyRemoteSnapshot = (snapshot: RemoteDataSnapshot) => {
    setKidList(snapshot.kids);
    setPrizeList(clonePrizes(snapshot.prizes));
  };
  const applyRemotePassport = (kidId: string, activities: PassportData['activities']) => {
    setPassportActivitiesByUser((currentPassportActivities) => ({
      ...currentPassportActivities,
      [kidId]: activities.map((activity) => ({ ...activity })),
    }));
  };
  const applyRemotePassports = (
    passportsByKid: Record<string, PassportData['activities']>,
  ) => {
    setPassportActivitiesByUser((currentPassportActivities) => ({
      ...currentPassportActivities,
      ...Object.fromEntries(
        Object.entries(passportsByKid).map(([kidId, activities]) => [
          kidId,
          activities.map((activity) => ({ ...activity })),
        ]),
      ),
    }));
  };
  const applyRemotePrizeAwards = (kidId: string, awards: PrizeAward[]) => {
    setPrizeAwards((currentPrizeAwards) => [
      ...currentPrizeAwards.filter((award) => award.kidId !== kidId),
      ...clonePrizeAwards(awards),
    ]);
  };

  useEffect(() => {
    const token = getActiveMagicLinkToken();

    if (!token) {
      setAccessSessionStatus({ state: 'idle' });
      return;
    }

    if (!isRemoteDataLayer) {
      const builtInMagicLink = resolveBuiltInMagicLink(token);

      if (!builtInMagicLink) {
        clearMagicLinkSession();
        setSelectedCurrentUser(guestUser);
        setAccessSessionStatus({
          error: 'Unknown sample magic link',
          state: 'error',
        });
        return;
      }

      setSelectedCurrentUser(
        createMagicLinkUser(builtInMagicLink.role, builtInMagicLink.activityId),
      );
      setAccessSessionStatus({ state: 'ready' });
      return;
    }

    setAccessSessionStatus({ state: 'loading' });
    fetchRemoteMagicLinkSession()
      .then((session) => {
        setSelectedCurrentUser(
          createMagicLinkUser(session.role, session.activityId),
        );
        setAccessSessionStatus({ state: 'ready' });
      })
      .catch((error) => {
        clearMagicLinkSession();
        setSelectedCurrentUser(guestUser);
        setAccessSessionStatus({
          error: error instanceof Error ? error.message : 'Invalid magic link',
          state: 'error',
        });
      });
  }, [isRemoteDataLayer]);

  useEffect(() => {
    if (!isRemoteDataLayer || accessSessionStatus.state !== 'ready') {
      return;
    }

    fetchRemoteDataSnapshot()
      .then(applyRemoteSnapshot)
      .catch((error) => {
        console.error('Unable to load remote event data.', error);
      });
  }, [accessSessionStatus.state, isRemoteDataLayer]);

  const persistRemoteSnapshot = (snapshotPromise: Promise<RemoteDataSnapshot>) => {
    snapshotPromise.then(applyRemoteSnapshot).catch((error) => {
      console.error('Unable to refresh remote event data.', error);
    });
  };
  const loadRemotePassportForKid = (kidId: string) => {
    fetchRemotePassport(kidId)
      .then((activities) => applyRemotePassport(kidId, activities))
      .catch((error) => {
        console.error(`Unable to load remote passport for ${kidId}.`, error);
      });
  };
  const loadRemotePrizeAwardsForKid = (kidId: string) => {
    fetchRemotePrizeAwardsForKid(kidId)
      .then((awards) => applyRemotePrizeAwards(kidId, awards))
      .catch((error) => {
        console.error(`Unable to load remote prize awards for ${kidId}.`, error);
      });
  };
  const currentUser =
    selectedCurrentUser.role === 'guest'
      ? guestUser
      : selectedCurrentUser.role === 'kid'
      ? wrapKid(
          kidList.find((kid) => kid.id === selectedCurrentUser.id) ?? defaultKid,
        )
      : (userList.find((user) => user.id === selectedCurrentUser.id) ??
        selectedCurrentUser);
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

    clearMagicLinkSession();
    setAccessSessionStatus({ state: 'idle' });
    setSelectedCurrentUser(nextCurrentUser);
  };
  const resetCurrentUser = () => {
    clearMagicLinkSession();
    setAccessSessionStatus({ state: 'idle' });
    setSelectedCurrentUser(guestUser);
  };
  const addRegisteredKid = async (registration: RegistrationInput) => {
    if (isRemoteDataLayer) {
      const registeredKid = await saveRemoteRegisteredKid({
        ...registration,
        lastKnownKidId: kidList.at(-1)?.id,
      });

      setKidList((currentKids) => mergeKid(currentKids, registeredKid));

      return registeredKid;
    }

    const kidId = getNextKidId(kidList, conferenceJson.kidIdPrefix);
    const registeredKid: Kid = {
      age: registration.age,
      gender: registration.gender,
      id: kidId,
      language: registration.language,
      name: registration.nickname.trim(),
    };

    setKidList((currentKids) => [...currentKids, registeredKid]);
    setPassportActivitiesByUser((currentPassportActivities) => ({
      ...currentPassportActivities,
      [registeredKid.id]: emptyPassportTemplate,
    }));

    return registeredKid;
  };
  const addPrize = (title: string) => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      throw new Error('Prize title cannot be empty');
    }

    const createdPrize: Prize = {
      given: 0,
      id: createPrizeId(prizeList),
      initialUnits: 1,
      kind: 'normal',
      title: trimmedTitle,
    };

    setPrizeList((currentPrizes) => [...currentPrizes, createdPrize]);

    if (isRemoteDataLayer) {
      saveRemotePrize(undefined, { title: trimmedTitle })
        .then((response) => {
          setPrizeList(clonePrizes(response.prizes));
        })
        .catch((error) => {
          console.error('Unable to save remote prize.', error);
        });
    }

    return createdPrize;
  };
  const getPassportForKid = (kidId: string): PassportData => ({
    activities: passportActivitiesByUser[kidId] ?? [],
  });
  const getWheelShotSummaryForKid = (kidId: string): WheelShotSummary => {
    const kidActivities = passportActivitiesByUser[kidId];
    const awards = prizeAwards
      .filter((award) => award.kidId === kidId)
      .map((award) => {
        const prize = prizes.find((entry) => entry.id === award.prizeId);

        return {
          ...award,
          prizeKind: prize?.kind ?? 'normal',
          prizeTitle: prize?.title ?? award.prizeId,
        };
      });

    if (!kidActivities) {
      if (isRemoteDataLayer) {
      return {
        availableShots: 0,
        awards,
        completionAward: awards.find(
          (award) => award.source === 'passportCompletion',
        ),
        earnedShots: 0,
        usedShots: awards.filter(isWheelAward).length,
      };
      }

      throw new Error(`Unknown passport kid: ${kidId}`);
    }

    const completedActivities = kidActivities.filter(
      (activity) => activity.completedAt,
    ).length;
    const spinEligibleActivities = Math.min(
      completedActivities,
      Math.max(kidActivities.length - 1, 0),
    );
    const earnedShots = Math.floor(spinEligibleActivities / 4);
    const usedShots = awards.filter(isWheelAward).length;

    return {
      availableShots: Math.max(earnedShots - usedShots, 0),
      awards,
      completionAward: awards.find(
        (award) => award.source === 'passportCompletion',
      ),
      earnedShots,
      usedShots,
    };
  };
  const rememberKid = (kid: Kid) => {
    setKidList((currentKids) => mergeKid(currentKids, kid));

    return kid;
  };
  const findRemoteKid = async (rawKid: string) => {
    const remoteKid = await fetchRemoteKid(rawKid);

    return remoteKid ? rememberKid(remoteKid) : undefined;
  };
  const findKidById = async (kidId: string) => {
    const trimmedKidId = kidId.trim();

    if (!trimmedKidId) {
      return undefined;
    }

    const knownKid = kidList.find(
      (kid) => kid.id.toLowerCase() === trimmedKidId.toLowerCase(),
    );

    if (knownKid) {
      return knownKid;
    }

    return isRemoteDataLayer ? findRemoteKid(trimmedKidId) : undefined;
  };
  const findKidByManualNumber = async (rawSearchValue: string) => {
    const searchedNumber = Number(rawSearchValue);

    if (!Number.isInteger(searchedNumber)) {
      return undefined;
    }

    const knownKid = kidList.find(
      (kid) => getKidSequenceNumber(kid.id) === searchedNumber,
    );

    if (knownKid) {
      return knownKid;
    }

    return isRemoteDataLayer ? findRemoteKid(rawSearchValue) : undefined;
  };
  const findKidByQrIdData = async (qrPayload: string) => {
    const kidId = parseKidQrPayload(qrPayload);

    return kidId ? findKidById(kidId) : undefined;
  };
  const reloadPassportActivities = (kidId?: string) => {
    if (isRemoteDataLayer) {
      const requestedKidId =
        kidId ?? (currentUser.role === 'kid' ? currentUser.id : undefined);

      if (requestedKidId) {
        loadRemotePassportForKid(requestedKidId);
      }

      return;
    }

    setPassportActivitiesByUser((currentPassportActivities) =>
      clonePassportActivities(currentPassportActivities),
    );
  };
  const reloadPassportActivitiesForKids = async (kidIds: string[]) => {
    const uniqueKidIds = [...new Set(kidIds.map((kidId) => kidId.trim()))].filter(
      Boolean,
    );

    if (uniqueKidIds.length === 0) {
      return;
    }

    if (isRemoteDataLayer) {
      applyRemotePassports(await fetchRemotePassports(uniqueKidIds));
      return;
    }

    setPassportActivitiesByUser((currentPassportActivities) =>
      clonePassportActivities(currentPassportActivities),
    );
  };
  const reloadPrizeAwardsForKid = (kidId: string) => {
    if (isRemoteDataLayer) {
      loadRemotePrizeAwardsForKid(kidId);
    }
  };
  const refreshPrizes = () => {
    const refreshedPrizes = isRemoteDataLayer
      ? prizeList
      : syncPrizeGivenCache(prizeList, prizeAwards);

    setPrizeList(refreshedPrizes);

    if (isRemoteDataLayer) {
      persistRemoteSnapshot(fetchRemoteDataSnapshot());
    }

    return refreshedPrizes;
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

    if (isRemoteDataLayer) {
      saveRemotePassportActivity(kidId, activityId)
        .then((remotePassportActivities) => {
          applyRemotePassport(kidId, remotePassportActivities);
        })
        .catch((error) => {
          console.error('Unable to save remote passport activity.', error);
        });
    }

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

    if (
      !prizes.some(
        (prize) => prize.kind !== 'final' && getPrizeRemaining(prize) > 0,
      )
    ) {
      throw new Error('No prizes remaining');
    }

    const prize = prizes.find((entry) => entry.id === prizeId);

    if (!prize) {
      throw new Error(`Unknown prize: ${prizeId}`);
    }

    if (prize.kind === 'final') {
      throw new Error(`Prize is reserved for passport completion: ${prizeId}`);
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

    const nextPrizeAwards = [...prizeAwards, award];

    setPrizeAwards(nextPrizeAwards);
    setPrizeList((currentPrizes) =>
      isRemoteDataLayer
        ? currentPrizes.map((entry) =>
            entry.id === prizeId ? { ...entry, given: entry.given + 1 } : entry,
          )
        : syncPrizeGivenCache(currentPrizes, nextPrizeAwards),
    );

    if (isRemoteDataLayer) {
      saveRemotePrizeAward(kidId, prizeId)
        .then((awards) => {
          applyRemotePrizeAwards(kidId, awards);
          refreshPrizes();
        })
        .catch((error) => {
          console.error('Unable to save remote prize award.', error);
        });
    }

    return award;
  };
  const awardPassportCompletionPrize = (kidId: string) => {
    if (!kidList.some((kid) => kid.id === kidId)) {
      throw new Error(`Unknown kid: ${kidId}`);
    }

    const kidActivities = passportActivitiesByUser[kidId];

    if (!kidActivities) {
      throw new Error(`Unknown passport kid: ${kidId}`);
    }

    if (!kidActivities.every((activity) => activity.completedAt)) {
      throw new Error(`Passport is not complete: ${kidId}`);
    }

    const existingAward = prizeAwards.find(
      (award) => award.kidId === kidId && award.source === 'passportCompletion',
    );

    if (existingAward) {
      return existingAward;
    }

    const prize = prizes.find((entry) => entry.kind === 'final');

    if (!prize) {
      throw new Error('No final prize configured');
    }

    if (getPrizeRemaining(prize) <= 0) {
      throw new Error(`Prize is out of stock: ${prize.id}`);
    }

    const award: PrizeAward = {
      awardedAt: new Date().toISOString(),
      id: `${kidId}-passport-complete-${Date.now()}`,
      kidId,
      prizeId: prize.id,
      source: 'passportCompletion',
    };
    const nextPrizeAwards = [...prizeAwards, award];

    setPrizeAwards(nextPrizeAwards);
    setPrizeList((currentPrizes) =>
      isRemoteDataLayer
        ? currentPrizes.map((entry) =>
            entry.id === prize.id ? { ...entry, given: entry.given + 1 } : entry,
          )
        : syncPrizeGivenCache(currentPrizes, nextPrizeAwards),
    );

    if (isRemoteDataLayer) {
      saveRemotePrizeAward(kidId, prize.id, 'passportCompletion')
        .then((awards) => {
          applyRemotePrizeAwards(kidId, awards);
          refreshPrizes();
        })
        .catch((error) => {
          console.error('Unable to save remote passport completion prize.', error);
        });
    }

    return award;
  };
  const updatePrize = (prizeId: string, updates: PrizeSettingsUpdate) => {
    setPrizeList((currentPrizes) => {
      if (!currentPrizes.some((prize) => prize.id === prizeId)) {
        throw new Error(`Unknown prize: ${prizeId}`);
      }

      return currentPrizes.map((prize) => {
        if (prize.id !== prizeId) {
          return prize;
        }

        const title = updates.title ?? prize.title;
        const initialUnits = Math.max(
          normalizePrizeCount(updates.initialUnits ?? prize.initialUnits),
          getPrizeGiven(prizeAwards, prizeId),
        );

        if (!title.trim()) {
          throw new Error(`Prize title cannot be empty: ${prizeId}`);
        }

        return {
          ...prize,
          given: getPrizeGiven(prizeAwards, prizeId),
          initialUnits,
          kind: updates.kind ?? prize.kind,
          title: title.trim(),
        };
      });
    });

    if (isRemoteDataLayer) {
      saveRemotePrize(prizeId, updates)
        .then((response) => {
          setPrizeList(clonePrizes(response.prizes));
        })
        .catch((error) => {
          console.error('Unable to update remote prize.', error);
        });
    }
  };
  const value = useMemo<DataLayerContextValue>(
    () => ({
      accessSessionStatus,
      activities: initialActivities,
      addRegisteredKid,
      addPrize,
      awardPassportCompletionPrize,
      awardPrizeToKid,
      conference: conferenceJson,
      currentUser,
      findKidById,
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
      prizes,
      refreshPrizes,
      reloadPassportActivities,
      reloadPassportActivitiesForKids,
      reloadPrizeAwardsForKid,
      resetCurrentUser,
      setCurrentUser,
      updatePrize,
      users: userList,
    }),
    [
      currentUser,
      kidList,
      passportActivitiesByUser,
      prizes,
      userList,
      accessSessionStatus,
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

export function useAccessSessionStatus() {
  return useDataLayer().accessSessionStatus;
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

export function useFindKidById() {
  return useDataLayer().findKidById;
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

export function useReloadPassportActivitiesForKids() {
  return useDataLayer().reloadPassportActivitiesForKids;
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

export function useAddPrize() {
  return useDataLayer().addPrize;
}

export function useMarkPassportActivityDone() {
  return useDataLayer().markPassportActivityDone;
}

export function usePrizesData() {
  return useDataLayer().prizes;
}

export function useRefreshPrizes() {
  return useDataLayer().refreshPrizes;
}

export function useReloadPrizeAwardsForKid() {
  return useDataLayer().reloadPrizeAwardsForKid;
}

export function useGetWheelShotSummaryForKid() {
  return useDataLayer().getWheelShotSummaryForKid;
}

export function useAwardPrizeToKid() {
  return useDataLayer().awardPrizeToKid;
}

export function useAwardPassportCompletionPrize() {
  return useDataLayer().awardPassportCompletionPrize;
}

export function useUpdatePrize() {
  return useDataLayer().updatePrize;
}

export function useSetCurrentUser() {
  return useDataLayer().setCurrentUser;
}

export function useResetCurrentUser() {
  return useDataLayer().resetCurrentUser;
}
