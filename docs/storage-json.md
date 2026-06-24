# Storage JSON reference

This app has two writable storage backends:

- Local Node deployments use JSON files in `server/data`, seeded from `src/data`
  when files are missing.
- Netlify deployments use Netlify Blobs in the `kid-a-data` store by default,
  seeded from committed JSON files in `server/data` or `src/data`.
- Netlify deployments can use Netlify DB/Postgres by setting
  `KID_A_STORE_BACKEND=db`.
- Netlify deployments can read from one backend and dual-write to Blobs and DB
  by setting `KID_A_STORE_BACKEND=dual`. `KID_A_STORE_READ=blob` keeps Blob
  reads while shadow-writing DB; `KID_A_STORE_READ=db` reads from DB instead.
  Magic-link tokens always follow the same backend mode as app data.

Netlify Blobs are optimized for reads and infrequent writes. Avoid
read-modify-write on shared JSON blobs for high-frequency event data because
same-key writes are last-write-wins and reads may be stale.

Server code should write through the command-oriented store methods in
`server/store.ts` instead of calling generic snapshot mutators from API
handlers. This keeps IDs and timestamps explicit where needed and prepares the
app for DB and dual-write backends.

## Current documents

| Data | Local Node JSON | Netlify Blob key | Pattern | Notes |
| --- | --- | --- | --- | --- |
| Conference settings | `server/data/conference.json` | `conference.json` | Common document | Static event metadata such as title and kid ID prefix. |
| Kids | `server/data/kids.json` | `kids.json` | Common document | Writable today. Registration sends the client's last known kid ID and retries if a stale read would reuse it. Future work should move this to per-kid blobs. |
| Passport activities | `server/data/passportActivities.json` | `passports/{kidId}.json` | Per kid | Netlify writes only the changed kid passport. The local JSON remains an aggregate map keyed by kid ID. |
| Wheel prize catalog | `server/data/wheel-prizes.json` | `wheel-prizes.json` | Common document | Shared prize settings and stock cache. Writes are infrequent admin/wheel operations. |
| Prize awards | `server/data/prizes-won.json` | `prizes-kid/{kidId}.json` | Per kid | `/prizes-kid` writes only the selected kid's awards. Netlify still reads legacy `prizes-won.json` for seed/admin compatibility and dedupes by award ID. |
| Magic link tokens | `server/data/magicTokens.json` | `admin/magic-tokens.json` | Common document | Stores SHA-256 token hashes and role scopes. |
| Seed marker | N/A | `seeded-v1.json` | Common marker | Marks that the Netlify blob store was seeded. |

## API write patterns

| Endpoint | Writes | Current pattern |
| --- | --- | --- |
| `POST /kids` | Kids and initial passport | Common `kids.json` plus per-kid passport. Uses `lastKnownKidId` retry to avoid reusing the ID seen by the client. |
| `POST /passport` | One kid passport | Per kid `passports/{kidId}.json`. |
| `POST /prizes-kid` | One kid's prize awards | Per kid `prizes-kid/{kidId}.json`. |
| `POST /wheel-prizes` | Prize catalog | Common `wheel-prizes.json`. |
| `POST /admin/import` | Passports, awards, catalog | Bulk restore. Rewrites local aggregates and refreshes per-kid blob mirrors where supported. Treat as maintenance-mode only. |
| `POST /admin/magic-links` | Magic tokens | Common `admin/magic-tokens.json`. |

## Follow-up migration targets

1. Reset Blob and DB writable state from committed seed JSON.
2. Enable config-driven dual writes with Blob reads.
3. Switch reads to DB after live verification.
4. Keep blobs as a rollback target until DB reads are verified.

## Netlify DB schema

The first DB migration lives in `db/migrations/0001_netlify_db.sql`. It keeps
app-owned IDs for kids, prizes, prize awards, and magic-link token hashes; the
database does not auto-generate user-facing IDs or maintain a separate kid ID
counter table. The DB adapter derives prize `given` counts from `prize_awards`
and builds passport responses from `passport_activities` rows.

The app is not in production yet, so existing Blob and DB testing data can be
discarded. To apply the DB schema, reset both stores from committed seed JSON,
and clear magic-link tokens in both places, run:

```sh
NETLIFY_DATABASE_URL=... npm run data:reset-stores
```

After reset, start the rollout with Blob reads and dual writes:

```sh
KID_A_STORE_BACKEND=dual
KID_A_STORE_READ=blob
KID_A_DUAL_WRITE_STRICT=true
```
