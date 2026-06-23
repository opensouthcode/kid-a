import type {
  Kid,
  PassportActivity,
  Prize,
  PrizeAward,
  PrizeAwardSource,
  PrizeSettingsUpdate,
  UserRole,
} from './data-model';
import { magicLinkRequestHeaders } from '../access/magic-links';
import type { RegistrationInput } from '../utils/kid-registration';
export type RemoteDataSnapshot = {
  kids: Kid[];
  prizes: Prize[];
};

type RemotePrizeResponse = {
  prize?: Prize;
  prizes: Prize[];
};

export type RemoteMagicLinkSession = {
  activityId?: number;
  createdAt: string;
  expiresAt: string;
  role: UserRole;
};

export type CreatedRemoteMagicLink = {
  activityId?: number;
  expiresAt: string;
  role: UserRole;
  token: string;
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

export async function fetchRemoteDataSnapshot(): Promise<RemoteDataSnapshot> {
  const headers = magicLinkRequestHeaders();
  const requestInit = { cache: 'no-store', headers } satisfies RequestInit;
  const [kids, prizes] = await Promise.all([
    fetch(buildApiUrl('/kids'), requestInit).then((response) =>
      readJsonResponse<Kid[]>(response),
    ),
    fetch(buildApiUrl('/wheel-prizes'), requestInit).then((response) =>
      readJsonResponse<Prize[]>(response),
    ),
  ]);

  return {
    kids,
    prizes,
  };
}

export async function fetchRemotePassport(kidId: string) {
  const response = await fetch(
    buildApiUrl(`/passport?kid=${encodeURIComponent(kidId)}`),
    {
      cache: 'no-store',
      headers: magicLinkRequestHeaders(),
    },
  );

  return readJsonResponse<PassportActivity[]>(response);
}

export async function fetchRemotePrizeAwardsForKid(kidId: string) {
  const response = await fetch(
    buildApiUrl(`/prizes-kid?kid=${encodeURIComponent(kidId)}`),
    {
      cache: 'no-store',
      headers: magicLinkRequestHeaders(),
    },
  );

  return readJsonResponse<PrizeAward[]>(response);
}

export async function fetchRemoteMagicLinkSession() {
  const response = await fetch(buildApiUrl('/auth/session'), {
    headers: magicLinkRequestHeaders(),
  });

  return readJsonResponse<RemoteMagicLinkSession>(response);
}

export async function verifyRemoteAdminPassword(password: string) {
  const response = await fetch(buildApiUrl('/admin/session'), {
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': password,
    },
    method: 'POST',
  });

  return readJsonResponse<{ ok: true }>(response);
}

export async function createRemoteMagicLink({
  activityId,
  durationDays,
  password,
  role,
}: {
  activityId?: number;
  durationDays: number;
  password: string;
  role: UserRole;
}) {
  const response = await fetch(buildApiUrl('/admin/magic-links'), {
    body: JSON.stringify({ activityId, durationDays, role }),
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': password,
    },
    method: 'POST',
  });

  return readJsonResponse<CreatedRemoteMagicLink>(response);
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
      headers: magicLinkRequestHeaders(),
      method: 'POST',
    },
  );

  return readJsonResponse<PassportActivity[]>(response);
}

export async function saveRemoteRegisteredKid(
  registration: RegistrationInput & { lastKnownKidId?: string },
) {
  const response = await fetch(buildApiUrl('/kids'), {
    body: JSON.stringify(registration),
    headers: {
      'Content-Type': 'application/json',
      ...magicLinkRequestHeaders(),
    },
    method: 'POST',
  });

  return readJsonResponse<Kid>(response);
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
      ...magicLinkRequestHeaders(),
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
      `/prizes-kid?kid=${encodeURIComponent(kidId)}&stock=${encodeURIComponent(
        prizeId,
      )}`,
    ),
    {
      body: JSON.stringify({ source }),
      headers: {
        'Content-Type': 'application/json',
        ...magicLinkRequestHeaders(),
      },
      method: 'POST',
    },
  );

  return readJsonResponse<PrizeAward[]>(response);
}
