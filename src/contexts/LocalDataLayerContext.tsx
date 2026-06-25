import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Kid } from '../data/data-model';

type LocalDataLayerContextValue = {
  getFriendIds: () => string[];
  getFriendKids: () => Kid[];
  isFriend: (friendKidId: string) => boolean;
  toggleFriend: (friendKid: Kid) => void;
};

const friendsStorageKey = 'kid-a:local:friends';
const friendKidsStorageKey = 'kid-a:local:friend-kids';

const LocalDataLayerContext = createContext<
  LocalDataLayerContextValue | undefined
>(undefined);

function dedupeFriendIds(friendIds: string[]) {
  return friendIds.filter(
    (friendId, index, allFriendIds) => allFriendIds.indexOf(friendId) === index,
  );
}

function readStoredFriends(): string[] {
  const storedFriends = window.localStorage.getItem(friendsStorageKey);

  if (!storedFriends) {
    return [];
  }

  try {
    const parsedFriends: unknown = JSON.parse(storedFriends);

    if (Array.isArray(parsedFriends)) {
      return dedupeFriendIds(
        parsedFriends.filter((friendId) => typeof friendId === 'string'),
      );
    }

    console.warn('Ignoring invalid local friends data.');
    return [];
  } catch (error) {
    console.warn('Ignoring unreadable local friends data.', error);
    return [];
  }
}

function writeStoredFriends(friends: string[]) {
  window.localStorage.setItem(friendsStorageKey, JSON.stringify(friends));
}

function isStoredKid(value: unknown): value is Kid {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Kid).age === 'number' &&
    typeof (value as Kid).gender === 'string' &&
    typeof (value as Kid).id === 'string' &&
    typeof (value as Kid).language === 'string' &&
    typeof (value as Kid).name === 'string'
  );
}

function readStoredFriendKids(): Record<string, Kid> {
  const storedFriendKids = window.localStorage.getItem(friendKidsStorageKey);

  if (!storedFriendKids) {
    return {};
  }

  try {
    const parsedFriendKids: unknown = JSON.parse(storedFriendKids);

    if (Array.isArray(parsedFriendKids)) {
      return Object.fromEntries(
        parsedFriendKids
          .filter(isStoredKid)
          .map((kid) => [kid.id, kid]),
      );
    }

    if (parsedFriendKids && typeof parsedFriendKids === 'object') {
      return Object.fromEntries(
        Object.values(parsedFriendKids)
          .filter(isStoredKid)
          .map((kid) => [kid.id, kid]),
      );
    }

    console.warn('Ignoring invalid local friend kids data.');
    return {};
  } catch (error) {
    console.warn('Ignoring unreadable local friend kids data.', error);
    return {};
  }
}

function writeStoredFriendKids(friendKidsById: Record<string, Kid>) {
  window.localStorage.setItem(
    friendKidsStorageKey,
    JSON.stringify(Object.values(friendKidsById)),
  );
}

export function LocalDataLayerProvider({ children }: PropsWithChildren) {
  const [friendIds, setFriendIds] = useState<string[]>(() => readStoredFriends());
  const [friendKidsById, setFriendKidsById] = useState<Record<string, Kid>>(
    () => readStoredFriendKids(),
  );

  useEffect(() => {
    writeStoredFriends(friendIds);
  }, [friendIds]);

  useEffect(() => {
    writeStoredFriendKids(friendKidsById);
  }, [friendKidsById]);

  useEffect(() => {
    const readFriendsFromAnotherTab = (event: StorageEvent) => {
      if (event.key === friendsStorageKey) {
        setFriendIds(readStoredFriends());
      }

      if (event.key === friendKidsStorageKey) {
        setFriendKidsById(readStoredFriendKids());
      }
    };

    window.addEventListener('storage', readFriendsFromAnotherTab);

    return () => window.removeEventListener('storage', readFriendsFromAnotherTab);
  }, []);

  const value = useMemo<LocalDataLayerContextValue>(
    () => ({
      getFriendIds: () => friendIds,
      getFriendKids: () =>
        friendIds
          .map((friendId) => friendKidsById[friendId])
          .filter((kid): kid is Kid => kid !== undefined),
      isFriend: (friendKidId) => friendIds.includes(friendKidId),
      toggleFriend: (friendKid) => {
        const isCurrentFriend = friendIds.includes(friendKid.id);

        setFriendIds((currentFriendIds) => {
          return isCurrentFriend
            ? currentFriendIds.filter((friendId) => friendId !== friendKid.id)
            : dedupeFriendIds([...currentFriendIds, friendKid.id]);
        });
        setFriendKidsById((currentFriendKids) => {
          if (isCurrentFriend) {
            const remainingFriendKids = { ...currentFriendKids };
            delete remainingFriendKids[friendKid.id];

            return remainingFriendKids;
          }

          return {
            ...currentFriendKids,
            [friendKid.id]: friendKid,
          };
        });
      },
    }),
    [friendIds, friendKidsById],
  );

  return (
    <LocalDataLayerContext.Provider value={value}>
      {children}
    </LocalDataLayerContext.Provider>
  );
}

function useLocalDataLayer() {
  const context = useContext(LocalDataLayerContext);

  if (!context) {
    throw new Error('useLocalDataLayer must be used within LocalDataLayerProvider');
  }

  return context;
}

export function useGetFriendIds() {
  return useLocalDataLayer().getFriendIds;
}

export function useGetFriendKids() {
  return useLocalDataLayer().getFriendKids;
}

export function useIsFriend() {
  return useLocalDataLayer().isFriend;
}

export function useToggleFriend() {
  return useLocalDataLayer().toggleFriend;
}
