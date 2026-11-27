// Tessera · saving. The state is kept in this browser under "tessera.state" and, under serve.py, on this computer too,
// where it is backed up every day. The format is the classic app's: the parts in a fixed order, then "at" (when it was
// saved), so when two windows disagree the newer one wins, and old data and backups load as they are.
//   The app and the desktop widget share it: a task ticked in one is ticked in the other.
//   The walls and the ideas boards keep their own keys (tessera.walls, tessera.wb.*); the server keeps a copy of those too.
import { useData, body, merge } from './data';
import { toast } from './ui';
import { dkey } from '../lib/dates';

export const KEY = 'tessera.state';
const MIRRORED = /^tessera\.(walls|wb\.(index|folders|b\.))/;
const local = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};
const atOf = (text: string | null) => { try { return (text && JSON.parse(text)?.at) || 0; } catch { return 0; } };

// `last` is what was saved, so a change that changes nothing (or one that came from another window) writes nothing
let ready = false, timer = 0, last: string | null = null, savedAt = 0, remote = false;

export function save() {
  if (!ready) return;
  clearTimeout(timer);
  const b = body(useData.getState().d); if (b === last) return;
  last = b; savedAt = Date.now();
  const text = b.slice(0, -1) + `,"at":${savedAt}}`;
  if (!local.set(KEY, text)) toast('This browser would not save. Your changes are kept on this computer only while the server runs');
  push(KEY, text);
}
export const soon = () => { clearTimeout(timer); timer = window.setTimeout(save, 250); };
function apply(text: string) {
  let saved: Record<string, unknown> | null = null;
  try { saved = JSON.parse(text); } catch { saved = null; }
  if (saved && typeof saved === 'object') useData.setState(s => ({ d: merge(s.d, saved!) }));
  last = body(useData.getState().d);
}

// ---------- the copy on this computer (serve.py); on a plain static host there's no server, and this does nothing ----------
// serve.py only ever listens on this computer, so a copy opened from anywhere else (the one on Vercel) doesn't ask it
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const post =(key: string, value: string | null) => fetch('api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }), keepalive: !value || value.length < 60000 });
function push(key: string, value: string | null) { if (remote) post(key, value).catch(() => {}); }
async function getJSON<T>(url: string): Promise<T> { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
// another window saved something newer: take it
async function pull() {
  if (!LOCAL) return;
  let theirs: string | null;
  try { theirs = (await getJSON<{ value: string | null }>('api/state?key=' + KEY)).value; } catch { return; }
  remote = true;
  const mine = local.get(KEY);
  if (!theirs) { if (mine) push(KEY, mine); return; }          // the server has nothing yet: give it ours
  const a = atOf(theirs), b = atOf(mine);
  if (a > b) { apply(theirs); local.set(KEY, theirs); } else if (b > a && mine) push(KEY, mine);
}
// the walls and boards: whatever this browser lost (cleared data, a new browser) comes back from the server,
// and whatever the server doesn't have yet goes to it. Returns how many keys came back.
async function syncMirrored() {
  let keys: Record<string, string | null>;
  try { keys = (await getJSON<{ keys: Record<string, string | null> }>('api/state?prefix=tessera.')).keys; } catch { return 0; }
  let back = 0;
  Object.entries(keys).forEach(([k, v]) => { if (k !== KEY && MIRRORED.test(k) && v != null && local.get(k) == null && local.set(k, v)) back++; });
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && MIRRORED.test(k) && !(k in keys)) post(k, local.get(k)).catch(() => {}); }
  return back;
}
// a page that keeps its own keys in this browser (the Wall, the Ideas boards) calls this after saving one;
// null removes the key from the server's copy too (a deleted board)
const mirrorTimers: Record<string, number> = {};
export function mirror(key: string, value: string | null) {
  if (!MIRRORED.test(key)) return;
  clearTimeout(mirrorTimers[key]);
  mirrorTimers[key] = window.setTimeout(() => push(key, value), 600);
}

// the walls and boards are in step with the server's copy, or there is no server to ask. A page that would start a
// fresh one (the Ideas board seeds its first board) waits for this, so a browser that lost its data gets the old ones
// back instead of covering them with a new, empty one
let mirroredDone = () => {};
export const mirrored = new Promise<void>(r => { mirroredDone = r; });

/** load what this browser has, then keep saving and keep in step with other windows; resolves once the server has been asked */
export function restore(): Promise<void> {
  const mine = local.get(KEY);
  if (mine) apply(mine); else last = body(useData.getState().d);
  addEventListener('storage', e => { if (e.key === KEY && e.newValue) apply(e.newValue); });
  // anything you change is saved a moment later, and once more when the page goes away
  useData.subscribe((s, prev) => { if (s.d !== prev.d) soon(); });
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); else pull(); });
  // nothing is saved until the server has been asked once: this browser's copy may be older than what the desktop
  // widget saved, and a save now would stamp it newer and send it over the top
  const first = Promise.race([pull(), new Promise(r => setTimeout(r, 4000))]);
  first.then(() => { ready = true; soon(); });
  // other windows' changes: check the server now and every few seconds while this window is showing
  first.then(async () => {
    if (!remote) { mirroredDone(); return; }
    const back = await syncMirrored();
    // walls or boards came back from the server: load once more so the pages read them (once per visit, never in a loop)
    if (back && !sessionStorage.getItem('tessera.restored')) { sessionStorage.setItem('tessera.restored', '1'); location.reload(); return; }
    mirroredDone();
  });
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 2500);
  return first.then(() => {});
}

// ---------- backups: a file you keep, and the daily copies on this computer ----------
async function everything() {
  const keys: Record<string, string | null> = {};
  if (remote) { try { Object.assign(keys, (await getJSON<{ keys: Record<string, string | null> }>('api/state?prefix=tessera.')).keys); } catch { /* this browser's copy will do */ } }
  save();
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k === KEY || MIRRORED.test(k))) keys[k] = local.get(k); }
  return keys;
}
export async function download() {
  const file = { app: 'tessera', version: 1, made: new Date().toISOString(), keys: await everything() };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  a.download = `tessera-backup-${dkey(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
/** puts a downloaded copy back: everything it holds replaces what's here (the server keeps a copy of what was here first) */
export async function restoreFile(file: File) {
  let data: { app?: string; keys?: Record<string, unknown> } | null;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('That file isn’t a Tessera backup'); }
  if (data?.app !== 'tessera' || !data.keys || typeof data.keys !== 'object') throw new Error('That file isn’t a Tessera backup');
  const keys = Object.entries(data.keys).filter((e): e is [string, string] => (e[0] === KEY || MIRRORED.test(e[0])) && typeof e[1] === 'string');
  if (!keys.some(([k]) => k === KEY)) throw new Error('That backup has no saved state in it');
  ready = false; clearTimeout(timer);
  if (remote) await fetch('api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'before-restore' }) }).catch(() => {});
  const stamped = ([k, v]: [string, string]): [string, string] => [k, k === KEY ? v.replace(/"at":\d+}$/, `"at":${Date.now()}}`) : v]; // newest, so every window takes it
  for (const [k, v] of keys.map(stamped)) { local.set(k, v); if (remote) await post(k, v).catch(() => {}); }
  sessionStorage.removeItem('tessera.restored');
  location.reload();
}
export interface BackupList { backups: { name: string; keys: number; bytes: number }[]; keep: number; folder: string }
export async function backups() { return remote ? getJSON<BackupList>('api/backups') : null; }
export async function backupNow() {
  save();
  const r = await fetch('api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  return (await r.json()).name as string;
}
export const info = () => ({ remote, savedAt });
