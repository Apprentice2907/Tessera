// Tessera · one saved store, and the rules that tie the pages together.
//   Calendar → Today: Today lists what the calendar has for the day (tasksForDay in data/data.js).
//   Today → Hours: finishing a task that has a time fills its hours in, in the matching category.
//   Today and Hours → Review: the archive counts its numbers from them (gym days, DSA questions, coding hours …).
// Everything you change is saved in this browser (and, under serve.py, on this computer) and comes back on reload.
// STORE.reset() starts over.
'use strict';
const STORE = (() => {
  const KEY = 'lo.state.v1';
  const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // hours filled in from a finished task: 'YYYY-MM-DD|hour' → { id, cat }. Un-finishing the task takes them back,
  // unless you painted over them yourself (then they're yours)
  const AUTO = {};
  const fill = (obj, v) => { if (!v || typeof v !== 'object') return; Object.keys(obj).forEach(k => delete obj[k]); Object.assign(obj, v); };
  const refill = (arr, v) => { if (Array.isArray(v)) arr.splice(0, arr.length, ...v); };

  // ---------- what is saved ----------
  // name → [read it, put it back]. Review's parts (BOOKS, LIFTS …) come from data/archive.js.
  const PARTS = {
    status: [() => STATUS, v => fill(STATUS, v)],
    notes: [() => PNOTES, v => fill(PNOTES, v)],
    stars: [() => STARS, v => fill(STARS, v)],
    oneoffs: [() => ONEOFFS, v => refill(ONEOFFS, v)],
    events: [() => EVENTS, v => refill(EVENTS, v)],
    routines: [() => ROUTINES, v => refill(ROUTINES, v)],
    cats: [() => CATS, v => { if (Array.isArray(v) && v.length) CATS = v; }],
    hours: [() => Object.fromEntries(HOUR_DAYS.map(d => [dkey(d.date), d.cells])), v => HOUR_DAYS.forEach(d => { const c = v?.[dkey(d.date)]; if (Array.isArray(c) && c.length === 24) d.cells = c; })],
    auto: [() => AUTO, v => fill(AUTO, v)],
    books: [() => Object.fromEntries(Object.entries(BOOKS).map(([k, b]) => [k, { entries: b.entries, plan: b.plan, status: b.status }])),
      v => Object.entries(v || {}).forEach(([k, b]) => { const t = BOOKS[k]; if (!t || !b) return; if (Array.isArray(b.entries) && t.entries) t.entries = b.entries; if (Array.isArray(b.plan)) t.plan = b.plan; if (b.status) t.status = b.status; })],
    lifts: [() => LIFTS, v => refill(LIFTS, v)],
    diet: [() => DIET, v => refill(DIET, v)],
    also: [() => ALSO, v => refill(ALSO, v)],
  };
  // a save carries the time it was made ("at"), so when two windows disagree the newer one wins;
  // `last` is what was saved, so clicking around without changing anything writes nothing
  let ready = false, timer = 0, last = null;
  const body = () => JSON.stringify(Object.fromEntries(Object.entries(PARTS).map(([k, [read]]) => [k, read()])));
  const atOf = text => { try { return JSON.parse(text)?.at || 0; } catch { return 0; } };
  const isReset = text => { try { return !!JSON.parse(text)?.reset; } catch { return false; } };
  function save() {
    if (!ready) return;
    clearTimeout(timer);
    const b = body(); if (b === last) return;
    last = b;
    const text = b.slice(0, -1) + `,"at":${Date.now()}}`;
    try { localStorage.setItem(KEY, text); } catch { /* a private window or full storage: this session still works, it just won't be remembered */ }
    push(text);
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(save, 250); };
  const apply = text => {
    let saved = null;
    try { saved = JSON.parse(text); } catch { saved = null; }
    if (saved) Object.entries(PARTS).forEach(([k, [, put]]) => { if (k in saved) { try { put(saved[k]); } catch { /* a part that no longer fits is skipped */ } } });
    last = body();
  };
  // started over somewhere else: this window starts over too, without saving its old copy back
  const startOver = mark => { ready = false; clearTimeout(timer); try { localStorage.setItem(KEY, mark); } catch { /* ignore */ } location.reload(); };

  // ---------- the same data in every window on this computer ----------
  // When the app is served by serve.py, the server keeps a copy too. The app in your browser and the desktop widget
  // (desktop/widget.pyw) both read and write it, so a task ticked on the desktop is ticked in the browser, and the
  // other way round. On a plain static host there's no server, and this does nothing.
  let remote = false;
  function push(text) {
    if (!remote) return;
    fetch('api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: KEY, value: text }), keepalive: text.length < 60000 }).catch(() => {});
  }
  async function pull() {
    let theirs;
    try { const r = await fetch('api/state?key=' + KEY, { cache: 'no-store' }); if (!r.ok) return; theirs = (await r.json()).value; } catch { return; }
    remote = true;
    let mine = null; try { mine = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (!theirs) { if (mine && !isReset(mine)) push(mine); return; } // the server has nothing yet: give it ours
    const a = atOf(theirs), b = mine ? atOf(mine) : 0;
    if (a > b) {
      if (isReset(theirs)) { if (mine && !isReset(mine)) startOver(theirs); else { try { localStorage.setItem(KEY, theirs); } catch { /* ignore */ } } return; }
      apply(theirs); try { localStorage.setItem(KEY, theirs); } catch { /* ignore */ }
      onChange?.();
    } else if (b > a) push(mine);
  }

  // the app and the to-do widget can be open at once: when one saves, the others pick it up and redraw (onChange)
  let onChange = null;
  function restore(redraw) {
    onChange = redraw || null;
    let mine = null;
    try { mine = localStorage.getItem(KEY); } catch { /* storage blocked: start from the sample */ }
    if (mine) apply(mine); else last = body();
    addEventListener('storage', e => {
      if (e.key !== KEY && e.key !== null) return;
      if (!e.newValue || isReset(e.newValue)) { startOver(e.newValue || `{"reset":true,"at":${Date.now()}}`); return; }
      apply(e.newValue); onChange?.();
    });
    ready = true;
    // anything you click or type is saved a moment later, and once more when the page goes away
    ['click', 'input', 'change', 'keyup', 'pointerup'].forEach(t => document.addEventListener(t, soon, true));
    addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); else pull(); });
    // other windows' changes: check the server now and every few seconds while this window is showing
    pull();
    setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 2500);
  }
  // start over everywhere: stop saving first (or the save as the page unloads would write it all back),
  // leave a "started over" mark that the other windows and the server pick up, then reload
  function reset() {
    ready = false; clearTimeout(timer);
    const mark = `{"reset":true,"at":${Date.now()}}`;
    try { localStorage.setItem(KEY, mark); localStorage.removeItem('lo.rv.added'); } catch { /* nothing saved */ }
    if (remote) fetch('api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: KEY, value: mark }), keepalive: true }).catch(() => {});
    setTimeout(() => location.reload(), 120);
  }

  // ---------- Today → Hours ----------
  // which Hours category a finished task's time belongs to
  function hoursCat(t) {
    const s = (t.title || '').toLowerCase();
    let id = /football|turf|match/.test(s) ? 'sport'
      : /japanese|english|kana|read|study|course|lecture/.test(s) ? 'study'
      : t.cal === 'fit' ? 'gym' : t.cal === 'code' ? 'code' : t.cal === 'cre' ? 'create' : t.cal === 'life' ? 'life' : null;
    return id && CATS.some(c => c.id === id) ? id : null;
  }
  // a task's hours: an event has a start and an end; a one-off with a time takes an hour
  function span(t) {
    const e = EVENTS.find(x => x.id === t.id), s = e ? e.s : t.s;
    if (s == null) return null;
    const a = Math.floor(s), b = Math.max(a + 1, Math.ceil(e ? e.e : s + 1));
    return [a, Math.min(24, b)];
  }
  const hourDay = day => HOUR_DAYS.find(d => dayIdx(d.date) === day);
  // returns what it filled in, e.g. ["7–8 AM as Gym"], so Today can say so
  function syncHours(day = 0) {
    const hd = hourDay(day); if (!hd) return [];
    const k = dkey(hd.date), tasks = tasksForDay(day), said = [];
    Object.keys(AUTO).forEach(key => {
      const [dk, h] = key.split('|'); if (dk !== k) return;
      const a = AUTO[key];
      if (a.id === 'stamp') return; // a gym stamp from the archive stays until it's taken off there
      if (statusOf(day, a.id) === 'done' && tasks.some(t => t.id === a.id)) return;
      if (hd.cells[+h] === a.cat) hd.cells[+h] = null;
      delete AUTO[key];
    });
    tasks.forEach(t => {
      if (statusOf(day, t.id) !== 'done') return;
      const sp = span(t), cat = hoursCat(t); if (!sp || !cat) return;
      const got = [];
      for (let h = sp[0]; h < sp[1]; h++) {
        const key = k + '|' + h;
        if (AUTO[key] || hd.cells[h]) continue; // already filled, by this or by you: yours wins
        hd.cells[h] = cat; AUTO[key] = { id: t.id, cat }; got.push(h);
      }
      if (got.length) said.push(`${fmtHour(got[0])}${got.length > 1 ? '–' + fmtHour(got[got.length - 1] + 1) : ''} as ${CATS.find(c => c.id === cat).name}`);
    });
    return said;
  }
  // painting an hour by hand makes it yours
  function claim(hd, h) { delete AUTO[dkey(hd.date) + '|' + h]; }

  // ---------- Today and Hours → Review ----------
  const soFar = () => [...HOUR_DAYS].sort((a, b) => a.date - b.date); // Nov 1 … today
  const gymPlanned = D => eventsOn(D).some(e => e.cal === 'fit' && /gym/i.test(e.title));
  // gym days are the days with a Gym hour; the day of the deadlift PR gets its own stamp
  function deriveGym() {
    fill(GYM_STAMPS, {});
    soFar().forEach(d => { if (!d.cells.includes('gym')) return; const n = d.date.getDate(); GYM_STAMPS[n] = n === PR_DAY ? 'PR!' : (SPLIT[d.date.getDay()] || 'FULL'); });
  }
  // stamping a day in the archive puts a gym hour at 7 AM in Hours (remembering what was there); taking the stamp off
  // clears that day's gym hours and puts the 7 AM hour back the way it was
  function toggleGymDay(n) {
    const hd = HOUR_DAYS.find(d => d.date.getDate() === n); if (!hd) return false;
    const key = dkey(hd.date) + '|7';
    if (hd.cells.includes('gym')) {
      const prev = AUTO[key]?.prev ?? null;
      hd.cells = hd.cells.map(c => (c === 'gym' ? null : c));
      if (AUTO[key]?.id === 'stamp') { hd.cells[7] = prev; delete AUTO[key]; }
    } else {
      AUTO[key] = { id: 'stamp', cat: 'gym', prev: hd.cells[7] };
      hd.cells[7] = 'gym';
    }
    deriveGym(); soon();
    return !!GYM_STAMPS[n];
  }
  // today's DSA count follows the "2 DSA questions" routine: done = 2, started = 1
  function deriveDSA() {
    const r = ROUTINES.find(x => /dsa/i.test(x.title)); if (!r) return;
    const st = statusOf(0, r.id), i = TODAY.getDate() - 1;
    DSA_NOV[i] = st === 'done' ? 2 : st === 'prog' ? 1 : 0;
  }
  function sync() { syncHours(0); deriveGym(); deriveDSA(); }

  function stats() {
    const days = soFar(), first = 1 - TODAY.getDate();
    const hoursOf = id => days.reduce((n, d) => n + d.cells.filter(c => c === id).length, 0);
    // gym: sessions against the days a gym session was planned; the best run of planned days kept
    let planned = 0, run = 0, best = 0;
    for (let D = first; D <= 0; D++) {
      if (!gymPlanned(D)) continue;
      planned++;
      const n = addDays(TODAY, D).getDate();
      if (GYM_STAMPS[n]) { run++; best = Math.max(best, run); } else if (D < 0) run = 0;
    }
    const sessions = Object.keys(GYM_STAMPS).length;
    // DSA: questions, days with any, and the longest run of such days
    let qrun = 0, qbest = 0; DSA_NOV.forEach(v => { if (v > 0) { qrun++; qbest = Math.max(qbest, qrun); } else qrun = 0; });
    // Japanese: a day counts when its 9 PM hour is study (the Japanese slot); today counts once it's done
    const jpDays = days.map(d => d.cells[21] === 'study' || d.cells[22] === 'study');
    let jp = 0; for (let i = jpDays.length - 1; i >= 0; i--) { if (jpDays[i]) jp++; else if (i < jpDays.length - 1) break; }
    return {
      gym: { sessions, planned, att: planned ? Math.round(sessions / planned * 100) : 0, best },
      code: { questions: DSA_NOV.reduce((a, b) => a + b, 0), qdays: DSA_NOV.filter(v => v > 0).length, qbest, hours: hoursOf('code') },
      cre: { jp, jpDays, football: days.filter(d => d.cells.includes('sport')).length, createHours: hoursOf('create') },
      sleep: hoursOf('sleep'), logged: days.reduce((n, d) => n + d.cells.filter(Boolean).length, 0),
    };
  }

  // ---------- a project update, from anywhere: "KamiLabs · Chartwells: updated the link" ----------
  const FOLDER_WORDS = { kamilabs: 'kami', kami: 'kami', projects: 'proj', project: 'proj', personal: 'proj' };
  const allBooks = () => FOLDERS.flatMap(f => f.files.filter(id => FILES[id].book && !BOOKS[FILES[id].book].aggregate).map(id => ({ id, f, key: FILES[id].book, name: BOOKS[FILES[id].book].name })));
  // split "folder · project: what happened" (also "folder - project -> what", "project → what")
  function parseUpdate(raw) {
    const m = /^(.+?)\s*(?::|->|→|—|–(?=\s))\s*(.+)$/.exec(raw.trim());
    if (!m) return null;
    let parts = m[1].split(/\s*(?:·|\/|>|\s-\s|\|)\s*/).map(s => s.trim()).filter(Boolean), folder = null;
    if (parts.length > 1 && FOLDER_WORDS[parts[0].toLowerCase()]) folder = FOLDER_WORDS[parts.shift().toLowerCase()];
    else if (parts.length === 1) { const w = parts[0].split(/\s+/); if (w.length > 1 && FOLDER_WORDS[w[0].toLowerCase()]) { folder = FOLDER_WORDS[w.shift().toLowerCase()]; parts = [w.join(' ')]; } }
    const name = parts.join(' ').replace(/\s+project$/i, '').trim(), text = m[2].trim();
    if (!name || !text) return null;
    return { folder, name, text };
  }
  function findBook(name, folder) {
    const n = name.toLowerCase(), list = allBooks().filter(b => !folder || b.f.id === folder);
    return list.find(b => b.name.toLowerCase() === n) || list.find(b => b.name.toLowerCase().startsWith(n)) || list.find(b => n.startsWith(b.name.toLowerCase()));
  }
  // files the update under that project's week; a project it hasn't seen yet gets its own file first
  function logUpdate(raw) {
    const u = parseUpdate(raw);
    if (!u) return { ok: false, msg: 'Write it as Project: what happened' };
    let b = findBook(u.name, u.folder), made = false;
    if (!b) {
      const f = FOLDERS.find(x => x.id === (u.folder || 'proj'));
      const name = u.name.replace(/\b\w/g, c => c.toUpperCase());
      const id = RV.addFile(f, name); made = true;
      b = { id, f, key: FILES[id].book, name };
    }
    BOOKS[b.key].entries.push([TODAY.getMonth(), TODAY.getDate(), u.text]);
    RV.persist(); soon();
    return { ok: true, made, name: b.name, folder: b.f.short || b.f.name, href: '#review/' + b.id };
  }
  const recentBooks = (n = 4) => allBooks().map(b => ({ ...b, last: Math.max(0, ...BOOKS[b.key].entries.map(([m, d]) => m * 40 + d)) })).sort((a, b) => b.last - a.last).slice(0, n);

  return { restore, save, soon, reset, sync, syncHours, claim, toggleGymDay, stats, logUpdate, parseUpdate, recentBooks, hoursCat };
})();
