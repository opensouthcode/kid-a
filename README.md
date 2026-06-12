# kid-a

![Kid-A logo](docs/KidA.jpg)

Web app to manage the pear-ish OpenSouthKids.

Aplicación web para gestionar OpenSouthKids con cariño pear-ish.

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

The app is configured for GitHub Pages project hosting with the Vite base path
`/kid-a/`. The `Frontend CI` GitHub Actions workflow installs dependencies,
runs linting, builds the app, uploads the Pages artifact, and deploys from
`main`.
