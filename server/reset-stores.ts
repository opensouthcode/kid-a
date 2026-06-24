import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@netlify/neon';
import { createBlobMagicTokenStore } from './access-tokens.js';
import { createBlobStore } from './blob-store.js';
import { createDbMagicTokenStore, createDbStore } from './db-store.js';
import {
  getStoreFileName,
  syncPrizeGivenCache,
  type StoreAdapter,
} from './store.js';
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

async function resetStore(name: string, store: StoreAdapter) {
  const seedSnapshot = await readSeedSnapshot();

  await store.updateSnapshot(
    (snapshot) => {
      snapshot.conference = seedSnapshot.conference;
      snapshot.kids = seedSnapshot.kids;
      snapshot.passportActivitiesByKid = seedSnapshot.passportActivitiesByKid;
      snapshot.prizeAwards = seedSnapshot.prizeAwards;
      snapshot.prizes = seedSnapshot.prizes;
    },
    ['conference', 'kids', 'passportActivitiesByKid', 'prizeAwards', 'prizes'],
  );

  console.log(`Reset ${name} store from ${seedDataDir}`);
}

async function main() {
  const sql = neon();

  await applySchema(sql);
  await resetStore('blob', createBlobStore());
  await resetStore('db', createDbStore(sql));
  await Promise.all([
    createBlobMagicTokenStore().writeTokens([]),
    createDbMagicTokenStore(sql).writeTokens([]),
  ]);
  console.log('Cleared blob and DB magic-link tokens');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
