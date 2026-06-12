# AGENTS.md

- Keep this file simple: short notes, no long explanations.
- Use PRs for changes; do not push directly to `main`.
- Keep the Project board updated: https://github.com/orgs/opensouthcode/projects/6/views/1
- Before starting an epic, create its subissues and add them to the board.
- Issues, PRs, commits, comments, and developer docs: English.
- App UI: English and Spanish.
- Each kid has a language preference.
- Do not hard-code user-facing strings.
- Before opening a PR, detect and remove unused literals.
- Add screenshots of every UI change to the PR.
- JSON demo data lives in `src/data`; access it via `src/contexts/DataLayerContext` hooks.
- Main page structure: `App` selects the page, `TopBar` is shared, route pages live in `src/pages`.
- 2025 app is reference only; do not reuse its code.
- Kid identity is QR-based, no password.
- Minimum production scope: registration, QR, activities, progress, wheel, staff roles, export/reset.
