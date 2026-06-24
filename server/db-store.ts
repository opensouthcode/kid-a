import { getConnectionString } from '@netlify/database';
import type {
  NeonQueryFunction,
  NeonQueryFunctionInTransaction,
} from '@neondatabase/serverless';
import { neon } from '@neondatabase/serverless';
import type {
  MagicLinkTokenRecord,
  MagicLinkTokenStore,
} from './access-tokens.js';
import {
  KidIdAllocationError,
  PrizeOutOfStockError,
  syncPrizeGivenCache,
  UnknownPrizeError,
  type AwardPrizeCommand,
  type CompletePassportActivityCommand,
  type RegisterKidCommand,
  type SavePrizeCommand,
  type StoreAdapter,
  type WritableStoreData,
} from './store.js';
import type {
  ConferenceData,
  Kid,
  PassportActivitiesByKid,
  PassportActivity,
  Prize,
  PrizeAward,
  StoreData,
} from './types.js';

export type SqlClient = NeonQueryFunction<false, false>;
type TransactionSql = NeonQueryFunctionInTransaction<false, false>;
type Row = Record<string, unknown>;

const kidRegistrationRetryDelayMs = 250;
const maxKidRegistrationAttempts = 20;
const generatedIdLookahead = 1000;

function isPostgresUrl(value: string | undefined): value is string {
  return value?.startsWith('postgres://') === true ||
    value?.startsWith('postgresql://') === true;
}

export function createSqlClient() {
  const connectionString = [
    process.env.NETLIFY_DB_URL,
    process.env.NETLIFY_DATABASE_URL,
    process.env.DATABASE_URL,
  ].find(isPostgresUrl);
  const netlifyConnectionString = connectionString ?? getConnectionString();

  if (!isPostgresUrl(netlifyConnectionString)) {
    throw new Error(
      'Netlify Database is not configured with a Postgres connection URL. Run `netlify database status` and ensure the database is enabled.',
    );
  }

  return neon(netlifyConnectionString);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function asString(value: unknown, label: string) {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${label} to be a string`);
  }

  return value;
}

function asOptionalString(value: unknown, label: string) {
  if (value === null || value === undefined) {
    return undefined;
  }

  return asString(value, label);
}

function asNumber(value: unknown, label: string) {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${label} to be a number`);
  }

  return value;
}

function asBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${label} to be a boolean`);
  }

  return value;
}

function mapConference(row: Row | undefined): ConferenceData {
  if (!row) {
    throw new Error('Missing Netlify DB conference_settings row');
  }

  return {
    kidIdPrefix: asString(row.kid_id_prefix, 'conference_settings.kid_id_prefix'),
    shortName: asString(row.short_name, 'conference_settings.short_name'),
    title: asString(row.title, 'conference_settings.title'),
  };
}

function mapKid(row: Row): Kid {
  return {
    age: asNumber(row.age, 'kids.age'),
    gender: asString(row.gender, 'kids.gender'),
    id: asString(row.id, 'kids.id'),
    language: asString(row.language, 'kids.language'),
    name: asString(row.name, 'kids.name'),
  };
}

function mapPrize(row: Row): Prize {
  return {
    given: asNumber(row.given, 'prizes.given'),
    id: asString(row.id, 'prizes.id'),
    initialUnits: asNumber(row.initial_units, 'prizes.initial_units'),
    kind: asString(row.kind, 'prizes.kind') as Prize['kind'],
    title: asString(row.title, 'prizes.title'),
  };
}

function mapPrizeAward(row: Row): PrizeAward {
  const source = asOptionalString(row.source, 'prize_awards.source');

  return {
    awardedAt: asString(row.awarded_at, 'prize_awards.awarded_at'),
    id: asString(row.id, 'prize_awards.id'),
    kidId: asString(row.kid_id, 'prize_awards.kid_id'),
    prizeId: asString(row.prize_id, 'prize_awards.prize_id'),
    ...(source ? { source: source as PrizeAward['source'] } : {}),
  };
}

function mapMagicToken(row: Row): MagicLinkTokenRecord {
  const activityId =
    row.activity_id === null || row.activity_id === undefined
      ? undefined
      : asNumber(row.activity_id, 'magic_link_tokens.activity_id');

  return {
    ...(activityId ? { activityId } : {}),
    createdAt: asString(row.created_at, 'magic_link_tokens.created_at'),
    expiresAt: asString(row.expires_at, 'magic_link_tokens.expires_at'),
    role: asString(row.role, 'magic_link_tokens.role') as MagicLinkTokenRecord['role'],
    tokenHash: asString(row.token_hash, 'magic_link_tokens.token_hash'),
  };
}

function getPassportTemplate(passportActivitiesByKid: PassportActivitiesByKid) {
  return (
    Object.values(passportActivitiesByKid)[0]?.map((activity) => ({
      id: activity.id,
    })) ?? []
  );
}

function buildPassports(kids: Kid[], passportRows: Row[]): PassportActivitiesByKid {
  const passports: PassportActivitiesByKid = {};

  for (const row of passportRows) {
    const kidId = asString(row.kid_id, 'passport_activities.kid_id');
    const activity: PassportActivity = {
      id: asNumber(row.activity_id, 'passport_activities.activity_id'),
      ...(row.completed_at
        ? {
            completedAt: asString(
              row.completed_at,
              'passport_activities.completed_at',
            ),
          }
        : {}),
    };

    passports[kidId] ??= [];
    passports[kidId].push(activity);
  }

  for (const passport of Object.values(passports)) {
    passport.sort((left, right) => left.id - right.id);
  }

  const template = getPassportTemplate(passports);
  for (const kid of kids) {
    passports[kid.id] ??= template.map((activity) => ({ ...activity }));
  }

  return passports;
}

function prizeResponse(snapshot: StoreData, prizeId?: string) {
  return {
    prize: prizeId ? snapshot.prizes.find((prize) => prize.id === prizeId) : undefined,
    prizeAwards: snapshot.prizeAwards,
    prizes: snapshot.prizes,
  };
}

function passportQueries(
  tx: TransactionSql,
  kidId: string,
  passport: PassportActivity[],
) {
  return [
    tx`DELETE FROM passport_activities WHERE kid_id = ${kidId}`,
    ...passport.map(
      (activity) => tx`
        INSERT INTO passport_activities (kid_id, activity_id, completed_at)
        VALUES (${kidId}, ${activity.id}, ${activity.completedAt ?? null}::timestamptz)
      `,
    ),
  ];
}

function prizeAwardQueries(tx: TransactionSql, prizeAwards: PrizeAward[]) {
  return [
    tx`DELETE FROM prize_awards`,
    ...prizeAwards.map(
      (award) => tx`
        INSERT INTO prize_awards (id, kid_id, prize_id, source, awarded_at)
        VALUES (
          ${award.id},
          ${award.kidId},
          ${award.prizeId},
          ${award.source ?? null},
          ${award.awardedAt}::timestamptz
        )
        ON CONFLICT DO NOTHING
      `,
    ),
  ];
}

function prizeQueries(tx: TransactionSql, prizes: Prize[]) {
  return [
    tx`DELETE FROM prizes`,
    ...prizes.map(
      (prize) => tx`
        INSERT INTO prizes (id, title, kind, initial_units)
        VALUES (${prize.id}, ${prize.title}, ${prize.kind}, ${prize.initialUnits})
        ON CONFLICT (id) DO UPDATE
        SET title = EXCLUDED.title,
            kind = EXCLUDED.kind,
            initial_units = EXCLUDED.initial_units
      `,
    ),
  ];
}

export function createDbStore(sql: SqlClient = createSqlClient()): StoreAdapter {
  async function readSnapshot(): Promise<StoreData> {
    const [conferenceRows, kidRows, passportRows, prizeRows, prizeAwardRows] =
      await Promise.all([
        sql`
          SELECT kid_id_prefix, short_name, title
          FROM conference_settings
          WHERE id = 'default'
        `,
        sql`
          SELECT id, name, age, gender, language
          FROM kids
          ORDER BY id
        `,
        sql`
          SELECT kid_id, activity_id, completed_at::text AS completed_at
          FROM passport_activities
          ORDER BY kid_id, activity_id
        `,
        sql`
          SELECT
            p.id,
            p.title,
            p.kind,
            p.initial_units,
            COALESCE(COUNT(a.id), 0)::integer AS given
          FROM prizes p
          LEFT JOIN prize_awards a ON a.prize_id = p.id
          GROUP BY p.id, p.title, p.kind, p.initial_units
          ORDER BY p.id
        `,
        sql`
          SELECT id, kid_id, prize_id, source, awarded_at::text AS awarded_at
          FROM prize_awards
          ORDER BY awarded_at, id
        `,
      ]);

    const kids = (kidRows as Row[]).map(mapKid);

    return {
      conference: mapConference((conferenceRows as Row[])[0]),
      kids,
      passportActivitiesByKid: buildPassports(kids, passportRows as Row[]),
      prizeAwards: (prizeAwardRows as Row[]).map(mapPrizeAward),
      prizes: (prizeRows as Row[]).map(mapPrize),
    };
  }

  async function registerKid(command: RegisterKidCommand) {
    for (let attempt = 1; attempt <= maxKidRegistrationAttempts; attempt += 1) {
      const rows = (await sql`
        WITH settings AS (
          SELECT kid_id_prefix
          FROM conference_settings
          WHERE id = 'default'
        ),
        bounds AS (
          SELECT (COUNT(*)::integer + 1) AS start_at
          FROM kids
        ),
        candidate AS (
          SELECT
            settings.kid_id_prefix ||
              lpad(candidate_sequence::text, 4, '0') AS id
          FROM settings, bounds,
            generate_series(
              bounds.start_at,
              bounds.start_at + ${generatedIdLookahead}
            ) AS candidate(candidate_sequence)
          WHERE NOT EXISTS (
            SELECT 1
            FROM kids
            WHERE lower(kids.id) = lower(
              settings.kid_id_prefix ||
                lpad(candidate_sequence::text, 4, '0')
            )
          )
          ORDER BY candidate_sequence
          LIMIT 1
        ),
        inserted_kid AS (
          INSERT INTO kids (id, name, age, gender, language)
          SELECT
            candidate.id,
            ${command.name},
            ${command.age},
            ${command.gender},
            ${command.language}
          FROM candidate
          WHERE lower(candidate.id) <> ${command.lastKnownKidId ?? ''}
          ON CONFLICT DO NOTHING
          RETURNING id, name, age, gender, language
        ),
        template_kid AS (
          SELECT kid_id
          FROM passport_activities
          ORDER BY kid_id
          LIMIT 1
        ),
        inserted_passport AS (
          INSERT INTO passport_activities (kid_id, activity_id)
          SELECT inserted_kid.id, passport_activities.activity_id
          FROM inserted_kid
          JOIN template_kid ON true
          JOIN passport_activities
            ON passport_activities.kid_id = template_kid.kid_id
          ON CONFLICT DO NOTHING
        )
        SELECT id, name, age, gender, language
        FROM inserted_kid
      `) as Row[];

      if (rows[0]) {
        return mapKid(rows[0]);
      }

      if (attempt < maxKidRegistrationAttempts) {
        await delay(kidRegistrationRetryDelayMs);
      }
    }

    throw new KidIdAllocationError();
  }

  async function completePassportActivity(command: CompletePassportActivityCommand) {
    await sql`
      INSERT INTO passport_activities (kid_id, activity_id, completed_at)
      VALUES (${command.kidId}, ${command.activityId}, ${command.completedAt}::timestamptz)
      ON CONFLICT (kid_id, activity_id) DO UPDATE
      SET completed_at = COALESCE(
        passport_activities.completed_at,
        EXCLUDED.completed_at
      )
    `;

    const snapshot = await readSnapshot();
    return snapshot.passportActivitiesByKid[command.kidId] ?? [];
  }

  async function savePrize(command: SavePrizeCommand) {
    if (command.type === 'create') {
      let createdPrizeId: string | undefined;

      for (let attempt = 1; attempt <= maxKidRegistrationAttempts; attempt += 1) {
        const rows = (await sql`
          WITH bounds AS (
            SELECT (COUNT(*)::integer + 1) AS start_at
            FROM prizes
          ),
          candidate AS (
            SELECT 'prize-' || candidate_sequence::text AS id
            FROM bounds,
              generate_series(
                bounds.start_at,
                bounds.start_at + ${generatedIdLookahead}
              ) AS candidate(candidate_sequence)
            WHERE NOT EXISTS (
              SELECT 1
              FROM prizes
              WHERE prizes.id = 'prize-' || candidate_sequence::text
            )
            ORDER BY candidate_sequence
            LIMIT 1
          )
          INSERT INTO prizes (id, title, kind, initial_units)
          SELECT candidate.id, ${command.title}, 'normal', ${command.initialUnits}
          FROM candidate
          ON CONFLICT DO NOTHING
          RETURNING id
        `) as Row[];

        createdPrizeId = asOptionalString(rows[0]?.id, 'prizes.id');

        if (createdPrizeId) {
          const snapshot = await readSnapshot();
          return prizeResponse(snapshot, createdPrizeId);
        }
      }

      throw new Error('Unable to allocate a fresh prize id');
    }

    const rows = (await sql`
      UPDATE prizes
      SET title = COALESCE(${command.title ?? null}, title),
          kind = COALESCE(${command.prizeKind ?? null}, kind),
          initial_units = CASE
            WHEN ${command.initialUnits ?? null}::integer IS NULL THEN initial_units
            ELSE GREATEST(
              ${command.initialUnits ?? null}::integer,
              (
                SELECT COUNT(*)::integer
                FROM prize_awards
                WHERE prize_awards.prize_id = prizes.id
              )
            )
          END
      WHERE id = ${command.prizeId}
      RETURNING id
    `) as Row[];

    if (!rows[0]) {
      throw new UnknownPrizeError(command.prizeId);
    }

    const snapshot = await readSnapshot();
    return prizeResponse(snapshot, command.prizeId);
  }

  async function awardPrize(command: AwardPrizeCommand) {
    const source = command.source ?? null;
    const rows = (await sql`
      WITH locked_prize AS (
        SELECT id, initial_units
        FROM prizes
        WHERE id = ${command.prizeId}
        FOR UPDATE
      ),
      existing_passport_completion AS (
        SELECT 1
        FROM prize_awards
        WHERE ${source} = 'passportCompletion'
          AND kid_id = ${command.kidId}
          AND source = 'passportCompletion'
      ),
      inserted AS (
        INSERT INTO prize_awards (id, kid_id, prize_id, source, awarded_at)
        SELECT
          ${command.awardId},
          ${command.kidId},
          locked_prize.id,
          ${source},
          ${command.awardedAt}::timestamptz
        FROM locked_prize
        WHERE NOT EXISTS (SELECT 1 FROM existing_passport_completion)
          AND (
            SELECT COUNT(*)::integer
            FROM prize_awards
            WHERE prize_awards.prize_id = locked_prize.id
          ) < locked_prize.initial_units
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT
        EXISTS (SELECT 1 FROM locked_prize) AS prize_exists,
        EXISTS (SELECT 1 FROM existing_passport_completion) AS already_awarded,
        (SELECT COUNT(*)::integer FROM inserted) AS inserted_count,
        COALESCE((SELECT initial_units FROM locked_prize), 0)::integer AS initial_units,
        (
          SELECT COUNT(*)::integer
          FROM prize_awards
          WHERE prize_id = ${command.prizeId}
        ) AS given
    `) as Row[];
    const result = rows[0];

    if (!result || !asBoolean(result.prize_exists, 'prize_exists')) {
      throw new UnknownPrizeError(command.prizeId);
    }

    const insertedCount = asNumber(result.inserted_count, 'inserted_count');
    const alreadyAwarded = asBoolean(result.already_awarded, 'already_awarded');
    const given = asNumber(result.given, 'given');
    const initialUnits = asNumber(result.initial_units, 'initial_units');

    if (insertedCount === 0 && !alreadyAwarded && given >= initialUnits) {
      throw new PrizeOutOfStockError(command.prizeId);
    }

    const snapshot = await readSnapshot();
    return snapshot.prizeAwards.filter((award) => award.kidId === command.kidId);
  }

  async function restoreWritableData(data: WritableStoreData) {
    const snapshot = await readSnapshot();
    return resetData({
      ...snapshot,
      passportActivitiesByKid: data.passportActivitiesByKid,
      prizeAwards: data.prizeAwards,
      prizes: syncPrizeGivenCache(data.prizes, data.prizeAwards),
    });
  }

  async function resetData(data: StoreData) {
    await sql.transaction((tx) => [
      tx`DELETE FROM prize_awards`,
      tx`DELETE FROM passport_activities`,
      tx`DELETE FROM prizes`,
      tx`DELETE FROM kids`,
      tx`DELETE FROM conference_settings`,
      tx`
        INSERT INTO conference_settings (id, kid_id_prefix, short_name, title)
        VALUES (
          'default',
          ${data.conference.kidIdPrefix},
          ${data.conference.shortName},
          ${data.conference.title}
        )
      `,
      ...data.kids.map(
        (kid) => tx`
          INSERT INTO kids (id, name, age, gender, language)
          VALUES (${kid.id}, ${kid.name}, ${kid.age}, ${kid.gender}, ${kid.language})
        `,
      ),
      ...Object.entries(data.passportActivitiesByKid).flatMap(([kidId, passport]) =>
        passportQueries(tx, kidId, passport),
      ),
      ...prizeQueries(tx, syncPrizeGivenCache(data.prizes, data.prizeAwards)).slice(1),
      ...prizeAwardQueries(tx, data.prizeAwards).slice(1),
    ]);

    return readSnapshot();
  }

  return {
    awardPrize,
    completePassportActivity,
    readSnapshot,
    registerKid,
    resetData,
    restoreWritableData,
    savePrize,
  };
}

export function createDbMagicTokenStore(sql: SqlClient = createSqlClient()) {
  return {
    async appendToken(token: MagicLinkTokenRecord) {
      await sql`
        INSERT INTO magic_link_tokens (
          token_hash,
          role,
          activity_id,
          created_at,
          expires_at
        )
        VALUES (
          ${token.tokenHash},
          ${token.role},
          ${token.activityId ?? null},
          ${token.createdAt}::timestamptz,
          ${token.expiresAt}::timestamptz
        )
        ON CONFLICT DO NOTHING
      `;
    },
    async readTokens() {
      const rows = (await sql`
        SELECT
          token_hash,
          role,
          activity_id,
          created_at::text AS created_at,
          expires_at::text AS expires_at
        FROM magic_link_tokens
        ORDER BY created_at
      `) as Row[];

      return rows.map(mapMagicToken);
    },
    async writeTokens(tokens: MagicLinkTokenRecord[]) {
      await sql.transaction((tx) => [
        tx`DELETE FROM magic_link_tokens`,
        ...tokens.map(
          (token) => tx`
            INSERT INTO magic_link_tokens (
              token_hash,
              role,
              activity_id,
              created_at,
              expires_at
            )
            VALUES (
              ${token.tokenHash},
              ${token.role},
              ${token.activityId ?? null},
              ${token.createdAt}::timestamptz,
              ${token.expiresAt}::timestamptz
            )
            ON CONFLICT (token_hash) DO UPDATE
            SET role = EXCLUDED.role,
                activity_id = EXCLUDED.activity_id,
                created_at = EXCLUDED.created_at,
                expires_at = EXCLUDED.expires_at
          `,
        ),
      ]);
    },
  } satisfies MagicLinkTokenStore;
}
