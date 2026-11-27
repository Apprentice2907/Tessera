# Tessera

*Nulla dies sine linea.* No day without a line.

A tessera is one small tile of a mosaic. Here each day is a tile, and over time the tiles make a picture of a life.

Tessera is a personal life OS: today's tasks, where the hours went, a calendar, an ideas board, memory walls, and a
monthly archive that fills itself in from all of them. Every page is one bento grid of tiles. It runs on the real
date and turns to the new day at midnight. Plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Run it

```
python mockup/serve.py
```

Then open http://localhost:5178. Keys `1`–`7` switch pages; `U` logs a project update from anywhere.

## Your data

- **Where it lives:** in the browser, and with `serve.py` running, on this computer too (`mockup/.data/store/`, one
  file per part). The app and the desktop widget share it, so a task ticked in one is ticked in the other.
- **Backups:** the server copies everything to `mockup/.data/backups/` before the first change of each day and keeps
  the last 60. "Back up now" makes one on the spot.
- **A copy to keep:** "Download a copy" saves one file with everything. "Restore from a file" puts it back, after
  backing up what's there. Both are on the Home badge and on Review's "Backups" button.
- **If the browser forgets:** cleared browser data, or a new browser, gets everything back from the server on the
  next visit.
- `mockup/.data/` is never committed or served.

Without the server (any static host) the app still works and saves to the browser only.

## Contests

With the server running, the Calendar shows upcoming contests from Codeforces, CodeChef and LeetCode. They're
fetched from the sites' public APIs and kept for half an hour.

## Testing

`python mockup/serve.py 5199 mockup/.data/test` runs a second copy on its own port with its own data (the
`tessera-test` launch config), so a test never touches your real tasks.

## The pages

| Page | What it does |
| --- | --- |
| Home | One tile per section, each showing where it stands today. |
| Today | The day's routines, events and tasks. Drag to In progress or Done, star, right-click to re-file. Also logs project updates. |
| Hours | Today hour by hour, painted by category, and the month as a heat map. |
| Calendar | The week, the month, routines as dots, and coding contests. Double-click to add or edit. |
| Ideas | The whiteboard (`board.html`), full screen. |
| Wall | Wire-grid memory walls, one per trip, festival or season. |
| Review | The archive. Monthly folders open a file each month and fill it in from one Hours category; projects folders hold a file per project, with a plan and a page a week. |

The pages are connected: a calendar event shows up in Today, finishing a timed task fills its hours in Hours, and
Review counts each monthly folder's days and hours from Hours.

## The to-do widget

- `mockup/widget.html` is Today's list on its own: keep it open, add it to a phone's home screen, or embed it.
- `mockup/desktop/widget.pyw` puts it on the Windows desktop: a borderless card behind your windows that you can drag
  and resize. It needs `pip install pywebview`, and starts the server if it isn't running. A shortcut to it in the
  Startup folder starts it at sign-in.

## How the code is laid out

```
mockup/
  index.html, widget.html, board.html   the three entry pages
  serve.py                              local server: saved state, daily backups, contests
  data/       data.js (dates, the clock, tasks and hours), archive.js (Review's folders and projects)
  core/       ui.js (DOM helpers), sort.js (on-device task sorter), store.js (saving, sync, cross-page rules)
  app/        app.css (design system: tokens, grid, tiles), app.js (router, page switcher, shared pieces)
  pages/      one .js + .css per page; wall/ and review/ are larger and have their own folders
  widget/     the to-do widget's script and styles
  board/      the whiteboard behind Ideas
  desktop/    the Windows desktop widget
  assets/     icons and the widget's web manifest
```

Scripts are plain classic scripts loaded in order (see `index.html`): data, then core, then `app/app.js`, then one
file per page. Each page adds itself to `P`: `P.x()` returns its HTML and `P.x.bind(root)` wires it up.
