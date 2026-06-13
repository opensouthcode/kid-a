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
  language: Locale;
  name: string;
};

export type CurrentUser =
  | {
      kid: KidData;
      role: 'kid';
    }
  | {
      role: UserRole;
      user: UserData;
    };

type DataLayerContextValue = {
  addRegisteredKid: (registration: RegistrationInput) => KidData;
  conference: ConferenceData;
  currentUser: CurrentUser;
  kid: KidData;
  kids: KidData[];
  passport: PassportData;
  users: UserData[];
  setCurrentUser: (user: KidData | UserData) => void;
};

const initialKids: KidData[] = kidsJson as KidData[];
const initialUsers: UserData[] = usersJson as UserData[];
const initialPassportActivitiesByUser =
  passportActivitiesJson as PassportActivitiesByKid;
const currentUserStorageKey = 'kid-a.currentUser';

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

function wrapKid(kid: KidData): CurrentUser {
  return {
    kid,
    role: 'kid',
  };
}

function wrapUser(user: UserData): CurrentUser {
  return {
    role: user.role,
    user,
  };
}

function getCurrentUserStorageValue(currentUser: CurrentUser) {
  return currentUser.role === 'kid'
    ? `kid:${currentUser.kid.id}`
    : `user:${currentUser.user.id}`;
}

function getStoredCurrentUser() {
  const storedCurrentUser = window.localStorage.getItem(currentUserStorageKey);
  const [type, id] = storedCurrentUser?.split(':') ?? [];

  if (type === 'kid') {
    const storedKid = initialKids.find((kid) => kid.id === id);

    if (storedKid) {
      return wrapKid(storedKid);
    }
  }

  if (type === 'user') {
    const storedUser = initialUsers.find((user) => user.id === id);

    if (storedUser) {
      return wrapUser(storedUser);
    }
  }

  return wrapKid(defaultKid);
}

const emptyPassportTemplate =
  Object.values(initialPassportActivitiesByUser)[0]?.map((activity) => ({
    id: activity.id,
    isCompleted: false,
  })) ?? [];

const generatedKidIdPrefix = '26OSK';

function getNextKidId(existingKids: KidData[]) {
  const existingIds = new Set(existingKids.map((kid) => kid.id.toLowerCase()));
  let sequence = existingKids.length + 1;
  let nextId = `${generatedKidIdPrefix}${sequence.toString().padStart(4, '0')}`;

  while (existingIds.has(nextId.toLowerCase())) {
    sequence += 1;
    nextId = `${generatedKidIdPrefix}${sequence.toString().padStart(4, '0')}`;
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
  const [selectedCurrentUser, setSelectedCurrentUser] =
    useState(getStoredCurrentUser);
  const currentUser =
    selectedCurrentUser.role === 'kid'
      ? wrapKid(
          kidList.find((kid) => kid.id === selectedCurrentUser.kid.id) ??
            defaultKid,
        )
      : wrapUser(
          userList.find((user) => user.id === selectedCurrentUser.user.id) ??
            defaultUser,
        );
  const currentKid = currentUser.role === 'kid' ? currentUser.kid : defaultKid;
  const setCurrentUser = (nextUser: KidData | UserData) => {
    const nextCurrentUser =
      'role' in nextUser ? wrapUser(nextUser) : wrapKid(nextUser);

    if (
      nextCurrentUser.role === 'kid' &&
      !kidList.some((kid) => kid.id === nextCurrentUser.kid.id)
    ) {
      throw new Error(`Unknown kid: ${nextCurrentUser.kid.id}`);
    }

    if (
      nextCurrentUser.role !== 'kid' &&
      !userList.some((user) => user.id === nextCurrentUser.user.id)
    ) {
      throw new Error(`Unknown user: ${nextCurrentUser.user.id}`);
    }

    window.localStorage.setItem(
      currentUserStorageKey,
      getCurrentUserStorageValue(nextCurrentUser),
    );
    setSelectedCurrentUser(nextCurrentUser);
  };
  const addRegisteredKid = (registration: RegistrationInput) => {
    const registeredKid: KidData = {
      age: registration.age,
      gender: registration.gender,
      id: getNextKidId(kidList),
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
  const value = useMemo<DataLayerContextValue>(
    () => ({
      addRegisteredKid,
      conference: conferenceJson,
      currentUser,
      kid: currentKid,
      kids: kidList,
      passport: {
        activities: passportActivitiesByUser[currentKid.id] ?? [],
      },
      setCurrentUser,
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

export function useCurrentUser() {
  return useDataLayer().currentUser;
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

export function useUsersData() {
  return useDataLayer().users;
}

export function useAddRegisteredKid() {
  return useDataLayer().addRegisteredKid;
}

export function useSetCurrentUser() {
  return useDataLayer().setCurrentUser;
}
