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
  id: string;
  name: string;
  role: UserRole;
};

type DataLayerContextValue = {
  conference: ConferenceData;
  passport: PassportData;
  user: UserData;
  users: UserData[];
  setCurrentUserId: (userId: string) => void;
};

const users: UserData[] = usersJson as UserData[];
const passportActivitiesByUser =
  passportActivitiesJson as PassportActivitiesByUser;
const currentUserStorageKey = 'kid-a.currentUserId';

function getDefaultUser() {
  const defaultUser = users.find((user) => user.role === 'kid') ?? users[0];

  if (!defaultUser) {
    throw new Error('users.json must include at least one user');
  }

  return defaultUser;
}

const defaultUser = getDefaultUser();

const missingKidPassportUsers = users.filter(
  (user) => user.role === 'kid' && !passportActivitiesByUser[user.id],
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

  if (users.some((user) => user.id === storedUserId)) {
    return storedUserId;
  }

  return defaultUser.id;
}

const DataLayerContext = createContext<DataLayerContextValue | undefined>(
  undefined,
);

export function DataLayerProvider({ children }: PropsWithChildren) {
  const [currentUserId, setSelectedUserId] = useState(getStoredUserId);
  const currentUser =
    users.find((user) => user.id === currentUserId) ?? defaultUser;
  const setCurrentUserId = (userId: string) => {
    if (!users.some((user) => user.id === userId)) {
      throw new Error(`Unknown user: ${userId}`);
    }

    window.localStorage.setItem(currentUserStorageKey, userId);
    setSelectedUserId(userId);
  };
  const value = useMemo<DataLayerContextValue>(
    () => ({
      conference: conferenceJson,
      passport: {
        activities: passportActivitiesByUser[currentUser.id] ?? [],
      },
      setCurrentUserId,
      user: currentUser,
      users,
    }),
    [currentUser],
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

export function useSetCurrentUser() {
  return useDataLayer().setCurrentUserId;
}
