// Tessera · Board — core: state, storage, undo/redo, autosave, versions and live sync between tabs.
// Boards are saved in this browser (localStorage), with a copy on this computer under serve.py; every open tab is a live
// collaborator through a BroadcastChannel. The real app swaps both for its own backend (see the notes at the end).
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uid = (p = 'o') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const WB = window.WB = {
  board: null,          // { id, name, folder, meta }
  objs: {},             // id → object. Objects are never changed in place: every edit makes a new object.
  sel: new Set(),
  tool: 'select',
  cam: { x: 0, y: 0, z: 1 },
  peers: {},            // other tabs on this board: id → { name, color, x, y, sel, seen }
  undoStack: [], redoStack: [],
  status: 'saved',
  opts: { note: '#FFE380', shape: 'rect', fill: '#A9D8FF', line: 'curve', arrow: 'end', pen: '#1C1C1E', penW: 3, hl: '#FFE14D', stamp: '👍' },
};

// ---------- tiny event bus ----------
const subs = {};
WB.on = (ev, fn) => { (subs[ev] = subs[ev] || []).push(fn); };
WB.emit = (ev, data) => { (subs[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); };

// ---------- people ----------
WB.PEOPLE = { Prince: '#7B61FF', Riya: '#FF4F96', Aman: '#1F7BFF', Sara: '#22A55B', Kabir: '#FF8A00', Meera: '#14B88F', Dev: '#E5484D' };
(function initMe() {
  const q = new URLSearchParams(location.search);
  let me = null;
  try { me = JSON.parse(sessionStorage.getItem('tessera.wb.me')); } catch { /* new tab */ }
  const as = q.get('as');
  if (!me || (as && me.name !== as)) me = { id: uid('u'), name: as || 'Prince' };
  me.color = WB.PEOPLE[me.name] || '#8E8E93';
  try { sessionStorage.setItem('tessera.wb.me', JSON.stringify(me)); } catch { /* private mode */ }
  WB.me = me;
  WB.linkRole = q.get('role');
})();

// ---------- storage ----------
// boards are kept in this browser, and a copy goes to this computer when Tessera runs from serve.py (core/store.js
// brings them back if the browser loses them). Versions stay in the browser only.
const mirrorTimers = {};
// serve.py only listens on this computer: a copy opened from anywhere else (the one on Vercel) keeps boards in the browser only
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
function mirror(k, text) {
  if (!LOCAL || !/^tessera\.wb\.(index|folders|b\.)/.test(k)) return;
  clearTimeout(mirrorTimers[k]);
  mirrorTimers[k] = setTimeout(() => fetch('api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k, value: text }) }).catch(() => {}), 600);
}
const LS = WB.LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v, quiet) {
    const text = JSON.stringify(v);
    mirror(k, text);
    try { localStorage.setItem(k, text); return true; } catch (e) { if (!quiet) WB.emit('toast', 'This board is too big for browser storage, so it is only saved on this computer. Remove a large image.'); return false; }
  },
  del(k) { mirror(k, null); try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
WB.index = () => LS.get('tessera.wb.index', []);
WB.folders = () => LS.get('tessera.wb.folders', ['Personal', 'Projects']);
WB.setFolders = f => { LS.set('tessera.wb.folders', f); send({ t: 'index' }); WB.emit('index'); };
function writeIndex(b, objs) {
  const idx = WB.index().filter(x => x.id !== b.id);
  idx.push({ id: b.id, name: b.name, folder: b.folder, updated: Date.now(), count: Object.keys(objs).length, owner: (b.meta.members || []).find(m => m.role === 'owner')?.name });
  LS.set('tessera.wb.index', idx);
}
WB.getBoard = id => LS.get('tessera.wb.b.' + id, null);
WB.createBoard = (name, folder, objs = {}, id = uid('b')) => {
  const b = { id, name, folder, objs, meta: { members: [{ name: WB.me.name, role: 'owner' }], settings: { grid: true, bg: 'paper' } } };
  LS.set('tessera.wb.b.' + id, b); writeIndex(b, objs); send({ t: 'index' }); WB.emit('index');
  return b;
};
WB.renameBoard = (id, name) => {
  const b = id === WB.board?.id ? WB.board : WB.getBoard(id); if (!b || !name.trim()) return;
  b.name = name.trim();
  if (id === WB.board?.id) { WB.save(true); send({ t: 'meta', name: b.name }); WB.emit('board'); }
  else { LS.set('tessera.wb.b.' + id, b); writeIndex(b, b.objs); }
  send({ t: 'index' }); WB.emit('index');
};
WB.moveBoard = (id, folder) => {
  const b = id === WB.board?.id ? WB.board : WB.getBoard(id); if (!b) return;
  b.folder = folder;
  if (id === WB.board?.id) WB.save(true); else { LS.set('tessera.wb.b.' + id, b); writeIndex(b, b.objs); }
  send({ t: 'index' }); WB.emit('index'); WB.emit('board');
};
WB.duplicateBoard = id => {
  const src = id === WB.board?.id ? { ...WB.board, objs: WB.objs } : WB.getBoard(id); if (!src) return null;
  const b = WB.createBoard(src.name + ' copy', src.folder, clone(src.objs));
  return b;
};
WB.deleteBoard = id => {
  LS.del('tessera.wb.b.' + id); LS.del('tessera.wb.v.' + id);
  LS.set('tessera.wb.index', WB.index().filter(x => x.id !== id));
  send({ t: 'index', deleted: id }); WB.emit('index');
  if (id === WB.board?.id) { const next = WB.index()[0]; if (next) WB.openBoard(next.id); else WB.openBoard(WB.createBoard('Untitled board', 'Personal').id); }
};

// ---------- opening a board ----------
WB.role = () => (WB.board?.meta.members || []).find(m => m.name === WB.me.name)?.role || 'viewer';
WB.canEdit = () => WB.role() !== 'viewer';
WB.openBoard = id => {
  const b = WB.getBoard(id); if (!b) return false;
  if (WB.board) send({ t: 'bye' });
  WB.board = { id: b.id, name: b.name, folder: b.folder, meta: b.meta || { members: [] } };
  WB.board.meta.settings = WB.board.meta.settings || { grid: true, bg: 'paper' };
  WB.objs = b.objs || {};
  WB.sel = new Set(); WB.undoStack = []; WB.redoStack = []; WB.peers = {};
  WB.lastSnap = 0; WB.snapDue = true;
  // someone opening a shared link joins with the link's role
  const members = WB.board.meta.members;
  if (!members.some(m => m.name === WB.me.name) && (WB.linkRole === 'editor' || WB.linkRole === 'viewer')) {
    WB.board.meta.members = [...members, { name: WB.me.name, role: WB.linkRole }];
    WB.save(true); send({ t: 'meta', meta: WB.board.meta });
  }
  const q = new URLSearchParams(location.search); q.set('b', id);
  history.replaceState(null, '', location.pathname + '?' + q.toString());
  WB.status = 'saved';
  WB.emit('board');
  WB.fit();
  send({ t: 'hello' });
  return true;
};

// ---------- autosave and versions ----------
let saveT = 0;
WB.save = now => {
  if (!WB.board) return;
  WB.status = 'saving'; WB.emit('status');
  clearTimeout(saveT);
  const write = () => {
    const b = { ...WB.board, objs: WB.objs };
    const ok = LS.set('tessera.wb.b.' + b.id, b);
    if (ok) writeIndex(b, WB.objs);
    if (ok && (WB.snapDue || Date.now() - WB.lastSnap > 120000)) WB.snapshot('Autosave');
    WB.status = ok ? 'saved' : 'error'; WB.emit('status');
  };
  if (now) write(); else saveT = setTimeout(write, 450);
};
WB.versions = () => LS.get('tessera.wb.v.' + WB.board.id, []);
WB.snapshot = (label = 'Saved version', objs = WB.objs) => {
  let list = [{ t: Date.now(), by: WB.me.name, label, count: Object.keys(objs).length, objs }, ...WB.versions()].slice(0, 20);
  // keep as many versions as the browser has room for, newest first
  while (list.length > 1 && !LS.set('tessera.wb.v.' + WB.board.id, list, true)) list = list.slice(0, -1);
  if (list.length === 1) LS.set('tessera.wb.v.' + WB.board.id, list, true);
  WB.lastSnap = Date.now(); WB.snapDue = false; WB.emit('versions');
};
WB.restoreVersion = i => {
  const v = WB.versions()[i]; if (!v) return;
  WB.act('Restore version', () => {
    Object.keys(WB.objs).forEach(id => delete WB.objs[id]);
    Object.values(clone(v.objs)).forEach(o => { WB.objs[o.id] = { ...o, rev: (o.rev || 0) + 1 }; });
  });
  WB.sel = new Set(); WB.emit('sel');
};

// ---------- changes: begin → edit objects → commit (one undo step, one broadcast, one save) ----------
let pre = null, depth = 0;
WB.begin = () => { if (depth++ === 0) pre = { ...WB.objs }; };
WB.commit = label => {
  if (depth === 0) return false;
  if (--depth > 0) return false;
  const before = {}, after = {}; let n = 0;
  new Set([...Object.keys(pre), ...Object.keys(WB.objs)]).forEach(id => {
    if (pre[id] !== WB.objs[id]) { before[id] = pre[id] || null; after[id] = WB.objs[id] || null; n++; }
  });
  const pre0 = pre; pre = null;
  if (!n) return false;
  if (WB.snapDue) WB.snapshot('Before this session', pre0);
  WB.undoStack.push({ label, before, after });
  if (WB.undoStack.length > 200) WB.undoStack.shift();
  WB.redoStack = [];
  send({ t: 'ops', ch: after });
  WB.save(); WB.emit('change'); WB.emit('history');
  return true;
};
WB.cancel = () => { if (depth === 0) return; depth = 0; Object.keys(WB.objs).forEach(id => { if (!pre[id]) delete WB.objs[id]; }); Object.assign(WB.objs, pre); pre = null; WB.emit('change'); };
WB.inTx = () => depth > 0;
// run an edit as one undo step. Viewers can only do things marked { view: true } (comments, poll votes).
WB.act = (label, fn, o = {}) => {
  if (!WB.canEdit() && !o.view) { WB.emit('toast', 'You can view this board. Ask the owner for edit access.'); return false; }
  WB.begin();
  try { fn(); } catch (e) { console.error(e); }
  return WB.commit(label);
};
function applyChanges(ch) {
  Object.entries(ch).forEach(([id, o]) => { if (o) WB.objs[id] = o; else delete WB.objs[id]; });
  WB.sel = new Set([...WB.sel].filter(id => WB.objs[id]));
}
WB.undo = () => {
  if (!WB.canEdit()) return;
  const s = WB.undoStack.pop(); if (!s) return;
  applyChanges(s.before); WB.redoStack.push(s);
  send({ t: 'ops', ch: s.before }); WB.save(); WB.emit('change'); WB.emit('sel'); WB.emit('history');
  WB.emit('toast', 'Undid: ' + s.label);
};
WB.redo = () => {
  if (!WB.canEdit()) return;
  const s = WB.redoStack.pop(); if (!s) return;
  applyChanges(s.after); WB.undoStack.push(s);
  send({ t: 'ops', ch: s.after }); WB.save(); WB.emit('change'); WB.emit('sel'); WB.emit('history');
  WB.emit('toast', 'Redid: ' + s.label);
};

// ---------- object helpers (use inside WB.act / begin…commit) ----------
WB.topZ = () => { let m = 0; for (const id in WB.objs) m = Math.max(m, WB.objs[id].z || 0); return m; };
WB.add = o => {
  o.id = o.id || uid(); o.z = o.z ?? WB.topZ() + 1; o.rev = 1; o.by = WB.me.name; o.at = Date.now();
  WB.objs[o.id] = o; return o;
};
WB.update = (id, patch) => { const o = WB.objs[id]; if (!o) return null; return (WB.objs[id] = { ...o, ...patch, rev: (o.rev || 0) + 1 }); };
WB.remove = ids => {
  const set = new Set(ids);
  Object.values(WB.objs).forEach(o => { if (o.type === 'line' && (set.has(o.a?.id) || set.has(o.b?.id))) set.add(o.id); });
  set.forEach(id => delete WB.objs[id]);
  WB.sel = new Set([...WB.sel].filter(id => WB.objs[id]));
};
// live moves while dragging: shown to everyone at once, saved as one step on release
let liveQ = {}, liveF = 0;
WB.live = ids => {
  ids.forEach(id => { liveQ[id] = WB.objs[id] || null; });
  if (!liveF) liveF = requestAnimationFrame(() => { liveF = 0; send({ t: 'ops', ch: liveQ, live: true }); liveQ = {}; });
  WB.emit('change', { live: true });
};

// ---------- selection (groups select together) ----------
WB.expand = ids => {
  const out = new Set();
  ids.forEach(id => { const g = WB.objs[id]?.g; if (g) Object.values(WB.objs).forEach(o => { if (o.g === g) out.add(o.id); }); else if (WB.objs[id]) out.add(id); });
  return out;
};
WB.select = (ids, add = false) => {
  const s = add ? new Set(WB.sel) : new Set();
  WB.expand(ids).forEach(id => s.add(id));
  WB.setSel(s);
};
WB.setSel = s => { WB.sel = new Set([...s].filter(id => WB.objs[id])); WB.emit('sel'); WB.presence(); };

// ---------- camera ----------
WB.toWorld = (sx, sy) => ({ x: (sx - WB.cam.x) / WB.cam.z, y: (sy - WB.cam.y) / WB.cam.z });
WB.toScreen = (x, y) => ({ x: x * WB.cam.z + WB.cam.x, y: y * WB.cam.z + WB.cam.y });
WB.setCam = (x, y, z) => { WB.cam = { x, y, z: clamp(z, 0.08, 4) }; WB.emit('cam'); };
WB.zoomAt = (sx, sy, f) => {
  const z = clamp(WB.cam.z * f, 0.08, 4), w = WB.toWorld(sx, sy);
  WB.setCam(sx - w.x * z, sy - w.y * z, z);
};
WB.view = () => { // the free part of the window (between the bars and panels)
  const right = $('#panel')?.classList.contains('open') ? 300 : 0;
  return { x: 20, y: 76, w: innerWidth - 40 - right, h: innerHeight - 76 - 86 };
};
WB.fit = (ids, maxZ = 1) => {
  const list = (ids && ids.length ? ids : Object.keys(WB.objs)).map(id => WB.objs[id]).filter(Boolean);
  const v = WB.view();
  if (!list.length) { WB.setCam(v.x + v.w / 2, v.y + v.h / 2, 1); return; }
  const b = WB.bounds(list);
  const z = clamp(Math.min(v.w / (b.w + 120), v.h / (b.h + 120)), 0.08, maxZ);
  WB.setCam(v.x + v.w / 2 - (b.x + b.w / 2) * z, v.y + v.h / 2 - (b.y + b.h / 2) * z, z);
};
WB.center = () => { const v = WB.view(); return WB.toWorld(v.x + v.w / 2, v.y + v.h / 2); };

// ---------- geometry ----------
WB.box = o => {
  if (o.type === 'line') {
    const g = WB.lineEnds(o);
    return { x: Math.min(g.p1.x, g.p2.x), y: Math.min(g.p1.y, g.p2.y), w: Math.abs(g.p2.x - g.p1.x) || 1, h: Math.abs(g.p2.y - g.p1.y) || 1 };
  }
  if (!o.r) return { x: o.x, y: o.y, w: o.w, h: o.h };
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, a = o.r * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = o.w * c + o.h * s, h = o.w * s + o.h * c;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
};
WB.bounds = list => {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  list.forEach(o => { const b = WB.box(o); x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); });
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};
// where a connector touches an object: the edge point on the way to the other end
function edgePoint(o, toward) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  let dx = toward.x - cx, dy = toward.y - cy;
  if (!dx && !dy) dx = 1;
  if (o.type === 'shape' && o.kind === 'ellipse') { const k = 1 / Math.sqrt((dx * dx) / (o.w * o.w / 4) + (dy * dy) / (o.h * o.h / 4)); return { x: cx + dx * k, y: cy + dy * k, nx: dx, ny: dy }; }
  if (o.type === 'shape' && o.kind === 'diamond') { const k = 1 / (Math.abs(dx) / (o.w / 2) + Math.abs(dy) / (o.h / 2)); return { x: cx + dx * k, y: cy + dy * k, nx: dx, ny: dy }; }
  const k = Math.min(Math.abs((o.w / 2) / (dx || 1e-9)), Math.abs((o.h / 2) / (dy || 1e-9)));
  const x = cx + dx * k, y = cy + dy * k;
  const side = Math.abs(dx) * o.h > Math.abs(dy) * o.w ? { nx: Math.sign(dx), ny: 0 } : { nx: 0, ny: Math.sign(dy) };
  return { x, y, ...side };
}
const center = o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 });
WB.lineEnds = l => {
  const A = l.a?.id && WB.objs[l.a.id], B = l.b?.id && WB.objs[l.b.id];
  const ca = A ? center(A) : { x: l.a.x, y: l.a.y }, cb = B ? center(B) : { x: l.b.x, y: l.b.y };
  const p1 = A ? edgePoint(A, cb) : { ...ca, nx: cb.x - ca.x, ny: cb.y - ca.y };
  const p2 = B ? edgePoint(B, ca) : { ...cb, nx: ca.x - cb.x, ny: ca.y - cb.y };
  return { p1, p2 };
};

// ---------- meta (voting, timer, members, settings) ----------
WB.setMeta = (patch, quiet) => {
  WB.board.meta = { ...WB.board.meta, ...patch };
  if (!quiet) send({ t: 'meta', meta: patch });
  WB.save(); WB.emit('meta');
};

// ---------- live sync between tabs ----------
const chan = 'BroadcastChannel' in window ? new BroadcastChannel('lo-wb') : null;
function send(m) { if (chan) chan.postMessage({ ...m, b: WB.board?.id, u: { id: WB.me.id, name: WB.me.name, color: WB.me.color } }); }
WB.send = send;
let lastCur = { x: 0, y: 0 }, curT = 0;
WB.presence = (x, y) => {
  if (x != null) lastCur = { x, y };
  const now = performance.now(); if (now - curT < 33 && x != null) return; curT = now;
  send({ t: 'cur', x: lastCur.x, y: lastCur.y, sel: [...WB.sel], role: WB.role() });
};
if (chan) chan.onmessage = ({ data: m }) => {
  if (!m || m.u?.id === WB.me.id) return;
  if (m.t === 'index') { WB.emit('index'); if (m.deleted && m.deleted === WB.board?.id) { const n = WB.index()[0]; if (n) WB.openBoard(n.id); } return; }
  if (!WB.board || m.b !== WB.board.id) return;
  const p = WB.peers[m.u.id] || (WB.peers[m.u.id] = { ...m.u });
  p.seen = Date.now();
  if (m.t === 'hello') { send({ t: 'state', objs: WB.objs, meta: WB.board.meta }); WB.presence(); WB.emit('peers'); }
  else if (m.t === 'state') {
    let n = 0;
    Object.values(m.objs || {}).forEach(o => { const mine = WB.objs[o.id]; if (!mine || (o.rev || 0) > (mine.rev || 0)) { WB.objs[o.id] = o; n++; } });
    if (m.meta) { WB.board.meta = { ...WB.board.meta, vote: m.meta.vote, timer: m.meta.timer, members: m.meta.members }; WB.emit('meta'); }
    if (n) WB.emit('change');
  }
  else if (m.t === 'cur') { Object.assign(p, { x: m.x, y: m.y, sel: m.sel, role: m.role }); WB.emit('peers'); }
  else if (m.t === 'bye') { delete WB.peers[m.u.id]; WB.emit('peers'); }
  else if (m.t === 'ops') { applyChanges(m.ch); WB.emit('change', { remote: true, live: m.live }); if (!m.live) WB.emit('history'); }
  else if (m.t === 'meta') { if (m.name) { WB.board.name = m.name; WB.emit('board'); } if (m.meta) { WB.board.meta = { ...WB.board.meta, ...m.meta }; WB.emit('meta'); } }
  else if (m.t === 'react') WB.emit('react', m);
  else WB.emit('msg', m);
};
setInterval(() => {
  if (!WB.board) return;
  WB.presence();
  let gone = false;
  Object.entries(WB.peers).forEach(([id, p]) => { if (Date.now() - p.seen > 7000) { delete WB.peers[id]; gone = true; } });
  if (gone) WB.emit('peers');
}, 2000);
addEventListener('pagehide', () => send({ t: 'bye' }));
// another tab changed the board list
addEventListener('storage', e => { if (e.key === 'tessera.wb.index' || e.key === 'tessera.wb.folders') WB.emit('index'); });

/* Moving this to the real app (Tauri + React):
   - storage → the app's database: one row per board, objects as JSON (or a row per object for big boards)
   - BroadcastChannel → a WebSocket room per board on the app's backend; the messages above stay the same
     (hello / state / ops / cur / meta / react / bye) so this file is the only one that changes
   - members and roles → the app's own accounts instead of names in the link */
