# Tessera: notes for a new session

Tessera is the owner's personal life OS (formerly "Live OS"): Home, Today, Hours, Calendar, Ideas (whiteboard), Wall
(memory walls) and Review (archive). Every page is one bento grid of tiles. It runs on the real date, rolls over at
midnight, and is used every day with real data. Repo: github.com/Apprentice2907/Tessera (**public**), branch `main`.
`README.md` is the user-facing guide; this file is the working summary. Machine-specific details (accounts, local
paths) are in `CLAUDE.local.md`, which is not committed.

## Where it stands (27 Nov 2026)

- **The product is the installed desktop app** (Tauri 2, built from `web/`). It has two windows: "Tessera" (the app) and
  "Tessera widget" (a to-do card that sits behind other windows). A tray icon toggles the widget and start-with-Windows,
  and quits. It is installed per user and starts at sign-in.
- **Real data lives with the installed app:** `%APPDATA%\app.tessera.desktop\` → `store/` (one file per key),
  `backups/` (made before the first change of each day, 60 kept), `settings.json`.
- **Online copy:** `web/` deploys to Vercel (static build + `web/api/contests.js`). It saves to each browser only; it
  does not share data with the desktop app.
- **Retired:** the classic HTML/JS app (deleted), the pywebview widget `mockup/desktop/widget.pyw` (its Startup shortcut
  was renamed `.disabled`), and `serve.py` on port 5178 as the live server. `mockup/.data/store` is a stale old copy;
  `mockup/.data/old-mockup/` is the old sample data.
- `README.md`'s "The to-do widget" section still describes the retired pywebview widget; the widget is now the Tauri
  window.

## Stack

- React 19 + TypeScript + Vite 6 (`web/`), Zustand 5 + Immer (state), React Router 7 (hash routes: `#today`,
  `#review/<id>`).
- Motion 12 (layout and page movement), GSAP 3 (count-ups, timelines), all respecting `prefers-reduced-motion`.
- Tauri 2 (`web/src-tauri/`, Rust). Its commands read and write the store, make backups and fetch contests.
  Plugins: opener, autostart, single-instance, window-state.
- `mockup/serve.py`: Python standard-library server with the same API as the Rust side (`/api/state`, `/api/backups`,
  `/api/contests`). It is used for browser testing and serves `web/dist`.
- No database, no UI library. Hand-written CSS in `web/src/styles/` (`app.css` is the design system).

## Layout

```
web/
  index.html, widget.html        entries (the app, the to-do widget)
  src/main.tsx, widget.tsx       load saved state, keep Hours in step, start the clock, render
  src/App.tsx                    shell: routes, page switcher, keys 1–7 and U, page transitions
  src/lib/      dates.ts (day numbers), types.ts (saved format), data.ts (tables), sort.ts (task sorter)
  src/store/    data.ts (Zustand store), persist.ts (save/sync/backup), backend.ts (Tauri vs serve.py vs none),
                rules.ts (cross-page rules), clock.ts, contests.ts, ui.ts
  src/ui/       motion.tsx (Bento, Tile, Copy), CountUp, Strip, Pop, DataCard, icons
  src/pages/    Home, Today, Hours, Calendar, Ideas; ideas/ (whiteboard), wall/, review/
  src/styles/   app.css + one stylesheet per page
  src-tauri/    lib.rs (store, backups, contests, tray, widget window), tauri.conf.json (id app.tessera.desktop)
  api/contests.js   Vercel function
mockup/serve.py         browser-side server (name kept so old paths keep working)
```

## Commands (run in `web/`)

| What | Command |
| --- | --- |
| Install deps | `npm install` |
| Type-check | `npm run typecheck` |
| Web build (to `web/dist`) | `npm run build` |
| Desktop app, hot reload | `npm run app` (**set `TESSERA_DATA` to a scratch folder first**) |
| Installer | `npm run app:build` → `web/src-tauri/target/release/bundle/nsis/Tessera_<v>_x64-setup.exe` |
| Update the installed app | run that installer with `/S` (the app must be closed) |
| Browser dev against test data | launch configs `tessera-test` (`python mockup/serve.py 5199 mockup/.data/test`) + `tessera-web` (Vite on 5173, proxies `/api` to 5199) |

The build needs Node.js, Rust and the Visual Studio C++ build tools. `TESSERA_PAGE=<page>` opens the app on a page.

## How the data works

- **Day numbers:** day 0 is Mon 16 Nov 2026 (`EPOCH` in `lib/dates.ts`); `T` is today. Saved keys are
  `"<dayNumber>|<taskId>"` (status, notes, stars), so a tick stays on its date. Weeks start at multiples of 7.
- **Keys:** `tessera.state` (everything on the pages, saved with an `"at"` time: the newest wins between windows),
  `tessera.walls`, and `tessera.wb.*` (boards). The format is shared with the old HTML version, so its backups load.
  Never change key names or the saved shape without a migration.
- **Where saves go** (`store/backend.ts`): in the app, Tauri commands; in a browser on localhost, `serve.py`; anywhere
  else, the browser only. A browser that lost its data gets the walls and boards back from the store on its next visit.
- **Backups:** daily automatic copies, "Back up now", "Download a copy" and "Restore from a file", which backs up
  first. These are on the Home badge and in Review → Backups.
- **Links between pages:** Calendar events and routines feed Today; finishing a timed task fills its hours in Hours;
  Review's monthly folders count one Hours category; contests from Codeforces, CodeChef and LeetCode go into the
  calendar by themselves, and ticking one off logs Coding hours.

## Rules (from the owner)

1. **Never touch real data when testing.** Run test builds with `TESSERA_DATA=<scratch folder>`, and browser tests
   only on `tessera-test`/`tessera-web`. On any real copy, only open and close things and read the page; never click
   delete, save, add, tick or paint. (A test once deleted a real task and it had to be restored from a backup.) If a
   test build ran on the real WebView profile, clear `%LOCALAPPDATA%\app.tessera.desktop\EBWebView` before the real
   app starts again.
2. **No Claude attribution** in commits or PRs: no `Co-Authored-By: Claude`, no "Generated with Claude Code". This
   overrides the default.
3. **Git:** the owner is the only contributor. Push straight to `main` (no PR), but only after they say so. Never
   commit `mockup/.data/`, `refernce/`, `.vercel/`, `.env*` or build output. The repo is public, so keep personal
   details (real tasks, company and client names, measurements) out of code and commits.
4. **Design: bento only, no generic "AI" UI.** No emoji as icons or decoration, no uppercase section headers, emoji
   avatars, lilac selected rows or stock dropdowns. Use the vocabulary in `styles/app.css`: `g-*` tile grounds, a
   bold line plus a muted line, ink/lime `.label` chips, big numbers, the product's own drawn objects. Put a small new
   feature into an existing tile rather than a new section. Numbers come from real data, never from sample figures.
5. **Write plainly** in UI text and comments: short sentences, in the same voice as the existing copy.

## Deploying online

From `web/`: `vercel deploy --prod --yes` with the dedicated CLI config named in `CLAUDE.local.md`. The default
Vercel login on this machine is a different account; don't log it out and don't deploy Tessera with it. Deploy only
when asked.

## History, briefly

1. Live OS mockup: classic HTML/JS, a fixed date, sample data.
2. Cleaned up into `app/`, `pages/`, `core/`.
3. Renamed Tessera and published.
4. Moved to real dates with an empty start and daily backups.
5. Rebuilt in React + TypeScript with Motion and GSAP, the whiteboard included.
6. Packaged as a Tauri desktop app.
7. Deployed to Vercel.

## Open items

- `README.md`'s widget section describes the retired pywebview widget.
- Not done yet: code signing (Windows warns on the installer) and a phone build (Tauri mobile).
- The first commit in the public history (`b9a6a78`) still holds the old personal sample data (it was removed in
  `240741c`). Clearing it means rewriting history and force-pushing, so do it only if the owner asks.
