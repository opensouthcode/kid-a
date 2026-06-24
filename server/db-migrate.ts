import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@netlify/neon';
import {
  createBlobMagicTokenStore,
  createFileMagicTokenStore,
  type MagicLinkTokenRecord,
  type MagicLinkTokenStore,
} from './access-tokens.js';
import { createBlobStore } from './blob-store.js';
import { createDbMagicTokenStore, createDbStore } from './db-store.js';
import { createFileStore, syncPrizeGivenCache, type StoreAdapter } from './store.js';
import type { StoreData } from './types.js';

type MigrationSource = 'blob' | 'file';
type Command = 'apply-schema' | 'migrate' | 'verify';
type SqlClient = ReturnType<typeof neon>;

type ComparableData = {
  conference: StoreData['conference'];
  kids: StoreData['kids'];
  passportActivitiesByKid: StoreData['passportActivitiesByKid'];
  prizeAwards: StoreData['prizeAwards'];
  prizes: StoreData['prizes'];
};

const migrationsDir = path.resolve('db/migrations');
const validCommands = new Set<Command>(['apply-schema', 'migrate', 'verify']);
const validSources = new Set<MigrationSource>(['blob', 'file']);

function getCommand(): Command {
  const command = process.argv[2] ?? 'migrate';

  if (!validCommands.has(command as Command)) {
    throw new Error(
      `Unsupported command "${command}". Use apply-schema, migrate, or verify.`,
    );
  }

  return command as Command;
}

function getSource(): MigrationSource {
  const source = process.env.KID_A_MIGRATION_SOURCE ?? 'file';

  if (!validSources.has(source as MigrationSource)) {
    throw new Error('KID_A_MIGRATION_SOURCE must be file or blob');
  }

  return source as MigrationSource;
}

function createSourceStore(source: MigrationSource): StoreAdapter {
  return source === 'blob' ? createBlobStore() : createFileStore();
}

function createSourceMagicTokenStore(source: MigrationSource): MagicLinkTokenStore {
  return source === 'blob' ? createBlobMagicTokenStore() : createFileMagicTokenStore();
}

function splitSqlStatements(sqlText: string) {
  return sqlText
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashValue(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function normalizeStoreData(data: StoreData): ComparableData {
  const prizeAwards = data.prizeAwards
    .map((award) => ({ ...award }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    conference: { ...data.conference },
    kids: data.kids
      .map((kid) => ({ ...kid }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    passportActivitiesByKid: Object.fromEntries(
      Object.entries(data.passportActivitiesByKid)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([kidId, passport]) => [
          kidId,
          passport
            .map((activity) => ({ ...activity }))
            .sort((left, right) => left.id - right.id),
        ]),
    ),
    prizeAwards,
    prizes: syncPrizeGivenCache(data.prizes, prizeAwards)
      .map((prize) => ({ ...prize }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function normalizeTokens(tokens: MagicLinkTokenRecord[]) {
  return tokens
    .map((token) => ({ ...token }))
    .sort((left, right) => left.tokenHash.localeCompare(right.tokenHash));
}

function summarizeStoreData(data: ComparableData) {
  return {
    kids: data.kids.length,
    passportKids: Object.keys(data.passportActivitiesByKid).length,
    passportRows: Object.values(data.passportActivitiesByKid).reduce(
      (total, passport) => total + passport.length,
      0,
    ),
    prizeAwards: data.prizeAwards.length,
    prizes: data.prizes.length,
  };
}

async function applySchema(sql: SqlClient) {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    const existingRows = (await sql`
      SELECT id
      FROM schema_migrations
      WHERE id = ${migrationFile}
    `) as Array<{ id: string }>;

    if (existingRows.length > 0) {
      continue;
    }

    const sqlText = await readFile(path.join(migrationsDir, migrationFile), 'utf8');

    for (const statement of splitSqlStatements(sqlText)) {
      await sql.query(statement);
    }

    await sql`
      INSERT INTO schema_migrations (id)
      VALUES (${migrationFile})
      ON CONFLICT DO NOTHING
    `;
    console.log(`Applied ${migrationFile}`);
  }
}

async function migrateData(source: MigrationSource) {
  const sourceStore = createSourceStore(source);
  const sourceTokenStore = createSourceMagicTokenStore(source);
  const dbStore = createDbStore();
  const dbTokenStore = createDbMagicTokenStore();
  const [snapshot, tokens] = await Promise.all([
    sourceStore.readSnapshot(),
    sourceTokenStore.readTokens(),
  ]);

  await dbStore.updateSnapshot(
    (targetSnapshot) => {
      targetSnapshot.conference = snapshot.conference;
      targetSnapshot.kids = snapshot.kids;
      targetSnapshot.passportActivitiesByKid = snapshot.passportActivitiesByKid;
      targetSnapshot.prizeAwards = snapshot.prizeAwards;
      targetSnapshot.prizes = syncPrizeGivenCache(snapshot.prizes, snapshot.prizeAwards);
    },
    ['conference', 'kids', 'passportActivitiesByKid', 'prizeAwards', 'prizes'],
  );
  await dbTokenStore.writeTokens(tokens);

  console.log(
    `Migrated ${source} data to Netlify DB: ${JSON.stringify(
      summarizeStoreData(normalizeStoreData(snapshot)),
    )}, tokens=${tokens.length}`,
  );
}

async function verifyData(source: MigrationSource) {
  const sourceStore = createSourceStore(source);
  const sourceTokenStore = createSourceMagicTokenStore(source);
  const dbStore = createDbStore();
  const dbTokenStore = createDbMagicTokenStore();
  const [sourceSnapshot, dbSnapshot, sourceTokens, dbTokens] = await Promise.all([
    sourceStore.readSnapshot(),
    dbStore.readSnapshot(),
    sourceTokenStore.readTokens(),
    dbTokenStore.readTokens(),
  ]);
  const sourceData = normalizeStoreData(sourceSnapshot);
  const dbData = normalizeStoreData(dbSnapshot);
  const sourceTokenData = normalizeTokens(sourceTokens);
  const dbTokenData = normalizeTokens(dbTokens);
  const checks = [
    ['conference', sourceData.conference, dbData.conference],
    ['kids', sourceData.kids, dbData.kids],
    [
      'passportActivitiesByKid',
      sourceData.passportActivitiesByKid,
      dbData.passportActivitiesByKid,
    ],
    ['prizes', sourceData.prizes, dbData.prizes],
    ['prizeAwards', sourceData.prizeAwards, dbData.prizeAwards],
    ['magicLinkTokens', sourceTokenData, dbTokenData],
  ] as const;
  const failures = checks
    .map(([label, sourceValue, dbValue]) => ({
      dbHash: hashValue(dbValue),
      label,
      sourceHash: hashValue(sourceValue),
    }))
    .filter((check) => check.sourceHash !== check.dbHash);

  console.log(`Source summary: ${JSON.stringify(summarizeStoreData(sourceData))}`);
  console.log(`DB summary: ${JSON.stringify(summarizeStoreData(dbData))}`);
  console.log(`Source tokens: ${sourceTokenData.length}; DB tokens: ${dbTokenData.length}`);

  if (failures.length > 0) {
    throw new Error(
      `Netlify DB verification failed: ${failures
        .map(
          (failure) =>
            `${failure.label} source=${failure.sourceHash} db=${failure.dbHash}`,
        )
        .join('; ')}`,
    );
  }

  console.log('Netlify DB verification passed');
}

async function main() {
  const command = getCommand();
  const source = getSource();
  const sql = neon();

  if (command === 'apply-schema' || command === 'migrate') {
    await applySchema(sql);
  }

  if (command === 'migrate') {
    await migrateData(source);
  }

  if (command === 'migrate' || command === 'verify') {
    await verifyData(source);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
