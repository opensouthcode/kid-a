import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import conferenceJson from '../data/conference.json';
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

type PassportActivitiesByUser = Record<string, PassportActivity[]>;

export type UserRole = 'kid' | 'desk' | 'wheel' | 'lead' | 'parent';

export type UserData = {
  age?: number;
  gender?: KidGender;
  id: string;
  languagePreference?: Locale;
  name: string;
  role: UserRole;
};

type DataLayerContextValue = {
  conference: ConferenceData;
  passport: PassportData;
  user: UserData;
  users: UserData[];
  addRegisteredKid: (registration: RegistrationInput) => UserData;
  setCurrentUserId: (userId: string) => void;
};

const initialUsers: UserData[] = usersJson as UserData[];
const initialPassportActivitiesByUser =
  passportActivitiesJson as PassportActivitiesByUser;
const currentUserStorageKey = 'kid-a.currentUserId';

function getDefaultUser() {
  const defaultUser =
    initialUsers.find((user) => user.role === 'kid') ?? initialUsers[0];

  if (!defaultUser) {
    throw new Error('users.json must include at least one user');
  }

  return defaultUser;
}

const defaultUser = getDefaultUser();

const missingKidPassportUsers = initialUsers.filter(
  (user) => user.role === 'kid' && !initialPassportActivitiesByUser[user.id],
);

if (missingKidPassportUsers.length > 0) {
  throw new Error(
    `passportActivities.json is missing kid users: ${missingKidPassportUsers
      .map((user) => user.id)
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

function getAvailableKidId(nickname: string, existingUsers: UserData[]) {
  const baseId = normalizeKidId(nickname);
  const existingIds = new Set(existingUsers.map((user) => user.id.toLowerCase()));
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
  const [userList, setUserList] = useState(initialUsers);
  const [passportActivitiesByUser, setPassportActivitiesByUser] = useState(
    initialPassportActivitiesByUser,
  );
  const [currentUserId, setSelectedUserId] = useState(getStoredUserId);
  const currentUser =
    userList.find((user) => user.id === currentUserId) ?? defaultUser;
  const setCurrentUserId = (userId: string) => {
    if (!userList.some((user) => user.id === userId)) {
      throw new Error(`Unknown user: ${userId}`);
    }

    window.localStorage.setItem(currentUserStorageKey, userId);
    setSelectedUserId(userId);
  };
  const addRegisteredKid = (registration: RegistrationInput) => {
    const registeredKid: UserData = {
      age: registration.age,
      gender: registration.gender,
      id: getAvailableKidId(registration.nickname, userList),
      languagePreference: registration.languagePreference,
      name: registration.nickname.trim(),
      role: 'kid',
    };

    setUserList((currentUsers) => [...currentUsers, registeredKid]);
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
      passport: {
        activities: passportActivitiesByUser[currentUser.id] ?? [],
      },
      setCurrentUserId,
      user: currentUser,
      users: userList,
    }),
    [currentUser, passportActivitiesByUser, userList],
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

export function useSetCurrentUser() {
  return useDataLayer().setCurrentUserId;
}
