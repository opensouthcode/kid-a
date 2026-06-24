# Storage reference

The app uses Netlify DB/Postgres as the only writable server-side storage
backend. On startup, the server applies DB migrations and seeds an empty DB from
committed JSON files in `src/data`.

## Runtime data

| Data | DB table | Notes |
| --- | --- | --- |
| Conference settings | `conference_settings` | Singleton event metadata such as title and kid ID prefix. |
| Kids | `kids` | Kid IDs are app-owned strings; the DB does not use generated user-facing IDs. |
| Passport activities | `passport_activities` | Stores the per-kid passport rows and optional completion timestamp. |
| Wheel prize catalog | `prizes` | Stores prize settings. `given` is derived from awards. |
| Prize awards | `prize_awards` | Stores awarded prizes and source metadata. |
| Magic link tokens | `magic_link_tokens` | Stores SHA-256 token hashes and role scopes. |

## Resetting non-production data

The app is not in production yet, so testing data can be discarded. To force a
reset from committed seed JSON and clear magic-link tokens, run:

```sh
NETLIFY_DB_URL=... npm run data:reset-db
```

## Schema

The DB schema lives in `db/migrations/0001_netlify_db.sql`. It keeps app-owned
IDs for kids, prizes, prize awards, and magic-link token hashes. The database
does not auto-generate user-facing IDs or maintain a separate kid ID counter
table.
