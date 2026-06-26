import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Kid } from '../data/data-model';
import { useI18n } from '../i18n/I18nProvider';

type LocalDataLayerContextValue = {
  getFriendIds: () => string[];
  getFriendKids: () => Kid[];
  isFriend: (friendKidId: string) => boolean;
  toggleFriend: (friendKid: Kid) => void;
};

const friendsStorageKey = 'kid-a:local:friends';
const friendKidsStorageKey = 'kid-a:local:friend-kids';

type StorageReadResult<T> =
  | { data: T; kind: 'ok' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' };

const LocalDataLayerContext = createContext<
  LocalDataLayerContextValue | undefined
>(undefined);

function dedupeFriendIds(friendIds: string[]) {
  return friendIds.filter(
    (friendId, index, allFriendIds) => allFriendIds.indexOf(friendId) === index,
  );
}

function readStoredFriends(): StorageReadResult<string[]> {
  const storedFriends = window.localStorage.getItem(friendsStorageKey);

  if (!storedFriends) {
    return { kind: 'empty' };
  }

  try {
    const parsedFriends: unknown = JSON.parse(storedFriends);

    if (Array.isArray(parsedFriends)) {
      return {
        data: dedupeFriendIds(
          parsedFriends.filter((friendId) => typeof friendId === 'string'),
        ),
        kind: 'ok',
      };
    }

    return { kind: 'error', message: 'Invalid local friends data' };
  } catch {
    return { kind: 'error', message: 'Unreadable local friends data' };
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

function readStoredFriendKids(): StorageReadResult<Record<string, Kid>> {
  const storedFriendKids = window.localStorage.getItem(friendKidsStorageKey);

  if (!storedFriendKids) {
    return { kind: 'empty' };
  }

  try {
    const parsedFriendKids: unknown = JSON.parse(storedFriendKids);

    if (Array.isArray(parsedFriendKids)) {
      return {
        data: Object.fromEntries(
          parsedFriendKids.filter(isStoredKid).map((kid) => [kid.id, kid]),
        ),
        kind: 'ok',
      };
    }

    if (parsedFriendKids && typeof parsedFriendKids === 'object') {
      return {
        data: Object.fromEntries(
          Object.values(parsedFriendKids)
            .filter(isStoredKid)
            .map((kid) => [kid.id, kid]),
        ),
        kind: 'ok',
      };
    }

    return { kind: 'error', message: 'Invalid local friend kids data' };
  } catch {
    return { kind: 'error', message: 'Unreadable local friend kids data' };
  }
}

function writeStoredFriendKids(friendKidsById: Record<string, Kid>) {
  window.localStorage.setItem(
    friendKidsStorageKey,
    JSON.stringify(Object.values(friendKidsById)),
  );
}

function clearLocalStorageKidA() {
  const keysToRemove: string[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);

    if (key?.startsWith('kid-a:')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}

type StorageError = { messages: string[] };

function collectStorageErrors(): StorageError | null {
  const friendsResult = readStoredFriends();
  const friendKidsResult = readStoredFriendKids();
  const errorMessages: string[] = [];

  if (friendsResult.kind === 'error') {
    errorMessages.push(friendsResult.message);
  }

  if (friendKidsResult.kind === 'error') {
    errorMessages.push(friendKidsResult.message);
  }

  return errorMessages.length > 0 ? { messages: errorMessages } : null;
}

function StorageErrorBanner({
  error,
  onDismiss,
}: {
  error: StorageError;
  onDismiss: () => void;
}) {
  const { t } = useI18n();

  function handleClear() {
    clearLocalStorageKidA();
    onDismiss();
  }

  return (
    <div
      className="storage-error-banner"
      role="alert"
      title={error.messages.join('; ')}
    >
      <p className="storage-error-text">{t('storage.error.notice')}</p>
      <div className="storage-error-actions">
        <button
          className="storage-error-clear btn"
          onClick={handleClear}
          type="button"
        >
          {t('storage.error.clear')}
        </button>
        <button
          className="storage-error-dismiss"
          onClick={onDismiss}
          type="button"
        >
          {t('storage.error.dismiss')}
        </button>
      </div>
    </div>
  );
}

export function LocalDataLayerProvider({ children }: PropsWithChildren) {
  const [friendIds, setFriendIds] = useState<string[]>(() => {
    const result = readStoredFriends();
    return result.kind === 'ok' ? result.data : [];
  });
  const [friendKidsById, setFriendKidsById] = useState<Record<string, Kid>>(
    () => {
      const result = readStoredFriendKids();
      return result.kind === 'ok' ? result.data : {};
    },
  );
  const [storageError, setStorageError] = useState<StorageError | null>(() =>
    collectStorageErrors(),
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
        const result = readStoredFriends();
        setFriendIds(result.kind === 'ok' ? result.data : []);
      }

      if (event.key === friendKidsStorageKey) {
        const result = readStoredFriendKids();
        setFriendKidsById(result.kind === 'ok' ? result.data : {});
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
      {storageError && (
        <StorageErrorBanner
          error={storageError}
          onDismiss={() => setStorageError(null)}
        />
      )}
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
