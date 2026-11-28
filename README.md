# Tessera

*Nulla dies sine linea.* No day without a line.

A tessera is one small tile of a mosaic. Here each day is a tile, and over time the tiles make a picture of a life.

Tessera is a personal life OS: today's tasks, where the hours went, a calendar, an ideas board, memory walls, and a
monthly archive that fills itself in from all of them. Every page is one bento grid of tiles. It runs on the real
date and turns to the new day at midnight.

It's a desktop app you install, like Microsoft To Do: a window for the app, and a small to-do card on your desktop that
sits behind your other windows. Your data stays on your computer.

**[Download it for Windows](https://github.com/Apprentice2907/Tessera/releases/latest)**

## Stack

- **Tauri 2** makes it a desktop app (`web/src-tauri/`, Rust): a small installer that uses the Edge engine already in
  Windows. Its Rust side keeps your data in files, makes the daily backups and fetches the contests. The same code can
  later build Android and iOS apps.
- **React 19 + TypeScript**, built with **Vite** (`web/`).
- **Zustand** holds the state; changes run through **Immer** drafts, so the saved format stays exactly what it was.
- **React Router** (hash routes, so `#today` and `#review/<id>` links still work).
- **Motion** for layout and page movement: tiles arrive in order, a ticked or dragged task slides to its new place,
  Review's folder opens into its cover and a file into its header, the page switcher's pill slides.
- **GSAP** for timelines and count-ups: big numbers count up, the hour strip fills in from the left, the month's squares
  light up in order. The count-up follows React Bits' Count Up, written on GSAP.
- Everything respects `prefers-reduced-motion`.
- No database. In a browser instead of the app, a small **Python** server (`mockup/serve.py`) does what the app's Rust
  side does, with the same API.

## Install it

Download the installer, `Tessera_<version>_x64-setup.exe`, from
[the latest release](https://github.com/Apprentice2907/Tessera/releases/latest) and run it. It installs for you alone (no admin rights) and adds Tessera to the
Start menu. The first time it opens, it turns on the desktop widget and starts with Windows; both can be turned off
from its tray icon, which also opens the app and quits it. Keys `1`–`7` switch pages; `U` logs a project update from
anywhere.

Without a paid code-signing certificate, Windows may say the installer is from an unknown publisher the first time;
"More info", then "Run anyway".

## Build it

Needs Node.js, Rust and the Microsoft C++ build tools (Visual Studio with "Desktop development with C++").

```
cd web
npm install
npm run app:build
```

The installer lands in `web/src-tauri/target/release/bundle/nsis/`. `npm run app` runs the app with hot reload.
`TESSERA_DATA=<folder>` runs it on another data folder, so testing never touches your own.

### In a browser instead

```
cd web && npm run build
python mockup/serve.py
```

and open http://localhost:5178. For working on the pages, `python mockup/serve.py 5199 mockup/.data/test` and
`npm run dev` (http://localhost:5173, hot reload, `/api` sent to the test server on 5199; `TESSERA_SERVER` points it
somewhere else). `npm run typecheck` runs TypeScript on its own.

## Your data

- **Where it lives:** in the app's folder, `%APPDATA%\app.tessera.desktop\` (`store/`, one file per part, and
  `backups/`). The app and its desktop widget share it, so a task ticked in one is ticked in the other. In a browser
  with `serve.py`, it's `mockup/.data/` instead, in the same format.
- **The format:** the keys `tessera.state`, `tessera.walls` and `tessera.wb.*`, the same as the first (plain HTML)
  version of Tessera, so its data and backups load as they are.
- **Backups:** everything is copied to `backups/` before the first change of each day, and the last 60 are kept. "Back up now" makes one on the spot.
- **A copy to keep:** "Download a copy" saves one file with everything. "Restore from a file" puts it back, after
  backing up what's there. Both are on the Home badge and on Review's "Backups" button.
- **If the browser forgets:** cleared browser data, or a new browser, gets everything back from the server on the
  next visit.
- `mockup/.data/` is never committed or served.

Without the server (any static host) the app still works and saves to the browser only.

## Online

`web/` also deploys to Vercel as it is (`web/vercel.json`): the built app, plus one function, `web/api/contests.js`,
that fetches the contests the way `serve.py` does. There's no `serve.py` online, so that copy saves to each browser only
and doesn't share data with the copy on your computer.

## Contests

With the server running, upcoming contests from Codeforces, CodeChef and LeetCode are fetched from the sites every half
hour and go into the calendar by themselves, so they show up in Today, Next up and the widget; ticking one off logs its
hours as Coding. Only contests: practice rounds, test rounds and multi-day challenges are left out. Removing one from
its card keeps it off the calendar.

## Testing

`python mockup/serve.py 5199 mockup/.data/test` runs a second copy on its own port with its own data (the
`tessera-test` launch config), so a test never touches your real tasks. The `tessera-web` launch config runs the
Vite dev server against it.

## The pages

| Page | What it does |
| --- | --- |
| Home | One tile per section, each showing where it stands today. |
| Today | The day's routines, events and tasks. Drag to In progress or Done, star, right-click to re-file. Also logs project updates. |
| Hours | Today hour by hour, painted by category, and the month as a heat map. |
| Calendar | The week, the month, routines as dots, and coding contests. Double-click to add or edit. |
| Ideas | The whiteboard, full screen: sticky notes, text, shapes, connectors, pen and highlighter, sections, stamps, comments, links and images, and templates. Boards sit in folders (`B` opens them); right-click the canvas for Board options, with the background and the versions to go back to. Every open tab on a board sees the others' changes live. |
| Wall | Wire-grid memory walls, one per trip, festival or season. |
| Review | The archive. Monthly folders open a file each month and fill it in from one Hours category; projects folders hold a file per project, with a plan and a page a week. |

The pages are connected: a calendar event shows up in Today, finishing a timed task fills its hours in Hours, and
Review counts each monthly folder's days and hours from Hours.

## The to-do widget

- `widget.html` is Today's list on its own: keep it open, add it to a phone's home screen, or embed it.
- `mockup/desktop/widget.pyw` puts it on the Windows desktop (`widget.html?desk`): a borderless card behind your
  windows that you can drag and resize. It needs `pip install pywebview`, and starts the server if it isn't running.
  A shortcut to it in the Startup folder starts it at sign-in.

## How the code is laid out

```
web/                    the app (React + TypeScript + Vite)
  index.html, widget.html             the two entry pages
  vite.config.ts                      the build
  src/
    main.tsx, widget.tsx              entries: load the saved state, keep Hours in step, start the clock, draw
    App.tsx                           the shell: routes, page switcher, keys, page transitions
    lib/        dates.ts (day numbers from a fixed Monday), types.ts (the saved format), data.ts (fixed tables
                and helpers), sort.ts (the on-device task sorter)
    store/      data.ts (the Zustand store), persist.ts (saving, sync, backups), rules.ts (cross-page rules),
                clock.ts (today and the time), ui.ts (toast, the pop-up card, what pages remember)
    ui/         motion.tsx (Bento, Tile, Copy), CountUp, Strip (hour strip), Pop (pop-up card, toast), DataCard, icons
    pages/      Home, Today, Hours, Calendar; ideas/, wall/ and review/ are larger and have their own folders
      ideas/    the whiteboard: core.ts (state, saving, undo, versions, sync between tabs), input.ts (pointer, keys,
                clipboard), extras.ts (templates, comments, images, export), draw.ts (shapes, connectors, stamps),
                and the React parts: Canvas, Chrome (bars, tools), Cards (menus, options, drawer, dialogs)
    styles/     app.css (design system: tokens, grid, tiles) and one stylesheet per page
  public/       assets/ (icons, the widget's web manifest)
mockup/                 the local side: the server and the desktop widget (the name is kept so your data folder,
                        mockup/.data, and the Startup shortcut keep working)
  serve.py              local server: saved state, daily backups, contests; serves web/dist
  desktop/              the Windows desktop widget
```
