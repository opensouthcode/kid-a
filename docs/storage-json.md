# Storage JSON reference

This app has two writable storage backends:

- Local Node deployments use JSON files in `server/data`, seeded from `src/data`
  when files are missing.
- Netlify deployments use Netlify Blobs in the `kid-a-data` store by default,
  seeded from committed JSON files in `server/data` or `src/data`.

Netlify Blobs are optimized for reads and infrequent writes. Avoid
read-modify-write on shared JSON blobs for high-frequency event data because
same-key writes are last-write-wins and reads may be stale.

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

1. Move kids from `kids.json` to `kids/{kidId}.json` with `onlyIfNew` ID claims.
2. Consider per-prize blobs for `wheel-prizes.json` if concurrent catalog editing
   becomes common.
3. Consider one blob per passport activity completion if concurrent same-kid
   activity updates become common.
4. Consider one blob per magic token if concurrent admin link generation matters.
