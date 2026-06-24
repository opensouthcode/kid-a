import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createDbMagicTokenStore,
  createDbStore,
  createSqlClient,
  type SqlClient,
} from './db-store.js';
import { getStoreFileName, syncPrizeGivenCache } from './store.js';
import type {
  ConferenceData,
  Kid,
  PassportActivitiesByKid,
  Prize,
  PrizeAward,
  StoreData,
} from './types.js';

const migrationsDir = path.resolve('netlify/database/migrations');
const seedDataDir = path.resolve(process.env.KID_A_SEED_DATA_DIR ?? 'src/data');
let initializationPromise: Promise<void> | undefined;

async function readSeedJson<T>(fileName: string): Promise<T> {
  return JSON.parse(await readFile(path.join(seedDataDir, fileName), 'utf8')) as T;
}

async function readSeedSnapshot(): Promise<StoreData> {
  const [conference, kids, passportActivitiesByKid, prizeAwards, prizes] =
    await Promise.all([
      readSeedJson<ConferenceData>(getStoreFileName('conference')),
      readSeedJson<Kid[]>(getStoreFileName('kids')),
      readSeedJson<PassportActivitiesByKid>(
        getStoreFileName('passportActivitiesByKid'),
      ),
      readSeedJson<PrizeAward[]>(getStoreFileName('prizeAwards')),
      readSeedJson<Prize[]>(getStoreFileName('prizes')),
    ]);

  return {
    conference,
    kids,
    passportActivitiesByKid,
    prizeAwards,
    prizes: syncPrizeGivenCache(prizes, prizeAwards),
  };
}

function splitSqlStatements(sqlText: string) {
  return sqlText
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function applyDbSchema(sql: SqlClient = createSqlClient()) {
  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    const sqlText = await readFile(path.join(migrationsDir, migrationFile), 'utf8');

    for (const statement of splitSqlStatements(sqlText)) {
      await sql.query(statement);
    }
  }
}

async function hasSeedData(sql: SqlClient) {
  const rows = (await sql`
    SELECT EXISTS (
      SELECT 1
      FROM conference_settings
      WHERE id = 'default'
    ) AS has_conference
  `) as Array<{ has_conference: boolean }>;

  return rows[0]?.has_conference === true;
}

export async function resetDb(sql: SqlClient = createSqlClient()) {
  const seedSnapshot = await readSeedSnapshot();

  await applyDbSchema(sql);
  await createDbStore(sql).resetData(seedSnapshot);
  await createDbMagicTokenStore(sql).writeTokens([]);
}

export async function ensureDbInitialized(sql: SqlClient = createSqlClient()) {
  initializationPromise ??= (async () => {
    await applyDbSchema(sql);

    if (!(await hasSeedData(sql))) {
      await resetDb(sql);
    }
  })();

  return initializationPromise;
}
