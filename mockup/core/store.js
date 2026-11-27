// Tessera · one saved store, and the rules that tie the pages together.
//   Calendar → Today: Today lists what the calendar has for the day (tasksForDay in data/data.js).
//   Today → Hours: finishing a task that has a time fills its hours in, in the matching category.
//   Hours → Review: a monthly folder counts its category's hours, day by day.
// Everything is saved in this browser and, under serve.py, on this computer too, where it is backed up every day.
'use strict';
const STORE = (() => {
  const KEY = 'tessera.state';
  // the other keys pages keep in this browser (the walls, the ideas boards): the server keeps a copy of them too
  const MIRRORED = /^tessera\.(walls|wb\.(index|folders|b\.))/;
  const fill = (obj, v) => { if (!v || typeof v !== 'object') return; Object.keys(obj).forEach(k => delete obj[k]); Object.assign(obj, v); };
  const refill = (arr, v) => { if (Array.isArray(v)) arr.splice(0, arr.length, ...v); };
  // hours filled in from a finished task: 'YYYY-MM-DD|hour' → { id, cat }. Un-finishing the task takes them back,
  // unless you painted over them yourself (then they're yours). A stamp from Review is { id: 'stamp', cat, prev }.
  const AUTO = {};

  // ---------- what is saved: name → [read it, put it back] ----------
  const PARTS = {
    status: [() => STATUS, v => fill(STATUS, v)],
    notes: [() => PNOTES, v => fill(PNOTES, v)],
    stars: [() => STARS, v => fill(STARS, v)],
    oneoffs: [() => ONEOFFS, v => refill(ONEOFFS, v)],
    events: [() => EVENTS, v => refill(EVENTS, v)],
    routines: [() => ROUTINES, v => refill(ROUTINES, v)],
    cats: [() => CATS, v => { if (Array.isArray(v) && v.length) CATS = v; }],
    hours: [() => HOURS, v => fill(HOURS, v)],
    auto: [() => AUTO, v => fill(AUTO, v)],
    archive: [() => ARCHIVE, v => { if (v && Array.isArray(v.folders)) { ARCHIVE.folders = v.folders; ARCHIVE.projects = v.projects || {}; ARCHIVE.months = v.months || {}; } }],
    sort: [() => SORT_LEARNED, v => refill(SORT_LEARNED, v)],
  };
  // a save carries the time it was made ("at"), so when two windows disagree the newer one wins;
  // `last` is what was saved, so clicking around without changing anything writes nothing
  let ready = false, timer = 0, last = null, savedAt = 0, remote = false;
  const body = () => JSON.stringify(Object.fromEntries(Object.entries(PARTS).map(([k, [read]]) => [k, read()])));
  const atOf = text => { try { return JSON.parse(text)?.at || 0; } catch { return 0; } };
  const local = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  };
  function save() {
    if (!ready) return;
    clearTimeout(timer);
    const b = body(); if (b === last) return;
    last = b; savedAt = Date.now();
    const text = b.slice(0, -1) + `,"at":${savedAt}}`;
    if (!local.set(KEY, text)) toast('This browser would not save. Your changes are kept on this computer only while the server runs');
    push(KEY, text);
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(save, 250); };
  const apply = text => {
    let saved = null;
    try { saved = JSON.parse(text); } catch { saved = null; }
    if (saved) Object.entries(PARTS).forEach(([k, [, put]]) => { if (k in saved) { try { put(saved[k]); } catch { /* a part that no longer fits is skipped */ } } });
    last = body();
  };

  // ---------- the copy on this computer (serve.py) ----------
  // The app and the desktop widget both read and write it, so a task ticked on the desktop is ticked in the browser.
  // On a plain static host there's no server, and this does nothing.
  const post = (key, value) => fetch('api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }), keepalive: !value || value.length < 60000 });
  function push(key, value) { if (remote) post(key, value).catch(() => {}); }
  async function getJSON(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); }
  // another window saved something newer: take it
  async function pull() {
    let theirs;
    try { theirs = (await getJSON('api/state?key=' + KEY)).value; } catch { return; }
    remote = true;
    const mine = local.get(KEY);
    if (!theirs) { if (mine) push(KEY, mine); return; }         // the server has nothing yet: give it ours
    const a = atOf(theirs), b = mine ? atOf(mine) : 0;
    if (a > b) { apply(theirs); local.set(KEY, theirs); onChange?.(); } else if (b > a) push(KEY, mine);
  }
  // the walls and boards: whatever this browser lost (cleared data, a new browser) comes back from the server,
  // and whatever the server doesn't have yet goes to it. Returns how many keys came back.
  async function syncMirrored() {
    let keys;
    try { keys = (await getJSON('api/state?prefix=tessera.')).keys; } catch { return 0; }
    let back = 0;
    Object.entries(keys).forEach(([k, v]) => { if (k !== KEY && MIRRORED.test(k) && v != null && local.get(k) == null && local.set(k, v)) back++; });
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (MIRRORED.test(k) && !(k in keys)) post(k, local.get(k)).catch(() => {}); }
    return back;
  }
  // a page that keeps its own key in this browser calls this after saving it
  const mirrorTimers = {};
  function mirror(key, value) {
    if (!MIRRORED.test(key)) return;
    clearTimeout(mirrorTimers[key]);
    mirrorTimers[key] = setTimeout(() => push(key, value), 600);
  }

  // the app and the to-do widget can be open at once: when one saves, the others pick it up and redraw (onChange)
  let onChange = null;
  function restore(redraw) {
    onChange = redraw || null;
    const mine = local.get(KEY);
    if (mine) apply(mine); else last = body();
    addEventListener('storage', e => { if (e.key === KEY && e.newValue) { apply(e.newValue); onChange?.(); } });
    ready = true;
    // anything you click or type is saved a moment later, and once more when the page goes away
    ['click', 'input', 'change', 'keyup', 'pointerup'].forEach(t => document.addEventListener(t, soon, true));
    addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); else pull(); });
    // other windows' changes: check the server now and every few seconds while this window is showing
    pull().then(async () => {
      if (!remote) return;
      const back = await syncMirrored();
      // walls or boards came back from the server: load once more so the pages read them (once per visit, never in a loop)
      if (back && !sessionStorage.getItem('tessera.restored')) { sessionStorage.setItem('tessera.restored', '1'); location.reload(); }
    });
    setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 2500);
  }

  // ---------- backups: a file you keep, and the daily copies on this computer ----------
  async function everything() {
    const keys = {};
    if (remote) { try { Object.assign(keys, (await getJSON('api/state?prefix=tessera.')).keys); } catch { /* this browser's copy will do */ } }
    save();
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === KEY || MIRRORED.test(k)) keys[k] = local.get(k); }
    return keys;
  }
  async function download() {
    const file = { app: 'tessera', version: 1, made: new Date().toISOString(), keys: await everything() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
    a.download = `tessera-backup-${dkey(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  // puts a downloaded copy back: everything it holds replaces what's here (the server keeps a copy of what was here first)
  async function restoreFile(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { throw new Error('That file isn’t a Tessera backup'); }
    if (data?.app !== 'tessera' || !data.keys || typeof data.keys !== 'object') throw new Error('That file isn’t a Tessera backup');
    const keys = Object.entries(data.keys).filter(([k, v]) => (k === KEY || MIRRORED.test(k)) && typeof v === 'string');
    if (!keys.some(([k]) => k === KEY)) throw new Error('That backup has no saved state in it');
    ready = false; clearTimeout(timer);
    if (remote) await fetch('api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'before-restore' }) }).catch(() => {});
    const stamped = ([k, v]) => [k, k === KEY ? v.replace(/"at":\d+}$/, `"at":${Date.now()}}`) : v]; // newest, so every window takes it
    for (const [k, v] of keys.map(stamped)) { local.set(k, v); if (remote) await post(k, v).catch(() => {}); }
    sessionStorage.removeItem('tessera.restored');
    location.reload();
  }
  async function backups() { return remote ? getJSON('api/backups') : null; }
  async function backupNow() {
    save();
    const r = await fetch('api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return (await r.json()).name;
  }
  const info = () => ({ remote, savedAt });

  // ---------- Today → Hours ----------
  // which Hours category a finished task's time belongs to
  function hoursCat(t) {
    const s = (t.title || '').toLowerCase();
    const id = /football|cricket|turf|match|badminton|tennis|swim/.test(s) ? 'sport'
      : /japanese|english|kana|read|study|course|lecture|exam/.test(s) ? 'study'
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
  // fills in the hours of the day's finished tasks; returns what it filled in, e.g. ["7–8 AM as Gym"], so Today can say so
  function syncHours(D = T) {
    const k = keyOf(D), tasks = tasksForDay(D), said = [];
    let cells = HOURS[k];
    Object.keys(AUTO).forEach(key => {
      const [dk, h] = key.split('|'); if (dk !== k) return;
      const a = AUTO[key];
      if (a.id === 'stamp') return; // a stamp from Review stays until it's taken off there
      if (statusOf(D, a.id) === 'done' && tasks.some(t => t.id === a.id)) return;
      if (cells && cells[+h] === a.cat) cells[+h] = null;
      delete AUTO[key];
    });
    tasks.forEach(t => {
      if (statusOf(D, t.id) !== 'done') return;
      const sp = span(t), cat = hoursCat(t); if (!sp || !cat) return;
      cells = hoursFor(D);
      const got = [];
      for (let h = sp[0]; h < sp[1]; h++) {
        const key = k + '|' + h;
        if (AUTO[key] || cells[h]) continue; // already filled, by this or by you: yours wins
        cells[h] = cat; AUTO[key] = { id: t.id, cat }; got.push(h);
      }
      if (got.length) said.push(`${fmtHour(got[0])}${got.length > 1 ? '–' + fmtHour(got[got.length - 1] + 1) : ''} as ${CATS.find(c => c.id === cat).name}`);
    });
    return said;
  }
  // painting an hour by hand makes it yours
  function claim(D, h) { delete AUTO[keyOf(D) + '|' + h]; }

  // ---------- Hours → Review ----------
  const catHours = (cat, D) => hoursOn(D).filter(c => c === cat).length;
  // stamping a day in Review puts an hour of the folder's category on it (the first free hour from 7 AM, remembering what was
  // there); taking the stamp off clears that day's hours of the category and puts the stamped hour back as it was
  function toggleCatDay(cat, D) {
    const cells = hoursFor(D), k = keyOf(D);
    if (cells.includes(cat)) {
      Object.keys(AUTO).forEach(key => { const [dk, h] = key.split('|'); if (dk === k && AUTO[key].id === 'stamp' && AUTO[key].cat === cat) { cells[+h] = AUTO[key].prev ?? null; delete AUTO[key]; } });
      cells.forEach((c, h) => { if (c === cat) cells[h] = null; });
      soon(); return false;
    }
    let h = [...Array(24).keys()].map(i => (i + 7) % 24).find(i => !cells[i]);
    if (h == null) h = 7;
    AUTO[k + '|' + h] = { id: 'stamp', cat, prev: cells[h] };
    cells[h] = cat;
    soon(); return true;
  }
  // days in a row up to today that pass the test (today counts once it does; until then the run ends yesterday)
  function streak(test) {
    let n = 0, D = test(T) ? T : T - 1;
    while (test(D) && n < 3660) { n++; D--; }
    return n;
  }
  const doneOn = D => Object.keys(STATUS).filter(k => k.startsWith(D + '|') && STATUS[k] === 'done').length;
  const sync = () => syncHours(T);

  // ---------- a project update, from anywhere: "Portfolio: fixed the nav", "Work · Website: shipped" ----------
  const allProjects = () => Object.values(ARCHIVE.projects).map(p => ({ ...p, folderName: folderById(p.folder)?.name || '' }));
  function parseUpdate(raw) {
    const m = /^(.+?)\s*(?::|->|→|—|–(?=\s))\s*(.+)$/.exec(raw.trim());
    if (!m) return null;
    const parts = m[1].split(/\s*(?:·|\/|>|\s-\s|\|)\s*/).map(s => s.trim()).filter(Boolean);
    const folder = parts.length > 1 ? parts.shift() : null, name = parts.join(' ').replace(/\s+project$/i, '').trim(), text = m[2].trim();
    return name && text ? { folder, name, text } : null;
  }
  function findProject(name, folder) {
    const n = name.toLowerCase(), list = allProjects().filter(p => !folder || p.folderName.toLowerCase() === folder.toLowerCase());
    return list.find(p => p.name.toLowerCase() === n) || list.find(p => p.name.toLowerCase().startsWith(n)) || list.find(p => n.startsWith(p.name.toLowerCase()));
  }
  // a new project, in a projects folder (one called "Projects" is made if there's none yet)
  function newProject(name, f) {
    if (!f) {
      f = ARCHIVE.folders.find(x => x.kind === 'projects');
      if (!f) { f = { id: 'f' + Date.now().toString(36), name: 'Projects', ground: 'night', kind: 'projects', created: keyOf(T) }; ARCHIVE.folders.push(f); }
    }
    const p = { id: 'p' + Date.now().toString(36), folder: f.id, name, created: keyOf(T), status: 'ACTIVE', tagline: 'Just started.', about: '', note: '', plan: [], entries: [] };
    ARCHIVE.projects[p.id] = p; soon();
    return p;
  }
  // files the update under today in that project's file; a project it hasn't seen yet gets its own file first
  function logUpdate(raw) {
    const u = parseUpdate(raw);
    if (!u) return { ok: false, msg: 'Write it as Project: what happened' };
    let p = findProject(u.name, u.folder), made = false;
    if (!p) {
      const f = u.folder ? ARCHIVE.folders.find(x => x.kind === 'projects' && x.name.toLowerCase() === u.folder.toLowerCase()) : null;
      p = newProject(u.name.replace(/\b\w/g, c => c.toUpperCase()), f); made = true;
    }
    ARCHIVE.projects[p.id].entries.push([keyOf(T), u.text]);
    soon();
    const f = folderById(p.folder);
    return { ok: true, made, name: p.name, folder: f.name, href: '#review/' + p.id };
  }
  const recentProjects = (n = 4) => allProjects().map(p => ({ ...p, last: p.entries.reduce((m, e) => (e[0] > m ? e[0] : m), p.created) })).sort((a, b) => (a.last < b.last ? 1 : -1)).slice(0, n);

  return { restore, save, soon, mirror, sync, syncHours, claim, catHours, toggleCatDay, streak, doneOn, logUpdate, newProject, recentProjects, hoursCat, download, restoreFile, backups, backupNow, info };
})();
