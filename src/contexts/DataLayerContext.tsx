import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import conferenceJson from '../data/conference.json';
import kidsJson from '../data/kids.json';
import passportActivitiesJson from '../data/passportActivities.json';
import usersJson from '../data/users.json';
import type { KidGender, RegistrationInput } from '../registration';
import type { Locale } from '../i18n/messages';

export type ConferenceData = {
  shortName: string;
  title: string;
};

export type PassportActivity = {
  id: number;
  isCompleted: boolean;
};

export type PassportData = {
  activities: PassportActivity[];
};

type PassportActivitiesByKid = Record<string, PassportActivity[]>;

export type UserRole = 'desk' | 'wheel' | 'lead';

export type UserData = {
  id: string;
  name: string;
  role: UserRole;
};

export type KidData = {
  age: number;
  gender: KidGender;
  id: string;
  languagePreference: Locale;
  name: string;
};

type DataLayerContextValue = {
  addRegisteredKid: (registration: RegistrationInput) => KidData;
  conference: ConferenceData;
  kid: KidData;
  kids: KidData[];
  passport: PassportData;
  user: UserData;
  users: UserData[];
  setCurrentKidId: (kidId: string) => void;
  setCurrentUserId: (userId: string) => void;
};

const initialKids: KidData[] = kidsJson as KidData[];
const initialUsers: UserData[] = usersJson as UserData[];
const initialPassportActivitiesByUser =
  passportActivitiesJson as PassportActivitiesByKid;
const currentKidStorageKey = 'kid-a.currentKidId';
const currentUserStorageKey = 'kid-a.currentUserId';

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

function getStoredUserId() {
  const storedUserId = window.localStorage.getItem(currentUserStorageKey);

  if (initialUsers.some((user) => user.id === storedUserId)) {
    return storedUserId;
  }

  return defaultUser.id;
}

function getStoredKidId() {
  const storedKidId = window.localStorage.getItem(currentKidStorageKey);

  if (initialKids.some((kid) => kid.id === storedKidId)) {
    return storedKidId;
  }

  return defaultKid.id;
}

const emptyPassportTemplate =
  Object.values(initialPassportActivitiesByUser)[0]?.map((activity) => ({
    id: activity.id,
    isCompleted: false,
  })) ?? [];

function normalizeKidId(nickname: string) {
  const normalizedId = nickname
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalizedId || `kid-${Date.now().toString(36)}`;
}

function getAvailableKidId(nickname: string, existingKids: KidData[]) {
  const baseId = normalizeKidId(nickname);
  const existingIds = new Set(existingKids.map((kid) => kid.id.toLowerCase()));
  let nextId = baseId;
  let suffix = 2;

  while (existingIds.has(nextId.toLowerCase())) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

const DataLayerContext = createContext<DataLayerContextValue | undefined>(
  undefined,
);

export function DataLayerProvider({ children }: PropsWithChildren) {
  const [kidList, setKidList] = useState(initialKids);
  const [userList] = useState(initialUsers);
  const [passportActivitiesByUser, setPassportActivitiesByUser] = useState(
    initialPassportActivitiesByUser,
  );
  const [currentKidId, setSelectedKidId] = useState(getStoredKidId);
  const [currentUserId, setSelectedUserId] = useState(getStoredUserId);
  const currentKid = kidList.find((kid) => kid.id === currentKidId) ?? defaultKid;
  const currentUser =
    userList.find((user) => user.id === currentUserId) ?? defaultUser;
  const setCurrentKidId = (kidId: string) => {
    if (!kidList.some((kid) => kid.id === kidId)) {
      throw new Error(`Unknown kid: ${kidId}`);
    }

    window.localStorage.setItem(currentKidStorageKey, kidId);
    setSelectedKidId(kidId);
  };
  const setCurrentUserId = (userId: string) => {
    if (!userList.some((user) => user.id === userId)) {
      throw new Error(`Unknown user: ${userId}`);
    }

    window.localStorage.setItem(currentUserStorageKey, userId);
    setSelectedUserId(userId);
  };
  const addRegisteredKid = (registration: RegistrationInput) => {
    const registeredKid: KidData = {
      age: registration.age,
      gender: registration.gender,
      id: getAvailableKidId(registration.nickname, kidList),
      languagePreference: registration.languagePreference,
      name: registration.nickname.trim(),
    };

    setKidList((currentKids) => [...currentKids, registeredKid]);
    setPassportActivitiesByUser((currentPassportActivities) => ({
      ...currentPassportActivities,
      [registeredKid.id]: emptyPassportTemplate,
    }));

    return registeredKid;
  };
  const value = useMemo<DataLayerContextValue>(
    () => ({
      addRegisteredKid,
      conference: conferenceJson,
      kid: currentKid,
      kids: kidList,
      passport: {
        activities: passportActivitiesByUser[currentKid.id] ?? [],
      },
      setCurrentKidId,
      setCurrentUserId,
      user: currentUser,
      users: userList,
    }),
    [currentKid, currentUser, kidList, passportActivitiesByUser, userList],
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

export function useKidData() {
  return useDataLayer().kid;
}

export function useKidsData() {
  return useDataLayer().kids;
}

export function usePassportData() {
  return useDataLayer().passport;
}

export function useUserData() {
  return useDataLayer().user;
}

export function useUsersData() {
  return useDataLayer().users;
}

export function useAddRegisteredKid() {
  return useDataLayer().addRegisteredKid;
}

export function useSetCurrentKid() {
  return useDataLayer().setCurrentKidId;
}

export function useSetCurrentUser() {
  return useDataLayer().setCurrentUserId;
}
