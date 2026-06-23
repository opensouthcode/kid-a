# kid-a

![Kid-A logo](docs/KidA.jpg)

Web app to manage the pear-ish OpenSouthKids.

Aplicación web para gestionar OpenSouthKids con cariño pear-ish.

## Product stories

- [Kid happy path](docs/kid-story.md)

## Local development

This frontend uses React, TypeScript, Vite, and React Router.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run build
npm run preview
```

## Deployment

The default `npm run build` and `npm run build:gh-pages` commands build the
static sample-data app for GitHub Pages project hosting with the Vite base path
`/kid-a/`. The `Frontend CI` GitHub Actions workflow installs dependencies,
runs linting, builds the app, uploads the Pages artifact, and deploys from
`main`.

### Alternate Node/Netlify deployment

The static GitHub Pages deployment remains unchanged. For a stateful local Node
deployment, build both the frontend and server, then run the compiled HTTP
server:

```bash
npm run build:node
npm run start:node
```

`build:node` and `build:netlify` build the frontend with `VITE_DATA_LAYER=remote`,
`VITE_BASE_PATH=/`, and `VITE_API_BASE_URL=/api`, so the same React app uses the
Node endpoints instead of bundled mutable sample data. The Node server serves
`dist` with SPA fallback and exposes JSON endpoints at `/api/passport`,
`/api/kids`, `/api/wheel-prizes`, and `/api/prizes-kid`. It stores writable event data in
`server/data`, seeded from `src/data` when files are missing. Set
`KID_A_DATA_DIR` to use a different local data directory.

`netlify.toml` also routes those endpoints to `netlify/functions/api.ts`.
Netlify Functions use Netlify Blobs for durable production writes while keeping
the same frontend API contract. On first read, the blob store is seeded from the
committed JSON data in `server/data` or `src/data`. Passports are stored as one
blob per kid at `passports/{kidId}.json`, so completing an activity only writes
that kid's passport. Prize catalog settings are stored in one shared blob, and
prize awards are stored by kid and exposed through kid-scoped API responses.

The default blob store name is `kid-a-data`. Set `KID_A_BLOBS_STORE` in Netlify
to use a different store name. Netlify automatically provides the Blobs runtime
context to the function; local Node deployments continue to use `server/data`
and `KID_A_DATA_DIR`. Staff magic-link tokens are role-scoped and stored as
SHA-256 hashes in
the same blob store under `admin/magic-tokens.json`, or in
`server/data/magicTokens.json` for local Node. Set `ADMIN_PASSWORD` to enable
the `/admin` page to generate 1-day desk, wheel, or activity-specific lead
links by default; the duration in days can be changed when generating a link. The
`build:gh-pages` static deployment still uses bundled sample data and does not
call the remote endpoints; it exposes built-in demo links for the same roles.

Set `KID_A_ADMIN_TOKEN` to enable protected admin backup and restore endpoints.
The export includes `exportedAt`, `passports`, `wheelPrizes`, and `prizesWon`.

```bash
curl -H "Authorization: Bearer $KID_A_ADMIN_TOKEN" \
  https://example.netlify.app/api/admin/export > kid-a-backup.json

curl -X POST -H "Authorization: Bearer $KID_A_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @kid-a-backup.json \
  https://example.netlify.app/api/admin/import
```
