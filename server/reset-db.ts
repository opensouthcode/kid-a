import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@netlify/neon';
import { createDbMagicTokenStore, createDbStore } from './db-store.js';
import { getStoreFileName, syncPrizeGivenCache } from './store.js';
import type {
  ConferenceData,
  Kid,
  PassportActivitiesByKid,
  Prize,
  PrizeAward,
  StoreData,
} from './types.js';

type SqlClient = ReturnType<typeof neon>;

const migrationsDir = path.resolve('db/migrations');
const seedDataDir = path.resolve(process.env.KID_A_SEED_DATA_DIR ?? 'src/data');

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

async function applySchema(sql: SqlClient) {
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

async function main() {
  const sql = neon();
  const seedSnapshot = await readSeedSnapshot();

  await applySchema(sql);
  await createDbStore(sql).resetData(seedSnapshot);
  await createDbMagicTokenStore(sql).writeTokens([]);
  console.log(`Reset DB store from ${seedDataDir}`);
  console.log('Cleared DB magic-link tokens');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
