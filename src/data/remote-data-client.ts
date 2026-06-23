import type {
  PassportActivitiesByKid,
  Prize,
  PrizeAward,
  PrizeAwardSource,
  PrizeSettingsUpdate,
} from './data-model';

const remoteDataCacheKey = 'kid-a:remote:data-cache';

export type RemoteDataSnapshot = {
  passportActivitiesByKid: PassportActivitiesByKid;
  prizeAwards: PrizeAward[];
  prizes: Prize[];
};

type RemotePrizeResponse = {
  prize?: Prize;
  prizeAwards?: PrizeAward[];
  prizes: Prize[];
};

type RemotePrizeAwardResponse = {
  award: PrizeAward;
  prizeAwards: PrizeAward[];
  prizes: Prize[];
};

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
}

function buildApiUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function isRemoteDataLayerEnabled() {
  return import.meta.env.VITE_DATA_LAYER === 'remote';
}

export function readRemoteDataCache(): RemoteDataSnapshot | undefined {
  const cachedData = window.localStorage.getItem(remoteDataCacheKey);

  if (!cachedData) {
    return undefined;
  }

  try {
    return JSON.parse(cachedData) as RemoteDataSnapshot;
  } catch (error) {
    console.warn('Ignoring unreadable remote data cache.', error);
    return undefined;
  }
}

export function writeRemoteDataCache(snapshot: RemoteDataSnapshot) {
  window.localStorage.setItem(remoteDataCacheKey, JSON.stringify(snapshot));
}

export async function fetchRemoteDataSnapshot(): Promise<RemoteDataSnapshot> {
  const requestInit = { cache: 'no-store' } satisfies RequestInit;
  const [passportActivitiesByKid, prizes, prizeAwards] = await Promise.all([
    fetch(buildApiUrl('/passport'), requestInit).then((response) =>
      readJsonResponse<PassportActivitiesByKid>(response),
    ),
    fetch(buildApiUrl('/wheel-prizes'), requestInit).then((response) =>
      readJsonResponse<Prize[]>(response),
    ),
    fetch(buildApiUrl('/prizes-won'), requestInit).then((response) =>
      readJsonResponse<PrizeAward[]>(response),
    ),
  ]);

  return {
    passportActivitiesByKid,
    prizeAwards,
    prizes,
  };
}

export async function saveRemotePassportActivity(
  kidId: string,
  activityId: number,
) {
  const activity = String(activityId).padStart(2, '0');
  const response = await fetch(
    buildApiUrl(
      `/passport?kid=${encodeURIComponent(kidId)}&activity=${encodeURIComponent(
        activity,
      )}`,
    ),
    {
      method: 'POST',
    },
  );

  return readJsonResponse<PassportActivitiesByKid>(response);
}

export async function saveRemotePrize(
  prizeId: string | undefined,
  updates: PrizeSettingsUpdate & { title?: string },
) {
  const query = prizeId ? `?stock=${encodeURIComponent(prizeId)}` : '';
  const response = await fetch(buildApiUrl(`/wheel-prizes${query}`), {
    body: JSON.stringify(updates),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  return readJsonResponse<RemotePrizeResponse>(response);
}

export async function saveRemotePrizeAward(
  kidId: string,
  prizeId: string,
  source?: PrizeAwardSource,
) {
  const response = await fetch(
    buildApiUrl(
      `/prizes-won?kid=${encodeURIComponent(kidId)}&stock=${encodeURIComponent(
        prizeId,
      )}`,
    ),
    {
      body: JSON.stringify({ source }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  return readJsonResponse<RemotePrizeAwardResponse>(response);
}
