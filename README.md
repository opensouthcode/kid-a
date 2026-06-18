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

`build:node` and `build:netlify` build the frontend with `VITE_DATA_LAYER=remote`
and `VITE_BASE_PATH=/`, so the same React app uses the Node endpoints instead of
bundled mutable sample data. The Node server serves `dist` with SPA fallback and
exposes JSON endpoints at `/passport`, `/wheel-prizes`, and `/prizes-won`. It
stores writable event data in `server/data`, seeded from `src/data` when files
are missing. Set `KID_A_DATA_DIR` to use a different local data directory.

`netlify.toml` also routes those endpoints to `netlify/functions/api.ts`.
Netlify Functions can run this adapter locally and with bundled JSON data, but
the function filesystem is not durable in production. Use durable storage before
depending on Netlify Functions for live event writes.
