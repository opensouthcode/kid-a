import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type FriendRecord = {
  addedAt: string;
  kidId: string;
};

type LocalDataLayerContextValue = {
  getFriendIds: () => string[];
  isFriend: (friendKidId: string) => boolean;
  toggleFriend: (friendKidId: string) => void;
};

const friendsStorageKey = 'kid-a:local:friends';

const LocalDataLayerContext = createContext<
  LocalDataLayerContextValue | undefined
>(undefined);

function isFriendRecord(value: unknown): value is FriendRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kidId' in value &&
    'addedAt' in value &&
    typeof value.kidId === 'string' &&
    typeof value.addedAt === 'string'
  );
}

function sortFriendsByAddedOrder(friends: FriendRecord[]) {
  return friends.sort(
    (firstFriend, secondFriend) =>
      new Date(firstFriend.addedAt).getTime() -
      new Date(secondFriend.addedAt).getTime(),
  );
}

function dedupeFriends(friends: FriendRecord[]) {
  return sortFriendsByAddedOrder(friends).filter(
    (friend, index, sortedFriends) =>
      sortedFriends.findIndex((entry) => entry.kidId === friend.kidId) === index,
  );
}

function readStoredFriends(): FriendRecord[] {
  const storedFriends = window.localStorage.getItem(friendsStorageKey);

  if (!storedFriends) {
    return [];
  }

  try {
    const parsedFriends: unknown = JSON.parse(storedFriends);

    if (Array.isArray(parsedFriends)) {
      return dedupeFriends(parsedFriends.filter(isFriendRecord));
    }

    if (typeof parsedFriends === 'object' && parsedFriends !== null) {
      return dedupeFriends(
        Object.values(parsedFriends)
          .filter(Array.isArray)
          .flat()
          .filter(isFriendRecord),
      );
    }

    console.warn('Ignoring invalid local friends data.');
    return [];
  } catch (error) {
    console.warn('Ignoring unreadable local friends data.', error);
    return [];
  }
}

function writeStoredFriends(friends: FriendRecord[]) {
  window.localStorage.setItem(friendsStorageKey, JSON.stringify(friends));
}

export function LocalDataLayerProvider({ children }: PropsWithChildren) {
  const [friends, setFriends] = useState<FriendRecord[]>(() => readStoredFriends());

  useEffect(() => {
    writeStoredFriends(friends);
  }, [friends]);

  useEffect(() => {
    const readFriendsFromAnotherTab = (event: StorageEvent) => {
      if (event.key === friendsStorageKey) {
        setFriends(readStoredFriends());
      }
    };

    window.addEventListener('storage', readFriendsFromAnotherTab);

    return () => window.removeEventListener('storage', readFriendsFromAnotherTab);
  }, []);

  const value = useMemo<LocalDataLayerContextValue>(
    () => ({
      getFriendIds: () => friends.map((friend) => friend.kidId),
      isFriend: (friendKidId) =>
        friends.some((friend) => friend.kidId === friendKidId),
      toggleFriend: (friendKidId) => {
        setFriends((currentFriends) => {
          const isCurrentFriend = currentFriends.some(
            (friend) => friend.kidId === friendKidId,
          );
          return isCurrentFriend
            ? currentFriends.filter((friend) => friend.kidId !== friendKidId)
            : [
                ...currentFriends,
                {
                  addedAt: new Date().toISOString(),
                  kidId: friendKidId,
                },
              ];
        });
      },
    }),
    [friends],
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

export function useIsFriend() {
  return useLocalDataLayer().isFriend;
}

export function useToggleFriend() {
  return useLocalDataLayer().toggleFriend;
}
