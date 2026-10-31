# Ургийн мод — Family Tree

Local-first family tree with Mongolian kinship labels. See [docs/SPEC.md](docs/SPEC.md).

## Setup

Node.js is installed in `~/.local/node`. Put it on your PATH (once per terminal, or add the line to `~/.zprofile`):

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

## Commands

```bash
npm run dev     # local dev server at http://localhost:5173
npm test        # unit tests (kinship engine, converter, database, editing)
npm run build   # type-check and production build into dist/
npm run preview # serve dist/ at http://localhost:4173 (offline mode works here)
```

## Deploy

The build in `dist/` is plain static files with relative paths, so it can be served from any folder.
Only the app is online; each person's family data stays in their own browser (IndexedDB) and moves
between devices only as a backup file (Нөөц → Файл болгон хадгалах / Файлаас сэргээх).

- **Netlify Drop** (no account setup beyond sign-in): run `npm run build`, then drag the `dist` folder onto
  https://app.netlify.com/drop.
- **GitHub Pages**: push this folder to a GitHub repository, then in Settings → Pages choose
  "GitHub Actions". `.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`.

On iPhone: open the site in Safari → Share → "Add to Home Screen". On Mac: Chrome/Edge install icon in the
address bar, or Safari → File → "Add to Dock". Installed, it opens offline, and the browser is far less likely
to clear its data — Safari may delete data of sites that are not installed after 7 days without a visit.

## Layout

| Path | What |
|---|---|
| `src/model/types.ts` | Person, Union, ParentLink |
| `src/db/db.ts` | IndexedDB (Dexie) schema, JSON export / import |
| `src/db/edit.ts` | Add / edit / delete people and links, with smart linking |
| `src/kinship/` | Relationship engine and Mongolian terms |
| `src/translit/` | Latin → Cyrillic converter |
| `src/tree/` | Hourglass layout, tree view (pan, zoom, focus switching), person cards |
| `src/edit/` | "Start with me" wizard, quick-add dialog, person editor |
| `src/settings/` | Kinship term settings |
| `src/ui/` | Dialog, name input with live Latin → Cyrillic, date fields |
| `src/search/` | People search and list |
| `src/backup/` | Backup / restore dialog (`src/db/backup.ts` has the logic) |
| `pwa/sw.template.js` | Offline service worker; `vite.config.ts` fills in the file list |
| `src/sample/` | Made-up sample family, also used by tests |
| `src/App.tsx` | Toolbar and app shell |
