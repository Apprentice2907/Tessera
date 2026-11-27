# Tessera

*Nulla dies sine linea.* No day without a line.

A tessera is one small tile of a mosaic. Here each day is a tile, and over time the tiles make a picture of a life.

Tessera is a personal life OS: today's tasks, where the hours went, a calendar, an ideas board, memory walls, and a
monthly archive that fills itself in from all of them. Every page is one bento grid of tiles. It is a working mockup:
plain HTML, CSS and JavaScript with no build step and no dependencies, running on a fixed "today" (Mon 16 Nov 2026).

## Run it

```
python mockup/serve.py
```

Then open http://localhost:5178. Keys `1`–`7` switch pages; `U` logs a project update from anywhere.

`serve.py` serves the folder and keeps one copy of your saved state in `mockup/.data/state.json`, so the app and the
desktop widget stay in sync. Without it (any static host) the app still works and saves to the browser only.

## The pages

| Page | What it does |
| --- | --- |
| Home | One tile per section, each showing where it stands today. |
| Today | The day's routines, events and tasks. Drag to In progress or Done, star, right-click to re-file. Also logs project updates. |
| Hours | Today hour by hour, painted by category, and the month as a heat map. |
| Calendar | The week, the month, routines as dots, and coding contests. Double-click to add or edit. |
| Ideas | The whiteboard (`board.html`), full screen. |
| Wall | Wire-grid memory walls, one per trip, festival or season. |
| Review | The archive: folders → files → documents, counted from Today and Hours. |

The pages are connected: a calendar event shows up in Today, finishing a timed task fills its hours in Hours, and
Review counts its numbers (gym days, DSA questions, coding hours) from both.

## The to-do widget

- `mockup/widget.html` is Today's list on its own: keep it open, add it to a phone's home screen, or embed it.
- `mockup/desktop/widget.pyw` puts it on the Windows desktop: a borderless card behind your windows that you can drag
  and resize. It needs `pip install pywebview`, and starts the server if it isn't running. A shortcut to it in the
  Startup folder starts it at sign-in.

## How the code is laid out

```
mockup/
  index.html, widget.html, board.html   the three entry pages
  serve.py                              local server + shared saved state
  data/       data.js (sample data, calendar helpers, drawings), archive.js (Review's archive)
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
