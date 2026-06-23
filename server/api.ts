import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import {
  createMagicLinkToken,
  validateMagicLinkToken,
  type MagicLinkSession,
} from './access-tokens.js';
import { readSnapshot, updatePassportForKid, updateSnapshot } from './store.js';
import type {
  Kid,
  PassportActivitiesByKid,
  PassportActivity,
  Prize,
  PrizeAward,
  PrizeAwardSource,
  PrizeKind,
  StoreData,
  UserRole,
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

type AdminBackup = {
  exportedAt: string;
  passports: PassportActivitiesByKid;
  prizesWon: PrizeAward[];
  wheelPrizes: Prize[];
};

const apiPaths = new Set([
  '/admin/session',
  '/admin/magic-links',
  '/admin/export',
  '/admin/import',
  '/auth/session',
  '/kids',
  '/passport',
  '/wheel-prizes',
  '/prizes-kid',
]);
const kidGenders = new Set(['boy', 'girl', 'preferNotToSay']);
const prizeKinds = new Set<PrizeKind>(['final', 'normal', 'valuable']);
const staffRoles = new Set<UserRole>(['desk', 'lead', 'wheel']);
const supportedLocales = new Set(['en', 'es']);

export function normalizeApiPath(pathname: string) {
  if (pathname.startsWith('/.netlify/functions/api/')) {
    return pathname.replace('/.netlify/functions/api', '') || '/';
  }

  if (pathname === '/.netlify/functions/api') {
    return '/';
  }

  if (pathname.startsWith('/api/')) {
    return pathname.slice('/api'.length) || '/';
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
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, X-Access-Token, X-Admin-Password, X-Admin-Token',
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
      'Cache-Control': 'no-store',
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

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function requireAdminToken(request: ApiRequest) {
  const expectedToken = process.env.KID_A_ADMIN_TOKEN?.trim();

  if (!expectedToken) {
    throw new HttpError(503, 'Admin token is not configured');
  }

  const authorization = getHeader(request.headers, 'authorization');
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = getHeader(request.headers, 'x-admin-token');
  const candidateToken = bearerToken ?? headerToken;

  if (!candidateToken || !constantTimeEquals(candidateToken, expectedToken)) {
    throw new HttpError(401, 'Unauthorized');
  }
}

function requireAdminPassword(
  request: ApiRequest,
  body: Record<string, unknown>,
) {
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!expectedPassword) {
    throw new HttpError(503, 'Admin password is not configured');
  }

  const headerPassword = getHeader(request.headers, 'x-admin-password');
  const bodyPassword = typeof body.password === 'string' ? body.password : undefined;
  const candidatePassword = headerPassword ?? bodyPassword;

  if (
    !candidatePassword ||
    !constantTimeEquals(candidatePassword, expectedPassword)
  ) {
    throw new HttpError(401, 'Unauthorized');
  }
}

function getMagicLinkToken(request: ApiRequest, url: URL, allowQueryToken = false) {
  const authorization = getHeader(request.headers, 'authorization');
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = getHeader(request.headers, 'x-access-token');
  const queryToken = allowQueryToken ? url.searchParams.get('token') : undefined;

  return headerToken ?? bearerToken ?? queryToken ?? undefined;
}

async function requireMagicLink(
  request: ApiRequest,
  url: URL,
  allowedRoles: readonly UserRole[],
  allowQueryToken = false,
): Promise<MagicLinkSession> {
  const token = getMagicLinkToken(request, url, allowQueryToken);

  if (!token) {
    throw new HttpError(401, 'Magic link token is required');
  }

  const session = await validateMagicLinkToken(token);

  if (!session) {
    throw new HttpError(401, 'Magic link token is invalid or expired');
  }

  if (!allowedRoles.includes(session.role)) {
    throw new HttpError(403, 'Magic link cannot access this resource');
  }

  return session;
}

function parsePositiveInteger(value: string | null, label: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${label} must be a positive integer`);
  }

  return numberValue;
}

function normalizeDurationDays(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 1;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 1 || numberValue > 30) {
    throw new HttpError(400, 'durationDays must be between 1 and 30');
  }

  return numberValue;
}

function normalizeStaffRole(value: unknown) {
  if (typeof value !== 'string' || !staffRoles.has(value as UserRole)) {
    throw new HttpError(400, 'role must be desk, lead, or wheel');
  }

  return value as UserRole;
}

function normalizeOptionalActivityId(value: unknown, role: UserRole) {
  if (role !== 'lead') {
    return undefined;
  }

  const activityId = Number(value);

  if (!Number.isInteger(activityId) || activityId <= 0) {
    throw new HttpError(400, 'activityId is required for lead magic links');
  }

  return activityId;
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

function createKidQrIdData(kidId: string) {
  return `kid-a:${kidId}`;
}

function getNextKidId(existingKids: Kid[], kidIdPrefix: string) {
  const existingIds = new Set(existingKids.map((kid) => kid.id.toLowerCase()));
  let sequence = existingKids.length + 1;
  let nextId = `${kidIdPrefix}${sequence.toString().padStart(4, '0')}`;

  while (existingIds.has(nextId.toLowerCase())) {
    sequence += 1;
    nextId = `${kidIdPrefix}${sequence.toString().padStart(4, '0')}`;
  }

  return nextId;
}

function passportResponse(
  passportActivitiesByKid: PassportActivitiesByKid,
  kidId: string,
): PassportActivity[] {
  return passportActivitiesByKid[kidId] ?? passportTemplate(passportActivitiesByKid);
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

function createAdminBackup(snapshot: StoreData): AdminBackup {
  return {
    exportedAt: new Date().toISOString(),
    passports: snapshot.passportActivitiesByKid,
    prizesWon: snapshot.prizeAwards,
    wheelPrizes: syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards),
  };
}

function asObject(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${label} must be a non-empty string`);
  }

  return value;
}

function asArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an array`);
  }

  return value;
}

function normalizePassportActivity(value: unknown, label: string): PassportActivity {
  const activity = asObject(value, label);
  const id = normalizeCount(activity.id, `${label}.id`);

  if (id <= 0) {
    throw new HttpError(400, `${label}.id must be a positive integer`);
  }

  if (
    activity.completedAt !== undefined &&
    typeof activity.completedAt !== 'string'
  ) {
    throw new HttpError(400, `${label}.completedAt must be a string`);
  }

  return {
    ...(activity.completedAt ? { completedAt: activity.completedAt } : {}),
    id,
  };
}

function normalizeBackupPassports(value: unknown): PassportActivitiesByKid {
  const passports = asObject(value, 'passports');

  return Object.fromEntries(
    Object.entries(passports).map(([kidId, passport]) => [
      kidId,
      asArray(passport, `passports.${kidId}`).map((activity, index) =>
        normalizePassportActivity(activity, `passports.${kidId}.${index}`),
      ),
    ]),
  );
}

function normalizeBackupPrizes(value: unknown): Prize[] {
  return asArray(value, 'wheelPrizes').map((entry, index) => {
    const prize = asObject(entry, `wheelPrizes.${index}`);
    const kind = normalizePrizeKind(prize.kind);

    if (!kind) {
      throw new HttpError(400, `wheelPrizes.${index}.kind is required`);
    }

    return {
      given: normalizeCount(prize.given, `wheelPrizes.${index}.given`),
      id: asString(prize.id, `wheelPrizes.${index}.id`),
      initialUnits: normalizeCount(
        prize.initialUnits,
        `wheelPrizes.${index}.initialUnits`,
      ),
      kind,
      title: asString(prize.title, `wheelPrizes.${index}.title`),
    };
  });
}

function normalizeBackupPrizeAwards(value: unknown): PrizeAward[] {
  return asArray(value, 'prizesWon').map((entry, index) => {
    const award = asObject(entry, `prizesWon.${index}`);
    const source = normalizeAwardSource(award.source);

    return {
      awardedAt: asString(award.awardedAt, `prizesWon.${index}.awardedAt`),
      id: asString(award.id, `prizesWon.${index}.id`),
      kidId: asString(award.kidId, `prizesWon.${index}.kidId`),
      prizeId: asString(award.prizeId, `prizesWon.${index}.prizeId`),
      ...(source ? { source } : {}),
    };
  });
}

function normalizeRegistrationInput(value: unknown) {
  const registration = asObject(value, 'registration');
  const nickname = asString(registration.nickname, 'nickname').trim();
  const age = normalizeCount(registration.age, 'age');
  const gender = asString(registration.gender, 'gender');
  const language = asString(registration.language, 'language');

  if (!nickname) {
    throw new HttpError(400, 'nickname must be a non-empty string');
  }

  if (!kidGenders.has(gender)) {
    throw new HttpError(400, 'gender must be boy, girl, or preferNotToSay');
  }

  if (!supportedLocales.has(language)) {
    throw new HttpError(400, 'language must be en or es');
  }

  return {
    age,
    gender,
    language,
    nickname,
  };
}

function parseAdminBackup(body: Record<string, unknown>): AdminBackup {
  return {
    exportedAt: asString(body.exportedAt, 'exportedAt'),
    passports: normalizeBackupPassports(body.passports),
    prizesWon: normalizeBackupPrizeAwards(body.prizesWon),
    wheelPrizes: normalizeBackupPrizes(body.wheelPrizes),
  };
}

async function handleKids(request: ApiRequest, url: URL): Promise<ApiResponse> {
  void url;

  if (request.method === 'GET') {
    await requireMagicLink(request, url, [...staffRoles]);

    const snapshot = await readSnapshot();
    return jsonResponse(request, 200, snapshot.kids);
  }

  if (request.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  await requireMagicLink(request, url, ['desk']);

  const registration = normalizeRegistrationInput(parseJsonBody(request.body));
  const response = await updateSnapshot((snapshot) => {
    const kidId = getNextKidId(snapshot.kids, snapshot.conference.kidIdPrefix);
    const kid: Kid = {
      age: registration.age,
      gender: registration.gender,
      id: kidId,
      language: registration.language,
      name: registration.nickname,
      qrIdData: createKidQrIdData(kidId),
    };
    const passport = passportTemplate(snapshot.passportActivitiesByKid);

    snapshot.kids.push(kid);
    snapshot.passportActivitiesByKid[kid.id] = passport;

    return kid;
  }, ['kids', 'passportActivitiesByKid']);

  return jsonResponse(request, 201, response);
}

async function handleAdmin(
  request: ApiRequest,
  path: string,
): Promise<ApiResponse> {
  if (path === '/admin/session') {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed');
    }

    requireAdminPassword(request, parseJsonBody(request.body));

    return jsonResponse(request, 200, { ok: true });
  }

  if (path === '/admin/magic-links') {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed');
    }

    const body = parseJsonBody(request.body);
    requireAdminPassword(request, body);

    const role = normalizeStaffRole(body.role);
    const activityId = normalizeOptionalActivityId(body.activityId, role);
    const durationDays = normalizeDurationDays(body.durationDays);
    const createdMagicLink = await createMagicLinkToken(
      { ...(activityId ? { activityId } : {}), role },
      durationDays * 24 * 60 * 60 * 1000,
    );

    return jsonResponse(request, 201, {
      activityId: createdMagicLink.activityId,
      expiresAt: createdMagicLink.expiresAt,
      role: createdMagicLink.role,
      token: createdMagicLink.token,
    });
  }

  requireAdminToken(request);

  if (path === '/admin/export') {
    if (request.method !== 'GET') {
      throw new HttpError(405, 'Method not allowed');
    }

    const snapshot = await readSnapshot();
    return jsonResponse(request, 200, createAdminBackup(snapshot));
  }

  if (path === '/admin/import') {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed');
    }

    const backup = parseAdminBackup(parseJsonBody(request.body));
    const restoredBackup = await updateSnapshot((snapshot) => {
      snapshot.passportActivitiesByKid = backup.passports;
      snapshot.prizeAwards = backup.prizesWon;
      snapshot.prizes = syncPrizeGivenCache(backup.wheelPrizes, backup.prizesWon);

      return createAdminBackup(snapshot);
    }, ['passportActivitiesByKid', 'prizeAwards', 'prizes']);

    return jsonResponse(request, 200, restoredBackup);
  }

  throw new HttpError(404, 'Not found');
}

async function handleAuth(
  request: ApiRequest,
  url: URL,
  path: string,
): Promise<ApiResponse> {
  if (path !== '/auth/session') {
    throw new HttpError(404, 'Not found');
  }

  if (request.method !== 'GET') {
    throw new HttpError(405, 'Method not allowed');
  }

  const session = await requireMagicLink(
    request,
    url,
    [...staffRoles],
    true,
  );

  return jsonResponse(request, 200, session);
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
    await requireMagicLink(request, url, [...staffRoles]);

    const snapshot = await readSnapshot();
    const kidId = normalizeKidId(url.searchParams.get('kid'), snapshot);

    return jsonResponse(
      request,
      200,
      passportResponse(snapshot.passportActivitiesByKid, kidId),
    );
  }

  if (request.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const activityId = parsePositiveInteger(url.searchParams.get('activity'), 'activity');
  const session = await requireMagicLink(request, url, ['lead']);

  if (session.activityId !== activityId) {
    throw new HttpError(403, 'Lead magic link cannot manage this activity');
  }

  const snapshot = await readSnapshot();
  const kidId = normalizeKidId(url.searchParams.get('kid'), snapshot);

  const passport = await updatePassportForKid(kidId, (snapshot) => {
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

    return passport;
  });

  return jsonResponse(request, 200, passport);
}

async function handleWheelPrizes(
  request: ApiRequest,
  url: URL,
): Promise<ApiResponse> {
  if (request.method === 'GET') {
    await requireMagicLink(request, url, [...staffRoles]);

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

  await requireMagicLink(request, url, ['wheel']);

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

async function handlePrizesKid(
  request: ApiRequest,
  url: URL,
): Promise<ApiResponse> {
  if (request.method === 'GET') {
    await requireMagicLink(request, url, [...staffRoles]);

    const snapshot = await readSnapshot();
    const kidId = normalizeKidId(url.searchParams.get('kid'), snapshot);
    return jsonResponse(
      request,
      200,
      snapshot.prizeAwards.filter((award) => award.kidId === kidId),
    );
  }

  if (request.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  await requireMagicLink(request, url, ['wheel']);

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
        return snapshot.prizeAwards.filter((award) => award.kidId === kidId);
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

    return snapshot.prizeAwards.filter((award) => award.kidId === kidId);
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

    if (path === '/auth/session') {
      return await handleAuth(request, requestUrl, path);
    }

    if (path === '/kids') {
      return await handleKids(request, requestUrl);
    }

    if (path === '/wheel-prizes') {
      return await handleWheelPrizes(request, requestUrl);
    }

    if (path === '/prizes-kid') {
      return await handlePrizesKid(request, requestUrl);
    }

    if (path.startsWith('/admin/')) {
      return await handleAdmin(request, path);
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
