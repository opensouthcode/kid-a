import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type LocalDataLayerContextValue = {
  getFriendIds: () => string[];
  isFriend: (friendKidId: string) => boolean;
  toggleFriend: (friendKidId: string) => void;
};

const friendsStorageKey = 'kid-a:local:friends';

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

export function LocalDataLayerProvider({ children }: PropsWithChildren) {
  const [friendIds, setFriendIds] = useState<string[]>(() => readStoredFriends());

  useEffect(() => {
    writeStoredFriends(friendIds);
  }, [friendIds]);

  useEffect(() => {
    const readFriendsFromAnotherTab = (event: StorageEvent) => {
      if (event.key === friendsStorageKey) {
        setFriendIds(readStoredFriends());
      }
    };

    window.addEventListener('storage', readFriendsFromAnotherTab);

    return () => window.removeEventListener('storage', readFriendsFromAnotherTab);
  }, []);

  const value = useMemo<LocalDataLayerContextValue>(
    () => ({
      getFriendIds: () => friendIds,
      isFriend: (friendKidId) => friendIds.includes(friendKidId),
      toggleFriend: (friendKidId) => {
        setFriendIds((currentFriendIds) => {
          const isCurrentFriend = currentFriendIds.includes(friendKidId);
          return isCurrentFriend
            ? currentFriendIds.filter((friendId) => friendId !== friendKidId)
            : [...currentFriendIds, friendKidId];
        });
      },
    }),
    [friendIds],
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
