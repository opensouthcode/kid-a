import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { readSnapshot, updateSnapshot } from './store.js';
import type {
  PassportActivitiesByKid,
  PassportActivity,
  Prize,
  PrizeAward,
  PrizeAwardSource,
  PrizeKind,
  StoreData,
} from './types.js';

export type ApiRequest = {
  body?: string | null;
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
  method: string;
  url: string;
};

export type ApiResponse = {
  body?: string;
  headers?: Record<string, string>;
  status: number;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const apiPaths = new Set(['/passport', '/wheel-prizes', '/prizes-won']);
const prizeKinds = new Set<PrizeKind>(['final', 'normal', 'valuable']);

export function normalizeApiPath(pathname: string) {
  if (pathname.startsWith('/.netlify/functions/api/')) {
    return pathname.replace('/.netlify/functions/api', '') || '/';
  }

  if (pathname === '/.netlify/functions/api') {
    return '/';
  }

  if (pathname.startsWith('/kid-a/')) {
    return pathname.slice('/kid-a'.length) || '/';
  }

  return pathname;
}

export function isApiPath(pathname: string) {
  return apiPaths.has(normalizeApiPath(pathname));
}

function getHeader(
  headers: ApiRequest['headers'],
  name: string,
): string | undefined {
  const header = headers?.[name] ?? headers?.[name.toLowerCase()];

  return Array.isArray(header) ? header[0] : header;
}

function corsHeaders(request: ApiRequest): Record<string, string> {
  const origin = getHeader(request.headers, 'origin');

  if (!origin) {
    return {};
  }

  const allowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(
    origin,
  );

  if (!allowedOrigin) {
    return {};
  }

  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

function jsonResponse(
  request: ApiRequest,
  status: number,
  value: unknown,
): ApiResponse {
  return {
    body: JSON.stringify(value),
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
    },
    status,
  };
}

function emptyResponse(request: ApiRequest, status: number): ApiResponse {
  return {
    headers: corsHeaders(request),
    status,
  };
}

function parseJsonBody(body: string | null | undefined) {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

function parsePositiveInteger(value: string | null, label: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${label} must be a positive integer`);
  }

  return numberValue;
}

function normalizeCount(value: unknown, label: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new HttpError(400, `${label} must be a number`);
  }

  return Math.max(0, Math.floor(numberValue));
}

function normalizeKidId(rawKid: string | null, snapshot: StoreData) {
  const trimmedKid = rawKid?.trim();

  if (!trimmedKid) {
    throw new HttpError(400, 'kid is required');
  }

  const withoutQrPrefix = trimmedKid.startsWith('kid-a:')
    ? trimmedKid.slice('kid-a:'.length)
    : trimmedKid;
  const candidate = /^\d+$/.test(withoutQrPrefix)
    ? `${snapshot.conference.kidIdPrefix}${Number(withoutQrPrefix)
        .toString()
        .padStart(4, '0')}`
    : withoutQrPrefix;
  const knownKid = snapshot.kids.find(
    (kid) => kid.id.toLowerCase() === candidate.toLowerCase(),
  );
  const knownPassportKid = Object.keys(snapshot.passportActivitiesByKid).find(
    (kidId) => kidId.toLowerCase() === candidate.toLowerCase(),
  );

  return knownKid?.id ?? knownPassportKid ?? candidate.toUpperCase();
}

function passportTemplate(
  passportActivitiesByKid: PassportActivitiesByKid,
): PassportActivity[] {
  return (
    Object.values(passportActivitiesByKid)[0]?.map((activity) => ({
      id: activity.id,
    })) ?? []
  );
}

function ensurePassportForKid(
  passportActivitiesByKid: PassportActivitiesByKid,
  kidId: string,
  activityId: number,
) {
  const existingPassport = passportActivitiesByKid[kidId];

  if (existingPassport) {
    return existingPassport;
  }

  const template = passportTemplate(passportActivitiesByKid);
  const passport =
    template.length > 0 ? template : ([{ id: activityId }] satisfies PassportActivity[]);

  passportActivitiesByKid[kidId] = passport;
  return passport;
}

function getPrizeGiven(prizeAwards: PrizeAward[], prizeId: string) {
  return prizeAwards.filter((award) => award.prizeId === prizeId).length;
}

function syncPrizeGivenCache(prizes: Prize[], prizeAwards: PrizeAward[]) {
  return prizes.map((prize) => ({
    ...prize,
    given: getPrizeGiven(prizeAwards, prize.id),
  }));
}

function getPrizeRemaining(prize: Prize) {
  return Math.max(prize.initialUnits - prize.given, 0);
}

function normalizePrizeKind(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !prizeKinds.has(value as PrizeKind)) {
    throw new HttpError(400, 'kind must be final, normal, or valuable');
  }

  return value as PrizeKind;
}

function createPrizeId(prizes: Prize[]) {
  let suffix = prizes.length + 1;
  let candidate = `prize-${suffix}`;

  while (prizes.some((prize) => prize.id === candidate)) {
    suffix += 1;
    candidate = `prize-${suffix}`;
  }

  return candidate;
}

function snapshotPrizeResponse(snapshot: StoreData, prize?: Prize) {
  return {
    prize,
    prizeAwards: snapshot.prizeAwards,
    prizes: syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards),
  };
}

async function handlePassport(
  request: ApiRequest,
  url: URL,
  path: string,
): Promise<ApiResponse> {
  if (path !== '/passport') {
    throw new HttpError(404, 'Not found');
  }

  if (request.method === 'GET') {
    const snapshot = await readSnapshot();
    return jsonResponse(request, 200, snapshot.passportActivitiesByKid);
  }

  if (request.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const activityId = parsePositiveInteger(url.searchParams.get('activity'), 'activity');

  const passportActivitiesByKid = await updateSnapshot((snapshot) => {
    const kidId = normalizeKidId(url.searchParams.get('kid'), snapshot);
    const passport = ensurePassportForKid(
      snapshot.passportActivitiesByKid,
      kidId,
      activityId,
    );
    const matchingActivity = passport.find((activity) => activity.id === activityId);

    if (matchingActivity) {
      matchingActivity.completedAt ??= new Date().toISOString();
    } else {
      passport.push({ completedAt: new Date().toISOString(), id: activityId });
      passport.sort((left, right) => left.id - right.id);
    }

    return snapshot.passportActivitiesByKid;
  }, ['passportActivitiesByKid']);

  return jsonResponse(request, 200, passportActivitiesByKid);
}

async function handleWheelPrizes(
  request: ApiRequest,
  url: URL,
): Promise<ApiResponse> {
  if (request.method === 'GET') {
    const snapshot = await readSnapshot();
    return jsonResponse(
      request,
      200,
      syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards),
    );
  }

  if (request.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const body = parseJsonBody(request.body);
  const stock = url.searchParams.get('stock')?.trim();

  const response = await updateSnapshot((snapshot) => {
    const syncedPrizes = syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards);

    if (!stock) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        throw new HttpError(400, 'title is required when stock is omitted');
      }

      const initialUnits =
        body.initialUnits === undefined
          ? 1
          : normalizeCount(body.initialUnits, 'initialUnits');
      const prize: Prize = {
        given: 0,
        id: createPrizeId(snapshot.prizes),
        initialUnits,
        kind: 'normal',
        title: body.title.trim(),
      };

      snapshot.prizes.push(prize);
      return snapshotPrizeResponse(snapshot, prize);
    }

    const prize = syncedPrizes.find((entry) => entry.id === stock);

    if (!prize) {
      throw new HttpError(404, `Unknown prize: ${stock}`);
    }

    const title = body.title === undefined ? prize.title : String(body.title).trim();

    if (!title) {
      throw new HttpError(400, 'title cannot be empty');
    }

    const kind = normalizePrizeKind(body.kind) ?? prize.kind;
    const initialUnits =
      body.initialUnits === undefined
        ? prize.initialUnits
        : Math.max(
            normalizeCount(body.initialUnits, 'initialUnits'),
            getPrizeGiven(snapshot.prizeAwards, prize.id),
          );

    snapshot.prizes = snapshot.prizes.map((entry) =>
      entry.id === prize.id
        ? {
            ...entry,
            given: getPrizeGiven(snapshot.prizeAwards, prize.id),
            initialUnits,
            kind,
            title,
          }
        : entry,
    );

    return snapshotPrizeResponse(
      snapshot,
      snapshot.prizes.find((entry) => entry.id === prize.id),
    );
  }, ['prizes']);

  return jsonResponse(request, 200, response);
}

function normalizeAwardSource(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value !== 'passportCompletion' && value !== 'wheel') {
    throw new HttpError(400, 'source must be passportCompletion or wheel');
  }

  return value as PrizeAwardSource;
}

async function handlePrizesWon(
  request: ApiRequest,
  url: URL,
): Promise<ApiResponse> {
  if (request.method === 'GET') {
    const snapshot = await readSnapshot();
    const kid = url.searchParams.get('kid');

    if (!kid) {
      return jsonResponse(request, 200, snapshot.prizeAwards);
    }

    const kidId = normalizeKidId(kid, snapshot);
    return jsonResponse(
      request,
      200,
      snapshot.prizeAwards.filter((award) => award.kidId === kidId),
    );
  }

  if (request.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const body = parseJsonBody(request.body);
  const stock = url.searchParams.get('stock')?.trim();

  if (!stock) {
    throw new HttpError(400, 'stock is required');
  }

  const response = await updateSnapshot((snapshot) => {
    const kidId = normalizeKidId(url.searchParams.get('kid'), snapshot);
    const source = normalizeAwardSource(body.source);
    const syncedPrizes = syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards);
    const prize = syncedPrizes.find((entry) => entry.id === stock);

    if (!prize) {
      throw new HttpError(404, `Unknown prize: ${stock}`);
    }

    if (source === 'passportCompletion') {
      const existingAward = snapshot.prizeAwards.find(
        (award) => award.kidId === kidId && award.source === 'passportCompletion',
      );

      if (existingAward) {
        return {
          award: existingAward,
          prizeAwards: snapshot.prizeAwards,
          prizes: syncedPrizes,
        };
      }
    }

    if (getPrizeRemaining(prize) <= 0) {
      throw new HttpError(409, `Prize is out of stock: ${stock}`);
    }

    const award: PrizeAward = {
      awardedAt: new Date().toISOString(),
      id: `${kidId}-${source === 'passportCompletion' ? 'passport-complete' : 'wheel'}-${randomUUID()}`,
      kidId,
      prizeId: prize.id,
      ...(source ? { source } : {}),
    };

    snapshot.prizeAwards.push(award);

    return {
      award,
      prizeAwards: snapshot.prizeAwards,
      prizes: syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards),
    };
  }, ['prizeAwards']);

  return jsonResponse(request, 200, response);
}

export async function handleApiRequest(request: ApiRequest): Promise<ApiResponse> {
  const requestUrl = new URL(request.url, 'http://kid-a.local');
  const path = normalizeApiPath(requestUrl.pathname);

  if (request.method === 'OPTIONS') {
    return emptyResponse(request, 204);
  }

  try {
    if (path === '/passport') {
      return await handlePassport(request, requestUrl, path);
    }

    if (path === '/wheel-prizes') {
      return await handleWheelPrizes(request, requestUrl);
    }

    if (path === '/prizes-won') {
      return await handlePrizesWon(request, requestUrl);
    }

    throw new HttpError(404, 'Not found');
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(request, error.status, { error: error.message });
    }

    console.error(error);
    return jsonResponse(request, 500, { error: 'Internal server error' });
  }
}
