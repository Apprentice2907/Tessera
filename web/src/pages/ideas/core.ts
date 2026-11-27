// Tessera · Ideas board — the core: state, storage, undo/redo, autosave, versions and live sync between tabs.
// Boards are saved in this browser (localStorage) and, under serve.py, a copy goes to this computer through the app's
// mirror() (store/persist.ts), the one place that decides where saved keys go. Every open tab is a live collaborator
// through a BroadcastChannel. React reads this state through useWB(), which re-renders on the events it names.
import { useCallback, useSyncExternalStore } from 'react';
import { mirror, mirrored } from '../../store/persist';
import { toast } from '../../store/ui';
import type { Board, End, IndexEntry, Me, Meta, Obj, Objs, Opts, Peer, SavedBoard, Tool, Version } from './types';

export const uid = (p = 'o') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Step { label: string; before: Record<string, Obj | null>; after: Record<string, Obj | null> }

export const WB = {
  board: null as Board | null,      // { id, name, folder, meta }
  objs: {} as Objs,                 // id → object. Objects are never changed in place: every edit makes a new object.
  sel: new Set<string>(),
  tool: 'select' as Tool,
  cam: { x: 0, y: 0, z: 1 },
  peers: {} as Record<string, Peer>, // other tabs on this board
  undoStack: [] as Step[], redoStack: [] as Step[],
  status: 'saved' as 'saved' | 'saving' | 'error',
  opts: { note: '#FFE380', shape: 'rect', fill: '#A9D8FF', line: 'curve', arrow: 'end', pen: '#1C1C1E', penW: 3, hl: '#FFE14D', stamp: '\u{1F44D}' } as Opts,
  me: { id: '', name: 'Prince', color: '#7B61FF' } as Me,
  linkRole: null as string | null,
  clip: null as Obj[] | null,       // what Copy took, for Paste here
  lastSnap: 0, snapDue: true,
};

// ---------- events: the board's parts say what changed; React re-renders the parts that listen ----------
export type Ev = 'change' | 'sel' | 'cam' | 'board' | 'meta' | 'tool' | 'status' | 'history' | 'versions' | 'index' | 'peers' | 'overlay' | 'ui' | 'edit';
type Fn = (data?: unknown) => void;
const subs: Partial<Record<Ev, Set<Fn>>> = {};
const ticks: Record<string, number> = {};
export const on = (ev: Ev, fn: Fn) => { (subs[ev] ??= new Set()).add(fn); return () => { subs[ev]!.delete(fn); }; };
export function emit(ev: Ev, data?: unknown) {
  ticks[ev] = (ticks[ev] || 0) + 1;
  subs[ev]?.forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
}
/** re-render when any of these events fires */
export function useWB(...evs: Ev[]) {
  const key = evs.join(' ');
  const sub = useCallback((cb: () => void) => { const offs = evs.map(e => on(e, cb)); return () => offs.forEach(f => f()); }, [key]);
  return useSyncExternalStore(sub, () => evs.map(e => ticks[e] || 0).join('.'));
}

// ---------- people ----------
export const PEOPLE: Record<string, string> = { Prince: '#7B61FF', Riya: '#FF4F96', Aman: '#1F7BFF', Sara: '#22A55B', Kabir: '#FF8A00', Meera: '#14B88F', Dev: '#E5484D' };
/** who this tab is: kept for the tab's life in sessionStorage; ?as=<name> joins as someone else, ?role= with a link's role */
function initMe(q: URLSearchParams) {
  let me: Me | null = null;
  try { me = JSON.parse(sessionStorage.getItem('tessera.wb.me') as string); } catch { /* new tab */ }
  const as = q.get('as');
  if (!me || (as && me.name !== as)) me = { id: uid('u'), name: as || 'Prince' } as Me;
  me.color = PEOPLE[me.name] || '#8E8E93';
  try { sessionStorage.setItem('tessera.wb.me', JSON.stringify(me)); } catch { /* private mode */ }
  WB.me = me;
  WB.linkRole = q.get('role');
}

// ---------- storage ----------
// boards are kept in this browser, and mirror() sends a copy to this computer when Tessera runs from serve.py
// (persist.ts brings them back if the browser loses them). Versions stay in the browser only.
export const LS = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k: string, v: unknown, quiet?: boolean) {
    const text = JSON.stringify(v);
    mirror(k, text);
    try { localStorage.setItem(k, text); return true; } catch { if (!quiet) toast('This board is too big for browser storage, so it is only saved on this computer. Remove a large image.'); return false; }
  },
  del(k: string) { mirror(k, null); try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export const index = () => LS.get<IndexEntry[]>('tessera.wb.index', []);
export const folders = () => LS.get<string[]>('tessera.wb.folders', ['Personal', 'Projects']);
export const setFolders = (f: string[]) => { LS.set('tessera.wb.folders', f); send({ t: 'index' }); emit('index'); };
function writeIndex(b: Board, objs: Objs) {
  const idx = index().filter(x => x.id !== b.id);
  idx.push({ id: b.id, name: b.name, folder: b.folder, updated: Date.now(), count: Object.keys(objs).length, owner: (b.meta.members || []).find(m => m.role === 'owner')?.name });
  LS.set('tessera.wb.index', idx);
}
export const getBoard = (id: string) => LS.get<SavedBoard | null>('tessera.wb.b.' + id, null);
export function createBoard(name: string, folder: string, objs: Objs = {}, id = uid('b')) {
  const b: SavedBoard = { id, name, folder, objs, meta: { members: [{ name: WB.me.name, role: 'owner' }], settings: { grid: true, bg: 'paper' } } };
  LS.set('tessera.wb.b.' + id, b); writeIndex(b, objs); send({ t: 'index' }); emit('index');
  return b;
}
export function renameBoard(id: string, name: string) {
  const b = id === WB.board?.id ? WB.board : getBoard(id); if (!b || !name.trim()) return;
  b.name = name.trim();
  if (id === WB.board?.id) { save(true); send({ t: 'meta', name: b.name }); emit('board'); }
  else { LS.set('tessera.wb.b.' + id, b); writeIndex(b, (b as SavedBoard).objs); }
  send({ t: 'index' }); emit('index');
}
export function moveBoard(id: string, folder: string) {
  const b = id === WB.board?.id ? WB.board : getBoard(id); if (!b) return;
  b.folder = folder;
  if (id === WB.board?.id) save(true); else { LS.set('tessera.wb.b.' + id, b); writeIndex(b, (b as SavedBoard).objs); }
  send({ t: 'index' }); emit('index'); emit('board');
}
export function duplicateBoard(id: string) {
  const src = id === WB.board?.id ? { ...WB.board, objs: WB.objs } : getBoard(id); if (!src) return null;
  return createBoard(src.name + ' copy', src.folder, clone(src.objs));
}
export function deleteBoard(id: string) {
  LS.del('tessera.wb.b.' + id); LS.del('tessera.wb.v.' + id);
  LS.set('tessera.wb.index', index().filter(x => x.id !== id));
  send({ t: 'index', deleted: id }); emit('index');
  if (id === WB.board?.id) { const next = index()[0]; if (next) openBoard(next.id); else openBoard(createBoard('Untitled board', 'Personal').id); }
}

// ---------- opening a board ----------
export const role = () => (WB.board?.meta.members || []).find(m => m.name === WB.me.name)?.role || 'viewer';
export const canEdit = () => role() !== 'viewer';
let lastOpen: string | null = null; // the board you had open, for the next visit to Ideas
export function openBoard(id: string | null | undefined) {
  const b = id ? getBoard(id) : null; if (!b) return false;
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
    save(true); send({ t: 'meta', meta: WB.board.meta });
  }
  lastOpen = b.id;
  WB.status = 'saved';
  emit('board'); emit('sel'); emit('history');
  fit();
  send({ t: 'hello' });
  return true;
}

// ---------- autosave and versions ----------
let saveT = 0;
export function save(now?: boolean) {
  if (!WB.board) return;
  WB.status = 'saving'; emit('status');
  clearTimeout(saveT);
  const write = () => {
    if (!WB.board) return;
    const b = { ...WB.board, objs: WB.objs };
    const ok = LS.set('tessera.wb.b.' + b.id, b);
    if (ok) writeIndex(b, WB.objs);
    if (ok && (WB.snapDue || Date.now() - WB.lastSnap > 120000)) snapshot('Autosave');
    WB.status = ok ? 'saved' : 'error'; emit('status');
  };
  if (now) write(); else saveT = window.setTimeout(write, 450);
}
export const versions = () => (WB.board ? LS.get<Version[]>('tessera.wb.v.' + WB.board.id, []) : []);
export function snapshot(label = 'Saved version', objs: Objs = WB.objs) {
  if (!WB.board) return;
  let list: Version[] = [{ t: Date.now(), by: WB.me.name, label, count: Object.keys(objs).length, objs }, ...versions()].slice(0, 20);
  // keep as many versions as the browser has room for, newest first
  while (list.length > 1 && !LS.set('tessera.wb.v.' + WB.board.id, list, true)) list = list.slice(0, -1);
  if (list.length === 1) LS.set('tessera.wb.v.' + WB.board.id, list, true);
  WB.lastSnap = Date.now(); WB.snapDue = false; emit('versions');
}
export function restoreVersion(i: number) {
  const v = versions()[i]; if (!v) return;
  act('Restore version', () => {
    Object.keys(WB.objs).forEach(id => delete WB.objs[id]);
    Object.values(clone(v.objs)).forEach(o => { WB.objs[o.id] = { ...o, rev: (o.rev || 0) + 1 }; });
  });
  WB.sel = new Set(); emit('sel');
}

// ---------- changes: begin → edit objects → commit (one undo step, one broadcast, one save) ----------
let pre: Objs | null = null, depth = 0;
export const begin = () => { if (depth++ === 0) pre = { ...WB.objs }; };
export function commit(label: string) {
  if (depth === 0) return false;
  if (--depth > 0) return false;
  const before: Record<string, Obj | null> = {}, after: Record<string, Obj | null> = {}; let n = 0;
  const pre0 = pre!; pre = null;
  new Set([...Object.keys(pre0), ...Object.keys(WB.objs)]).forEach(id => {
    if (pre0[id] !== WB.objs[id]) { before[id] = pre0[id] || null; after[id] = WB.objs[id] || null; n++; }
  });
  if (!n) return false;
  if (WB.snapDue) snapshot('Before this session', pre0);
  WB.undoStack.push({ label, before, after });
  if (WB.undoStack.length > 200) WB.undoStack.shift();
  WB.redoStack = [];
  send({ t: 'ops', ch: after });
  save(); emit('change'); emit('history');
  return true;
}
export function cancel() {
  if (depth === 0 || !pre) return;
  depth = 0;
  const p = pre; pre = null;
  Object.keys(WB.objs).forEach(id => { if (!p[id]) delete WB.objs[id]; });
  Object.assign(WB.objs, p);
  emit('change');
}
export const inTx = () => depth > 0;
const VIEW_ONLY = 'You can view this board. Ask the owner for edit access.';
export const viewOnly = () => toast(VIEW_ONLY);
/** run an edit as one undo step. Viewers can only do things marked { view: true } (comments, poll votes). */
export function act(label: string, fn: () => void, o: { view?: boolean } = {}) {
  if (!canEdit() && !o.view) { viewOnly(); return false; }
  begin();
  try { fn(); } catch (e) { console.error(e); }
  return commit(label);
}
function applyChanges(ch: Record<string, Obj | null>) {
  Object.entries(ch).forEach(([id, o]) => { if (o) WB.objs[id] = o; else delete WB.objs[id]; });
  WB.sel = new Set([...WB.sel].filter(id => WB.objs[id]));
}
export function undo() {
  if (!canEdit()) return;
  const s = WB.undoStack.pop(); if (!s) return;
  applyChanges(s.before); WB.redoStack.push(s);
  send({ t: 'ops', ch: s.before }); save(); emit('change'); emit('sel'); emit('history');
  toast('Undid: ' + s.label);
}
export function redo() {
  if (!canEdit()) return;
  const s = WB.redoStack.pop(); if (!s) return;
  applyChanges(s.after); WB.undoStack.push(s);
  send({ t: 'ops', ch: s.after }); save(); emit('change'); emit('sel'); emit('history');
  toast('Redid: ' + s.label);
}

// ---------- object helpers (use inside act / begin…commit) ----------
export const topZ = () => { let m = 0; for (const id in WB.objs) m = Math.max(m, WB.objs[id].z || 0); return m; };
export type NewObj = Partial<Obj> & { type: Obj['type'] };
export function add(o: NewObj): Obj {
  o.id = o.id || uid(); o.z = o.z ?? topZ() + 1; o.rev = 1; o.by = WB.me.name; o.at = Date.now();
  WB.objs[o.id] = o as Obj; return o as Obj;
}
export function update(id: string, patch: Partial<Obj>) {
  const o = WB.objs[id]; if (!o) return null;
  return (WB.objs[id] = { ...o, ...patch, rev: (o.rev || 0) + 1 });
}
export function remove(ids: Iterable<string>) {
  const set = new Set(ids);
  Object.values(WB.objs).forEach(o => { if (o.type === 'line' && ((o.a?.id && set.has(o.a.id)) || (o.b?.id && set.has(o.b.id)))) set.add(o.id); });
  set.forEach(id => delete WB.objs[id]);
  WB.sel = new Set([...WB.sel].filter(id => WB.objs[id]));
}
// live moves while dragging: shown to everyone at once, saved as one step on release
let liveQ: Record<string, Obj | null> = {}, liveF = 0;
export function live(ids: string[]) {
  ids.forEach(id => { liveQ[id] = WB.objs[id] || null; });
  if (!liveF) liveF = requestAnimationFrame(() => { liveF = 0; send({ t: 'ops', ch: liveQ, live: true }); liveQ = {}; });
  emit('change', { live: true });
}

// ---------- selection (groups select together) ----------
export function expand(ids: Iterable<string>) {
  const out = new Set<string>();
  for (const id of ids) {
    const g = WB.objs[id]?.g;
    if (g) Object.values(WB.objs).forEach(o => { if (o.g === g) out.add(o.id); }); else if (WB.objs[id]) out.add(id);
  }
  return out;
}
export function select(ids: Iterable<string>, addTo = false) {
  const s = addTo ? new Set(WB.sel) : new Set<string>();
  expand(ids).forEach(id => s.add(id));
  setSel(s);
}
export function setSel(s: Set<string>) { WB.sel = new Set([...s].filter(id => WB.objs[id])); emit('sel'); presence(); }
export const selObjs = () => [...WB.sel].map(id => WB.objs[id]).filter(Boolean);

// ---------- camera ----------
export const toWorld = (sx: number, sy: number) => ({ x: (sx - WB.cam.x) / WB.cam.z, y: (sy - WB.cam.y) / WB.cam.z });
export const toScreen = (x: number, y: number) => ({ x: x * WB.cam.z + WB.cam.x, y: y * WB.cam.z + WB.cam.y });
export function setCam(x: number, y: number, z: number) { WB.cam = { x, y, z: clamp(z, 0.08, 4) }; emit('cam'); }
export function zoomAt(sx: number, sy: number, f: number) {
  const z = clamp(WB.cam.z * f, 0.08, 4), w = toWorld(sx, sy);
  setCam(sx - w.x * z, sy - w.y * z, z);
}
/** the free part of the window, between the bars */
export const view = () => ({ x: 20, y: 76, w: innerWidth - 40, h: innerHeight - 76 - 86 });
export const zoomMid = (f: number) => { const v = view(); zoomAt(v.x + v.w / 2, v.y + v.h / 2, f); };
export function fit(ids?: string[], maxZ = 1) {
  const list = (ids && ids.length ? ids : Object.keys(WB.objs)).map(id => WB.objs[id]).filter(Boolean);
  const v = view();
  if (!list.length) { setCam(v.x + v.w / 2, v.y + v.h / 2, 1); return; }
  const b = bounds(list);
  const z = clamp(Math.min(v.w / (b.w + 120), v.h / (b.h + 120)), 0.08, maxZ);
  setCam(v.x + v.w / 2 - (b.x + b.w / 2) * z, v.y + v.h / 2 - (b.y + b.h / 2) * z, z);
}
export const center = () => { const v = view(); return toWorld(v.x + v.w / 2, v.y + v.h / 2); };
/** move the camera (same zoom) so this world point sits in the middle of the view */
export function lookAt(x: number, y: number) { const v = view(); setCam(v.x + v.w / 2 - x * WB.cam.z, v.y + v.h / 2 - y * WB.cam.z, WB.cam.z); }

// ---------- geometry ----------
export interface Box { x: number; y: number; w: number; h: number }
export function box(o: Obj): Box {
  if (o.type === 'line') {
    const g = lineEnds(o);
    return { x: Math.min(g.p1.x, g.p2.x), y: Math.min(g.p1.y, g.p2.y), w: Math.abs(g.p2.x - g.p1.x) || 1, h: Math.abs(g.p2.y - g.p1.y) || 1 };
  }
  if (!o.r) return { x: o.x, y: o.y, w: o.w, h: o.h };
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, a = o.r * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = o.w * c + o.h * s, h = o.w * s + o.h * c;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
export function bounds(list: Obj[]): Box {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  list.forEach(o => { const b = box(o); x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); });
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export interface EndPt { x: number; y: number; nx: number; ny: number }
// where a connector touches an object: the edge point on the way to the other end
function edgePoint(o: Obj, toward: { x: number; y: number }): EndPt {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  let dx = toward.x - cx; const dy = toward.y - cy;
  if (!dx && !dy) dx = 1;
  if (o.type === 'shape' && o.kind === 'ellipse') { const k = 1 / Math.sqrt((dx * dx) / (o.w * o.w / 4) + (dy * dy) / (o.h * o.h / 4)); return { x: cx + dx * k, y: cy + dy * k, nx: dx, ny: dy }; }
  if (o.type === 'shape' && o.kind === 'diamond') { const k = 1 / (Math.abs(dx) / (o.w / 2) + Math.abs(dy) / (o.h / 2)); return { x: cx + dx * k, y: cy + dy * k, nx: dx, ny: dy }; }
  const k = Math.min(Math.abs((o.w / 2) / (dx || 1e-9)), Math.abs((o.h / 2) / (dy || 1e-9)));
  const x = cx + dx * k, y = cy + dy * k;
  const side = Math.abs(dx) * o.h > Math.abs(dy) * o.w ? { nx: Math.sign(dx), ny: 0 } : { nx: 0, ny: Math.sign(dy) };
  return { x, y, ...side };
}
const mid = (o: Obj) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 });
export function lineEnds(l: { a?: End; b?: End }) {
  const A = l.a?.id ? WB.objs[l.a.id] : undefined, B = l.b?.id ? WB.objs[l.b.id] : undefined;
  const ca = A ? mid(A) : { x: l.a!.x as number, y: l.a!.y as number }, cb = B ? mid(B) : { x: l.b!.x as number, y: l.b!.y as number };
  const p1: EndPt = A ? edgePoint(A, cb) : { ...ca, nx: cb.x - ca.x, ny: cb.y - ca.y };
  const p2: EndPt = B ? edgePoint(B, ca) : { ...cb, nx: ca.x - cb.x, ny: ca.y - cb.y };
  return { p1, p2 };
}

// ---------- meta (members, settings) ----------
export function setMeta(patch: Partial<Meta>, quiet?: boolean) {
  if (!WB.board) return;
  WB.board.meta = { ...WB.board.meta, ...patch };
  if (!quiet) send({ t: 'meta', meta: patch });
  save(); emit('meta');
}

// ---------- tools ----------
export function setTool(t: Tool) {
  if (!canEdit() && !['select', 'hand', 'comment'].includes(t)) { viewOnly(); t = 'select'; }
  WB.tool = t; emit('tool');
}

// ---------- live sync between tabs ----------
// messages: hello (just opened: send me the board) / state / ops (changes) / cur (cursor and selection) / meta / bye
interface Wire { t: string; b?: string; u?: { id: string; name: string; color: string }; [k: string]: unknown }
let chan: BroadcastChannel | null = null;
export function send(m: Wire) {
  if (chan) chan.postMessage({ ...m, b: WB.board?.id, u: { id: WB.me.id, name: WB.me.name, color: WB.me.color } });
}
let lastCur = { x: 0, y: 0 }, curT = 0;
export function presence(x?: number, y?: number) {
  if (x != null && y != null) lastCur = { x, y };
  const now = performance.now(); if (now - curT < 33 && x != null) return; curT = now;
  send({ t: 'cur', x: lastCur.x, y: lastCur.y, sel: [...WB.sel], role: role() });
}
function onMessage({ data: m }: MessageEvent<Wire>) {
  if (!m || !m.u || m.u.id === WB.me.id) return;
  if (m.t === 'index') { emit('index'); if (m.deleted && m.deleted === WB.board?.id) { const n = index()[0]; if (n) openBoard(n.id); } return; }
  if (!WB.board || m.b !== WB.board.id) return;
  const p = WB.peers[m.u.id] || (WB.peers[m.u.id] = { ...m.u, seen: 0 });
  p.seen = Date.now();
  if (m.t === 'hello') { send({ t: 'state', objs: WB.objs, meta: WB.board.meta }); presence(); emit('peers'); }
  else if (m.t === 'state') {
    let n = 0;
    Object.values((m.objs || {}) as Objs).forEach(o => { const mine = WB.objs[o.id]; if (!mine || (o.rev || 0) > (mine.rev || 0)) { WB.objs[o.id] = o; n++; } });
    const meta = m.meta as Meta | undefined;
    if (meta) { WB.board.meta = { ...WB.board.meta, vote: meta.vote, timer: meta.timer, members: meta.members }; emit('meta'); }
    if (n) emit('change', { remote: true });
  }
  else if (m.t === 'cur') { Object.assign(p, { x: m.x, y: m.y, sel: m.sel, role: m.role }); emit('peers'); }
  else if (m.t === 'bye') { delete WB.peers[m.u.id]; emit('peers'); }
  else if (m.t === 'ops') { applyChanges(m.ch as Record<string, Obj | null>); emit('change', { remote: true, live: m.live }); if (!m.live) emit('history'); }
  else if (m.t === 'meta') {
    if (m.name) { WB.board.name = m.name as string; emit('board'); }
    if (m.meta) { WB.board.meta = { ...WB.board.meta, ...(m.meta as Partial<Meta>) }; emit('meta'); }
  }
}

// ---------- first run: one empty board to start from ----------
function seed() {
  if (index().length) return;
  LS.set('tessera.wb.folders', ['Personal', 'Projects']);
  LS.set('tessera.wb.b.ideas', { id: 'ideas', name: 'Ideas', folder: 'Personal', objs: {}, meta: { members: [{ name: WB.me.name, role: 'owner' }], settings: { grid: true, bg: 'paper' } } });
  LS.set('tessera.wb.index', [{ id: 'ideas', name: 'Ideas', folder: 'Personal', updated: Date.now(), count: 0, owner: WB.me.name }]);
}

// ---------- the board's life on the page: start when Ideas opens, stop when it closes ----------
const bye = () => send({ t: 'bye' });
const onStorage = (e: StorageEvent) => { if (e.key === 'tessera.wb.index' || e.key === 'tessera.wb.folders') emit('index'); };
let beat = 0, runs = 0, running = false;
/** q: the page's query (?b=<board> opens that board, ?as= and ?role= join as someone else) */
export function start(q: URLSearchParams) {
  initMe(q);
  chan = 'BroadcastChannel' in window ? new BroadcastChannel('lo-wb') : null;
  if (chan) chan.onmessage = onMessage;
  beat = window.setInterval(() => {
    if (!WB.board) return;
    presence();
    let gone = false;
    Object.entries(WB.peers).forEach(([id, p]) => { if (Date.now() - p.seen > 7000) { delete WB.peers[id]; gone = true; } });
    if (gone) emit('peers');
  }, 2000);
  addEventListener('pagehide', bye);
  addEventListener('storage', onStorage);
  WB.board = null;
  const gen = ++runs; running = true;
  const open = () => {
    if (gen !== runs || !running) return;
    seed();
    const ix = index();
    if (!openBoard(q.get('b')) && !openBoard(lastOpen)) openBoard(ix.find(b => b.id === 'ideas')?.id || ix[0]?.id || createBoard('Untitled board', 'Personal').id);
    setTool('select');
  };
  // no boards in this browser yet: they may still be on their way back from this computer, so wait for that first
  if (index().length) open(); else mirrored.then(open);
}
export function stop() {
  running = false;
  if (depth) { depth = 1; commit('Edit'); }
  if (WB.status === 'saving') save(true);   // a change from the last moment is saved before the page goes
  bye();
  if (liveF) { cancelAnimationFrame(liveF); liveF = 0; liveQ = {}; }
  chan?.close(); chan = null;
  clearInterval(beat);
  removeEventListener('pagehide', bye);
  removeEventListener('storage', onStorage);
  WB.peers = {};
}
