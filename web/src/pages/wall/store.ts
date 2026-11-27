// Tessera · Memory wall: the walls and what hangs on them. One wire-grid wall per event (a trip, a festival, a season,
// a collection); a place on a wall opens its own wall. Saved in this browser under "tessera.walls" exactly as the
// classic page wrote it ({ cur, mode, walls: [{ id, name, theme, parent, items }] }), and a copy goes to this computer.
// Also here: the wall's measures and how things snap onto a wire, since adding and dragging both need them.
import { useMemo } from 'react';
import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { mirror } from '../../store/persist';
import { toast } from '../../store/ui';
import { ART } from './art';
import { KIT, type KitItem } from './kit';

export const PW = 1690, PH = 850;                  // the wall is drawn at this size, then scaled to fit
export const G = 70, O = 5;                        // a wire every 70px; the frame runs 5px in from the edge
export const KEY = 'tessera.walls';
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------- kinds of wall ----------
export type ThemeId = 'trip' | 'festival' | 'sport' | 'hobby' | 'everyday';
export interface Theme { name: string; g: string; clip: 'peg' | 'binder'; grid: 'black' | 'gold' | 'white'; art: string }
export const THEMES: Record<ThemeId, Theme> = {
  // g: the bento ground its tile gets in the wall switcher
  trip:     { name: 'Trip', g: 'g-kraft', clip: 'peg', grid: 'black', art: 'desert' },
  festival: { name: 'Festival', g: 'g-orange', clip: 'peg', grid: 'gold', art: 'garba' },
  sport:    { name: 'Sport', g: 'g-green', clip: 'binder', grid: 'white', art: 'turf' },
  hobby:    { name: 'Hobby', g: 'g-night', clip: 'binder', grid: 'black', art: 'carwall' },
  everyday: { name: 'Everyday', g: 'g-paper', clip: 'binder', grid: 'black', art: 'train' },
};
const own = <T,>(o: Record<string, T>, k: string | null | undefined): T | undefined => (k != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
/** a wall's theme (an unknown one reads as Everyday, so odd saved data can't break the page) */
export const th = (id: string | undefined) => own(THEMES, id) || THEMES.everyday;
// which objects the Add gallery shows first on each kind of wall
export const FIRST: Record<ThemeId, string[]> = { trip: ['Travel', 'Rajasthan', 'Food'], festival: ['Festival', 'Food'], sport: ['Sport'], hobby: ['Toys'], everyday: ['Desk', 'Plants'] };

// ---------- the saved shapes ----------
export type Kind = 'photo' | 'postcard' | 'note' | 'place' | 'prop';
export interface Item {
  id: string; kind: Kind; x: number; y: number; r: number; z: number;
  src?: string;      // your own photo (a JPEG data: URL); without one, `art` names a drawn picture
  art?: string;
  title?: string; date?: string; text?: string;
  place?: string;    // a postcard's "Greetings from"
  wall?: string;     // a place: the wall it opens
  prop?: string;     // an object: its KIT key
  clip?: string;     // 'peg' | 'binder', else the theme's
}
export interface WallRec { id: string; name: string; theme: ThemeId; parent: string | null; items: Item[] }
export interface WallData { cur: string; mode: 'evening' | 'day'; walls: WallRec[] }

/** an object you can hang, by its key (only real KIT entries) */
export const kit = (k: string | undefined): KitItem | undefined => own(KIT, k);
const drawn: Record<string, string> = {};
/** an object's drawing; the same every time, so it is drawn once */
export const drawOf = (k: string) => (drawn[k] ??= KIT[k].draw());

// ---------- sizes, and hanging things on the wires ----------
export const dims = (it: Item): { w: number; h: number } => it.kind === 'prop' ? (kit(it.prop) || { w: 120, h: 120 }) : it.kind === 'postcard' ? { w: 278, h: 186 } : it.kind === 'note' ? { w: 170, h: 150 } : { w: 210, h: 250 };
// how far below an item's top edge its wire runs: clips grip just under the top, tags hang from a string above, objects from their hook
const hang = (it: Item) => it.kind === 'prop' ? (kit(it.prop)?.hy ?? 12) : it.kind === 'note' ? -32 : 6;
export function snapY(it: Item, y: number) {
  const a = hang(it), h = dims(it).h;
  const last = Math.max(0, Math.min(Math.floor((PH - O - 10) / G), Math.floor((PH + 30 - h + a - O) / G)));
  return O + clamp(Math.round((y + a - O) / G), 0, last) * G - a;
}

// ---------- loading ----------
// the first visit: one empty wall to start from
const seed = (): WallData => ({ cur: 'first', mode: 'evening', walls: [{ id: 'first', name: 'My wall', theme: 'everyday', parent: null, items: [] }] });
function load(): WallData {
  let D: WallData | null;
  try { D = JSON.parse(localStorage.getItem(KEY) as string); } catch { D = null; }
  if (!D || !Array.isArray(D.walls) || !D.walls.length) D = seed();
  // the wall it was on went missing: show the first one (saved with the next change, as the classic page did)
  if (!D.walls.some(w => w.id === D!.cur)) D.cur = D.walls[0].id;
  return D;
}

// ---------- the store; every change is saved 300 ms later ----------
export const useWalls = create<{ D: WallData }>(() => ({ D: load() }));
export const data = () => useWalls.getState().D;
export function edit(fn: (d: Draft<WallData>) => void) { useWalls.setState(s => ({ D: produce(s.D, fn) })); }

let saveT = 0, pending = false;
// saved in this browser, and a copy goes to this computer (store/persist.ts), so a cleared browser gets its walls back
function write() {
  pending = false;
  const text = JSON.stringify(data());
  try { localStorage.setItem(KEY, text); } catch { toast('This browser is full, so the wall is only saved on this computer. Remove a big photo.'); }
  mirror(KEY, text);
}
function save() { clearTimeout(saveT); pending = true; saveT = window.setTimeout(write, 300); }
useWalls.subscribe((s, p) => { if (s.D !== p.D) save(); });
// a change made just before the window closes still lands in this browser
addEventListener('pagehide', () => { if (pending) { clearTimeout(saveT); write(); } });

// ---------- reading the walls ----------
export const wallOf = (D: WallData, id?: string | null) => D.walls.find(w => w.id === (id || D.cur));
export const curWall = (D: WallData) => wallOf(D) || D.walls[0];
const byId = (D: WallData, id: string | null | undefined) => (id ? D.walls.find(w => w.id === id) : undefined);
/** the top wall a wall sits under */
export function root(D: WallData, w: WallRec) {
  const seen = new Set<string>();
  while (w.parent && !seen.has(w.id)) { seen.add(w.id); const p = byId(D, w.parent); if (!p) break; w = p; }
  return w;
}
/** the walls from the top one down to this one */
export function trail(D: WallData, w: WallRec) {
  const out: WallRec[] = [], seen = new Set<string>();
  for (let x: WallRec | undefined = w; x && !seen.has(x.id); x = byId(D, x.parent)) { seen.add(x.id); out.unshift(x); }
  return out;
}
/** memories on a wall, counting what's on the places on it (objects don't count) */
export function count(D: WallData, w: { id?: string; items: Item[] }, seen = new Set<string>()): number {
  if (w.id) seen.add(w.id);
  return w.items.reduce((n, it) => n + (it.kind === 'place' ? (it.wall && !seen.has(it.wall) ? count(D, byId(D, it.wall) || { items: [] }, seen) : 0) : it.kind === 'prop' ? 0 : 1), 0);
}
/** the wall a place opens */
export const childOf = (D: WallData, it: Item) => byId(D, it.wall);

const pics0: Record<string, string> = {};
/** a drawn picture as a data: URI (an unknown one is the Everyday picture); drawn once */
export const artSrc = (k?: string) => { const key = own(ART, k) ? k! : THEMES.everyday.art; return (pics0[key] ??= ART[key]()); };
export const src = (it: { src?: string; art?: string }) => it.src || artSrc(it.art);
const isPic = (it: Item) => it.kind === 'photo' || it.kind === 'postcard';
/** up to n of a wall's own pictures: the first one from each place on it, then its own photos and postcards */
export function pics(D: WallData, w: WallRec, n = 3) {
  const out = w.items.filter(it => it.kind === 'place').map(it => (byId(D, it.wall)?.items || []).find(isPic)).filter((x): x is Item => !!x);
  return [...out, ...w.items.filter(isPic)].slice(0, n).map(src);
}
// the newest photos and postcards across every wall, newest first; ids carry the time they were made
const madeAt = (it: Item) => parseInt(String(it.id).slice(1, 9), 36) || 0;
export const recent = (D: WallData, n: number) => D.walls.flatMap(w => w.items.filter(isPic)).sort((a, b) => madeAt(b) - madeAt(a)).slice(0, n)
  .map(it => ({ src: src(it), title: it.title || it.place || '', date: it.date || '' }));

/** what Home shows of the walls */
export function useWallSummary(): { memories: number; walls: number; recent: { src: string; title: string; date: string }[] } {
  const D = useWalls(s => s.D);
  return useMemo(() => ({
    memories: D.walls.reduce((n, w) => n + w.items.filter(it => it.kind !== 'prop' && it.kind !== 'place').length, 0),
    walls: D.walls.filter(w => !w.parent).length,
    recent: recent(D, 2),
  }), [D]);
}

// ---------- placing new things ----------
export const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const lean = () => Math.round(Math.random() * 8 - 4);
export const today = () => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const nextZ = (w: WallRec) => Math.max(0, ...w.items.map(x => x.z || 0)) + 1;
// a free spot: the place that overlaps the fewest things, near the middle; then clipped onto the nearest wire
function freeSpot(w: WallRec, iw: number, ih: number) {
  let best = { x: Math.round(PW / 2 - iw / 2), y: 300, s: Infinity };
  for (let y = 30; y <= PH - ih * .8; y += 35) for (let x = 20; x <= PW - iw - 20; x += 40) {
    let s = 0;
    w.items.forEach(o => { const { w: ow, h: oh } = dims(o); const ix = Math.max(0, Math.min(x + iw, o.x + ow) - Math.max(x, o.x)), iy = Math.max(0, Math.min(y + ih, o.y + oh) - Math.max(y, o.y)); s += ix * iy; });
    s += Math.hypot(x + iw / 2 - PW / 2, y + ih / 2 - PH / 2) * .5;
    if (s < best.s) best = { x, y, s };
  }
  return { x: best.x, y: best.y };
}
type New = Omit<Item, 'x' | 'y'> & Partial<Pick<Item, 'x' | 'y'>>;
const spot = (w: WallRec, it: New): Item => { const { w: iw, h: ih } = dims(it as Item), p = freeSpot(w, iw, ih); it.x = p.x; it.y = snapY(it as Item, p.y); return it as Item; };

// ---------- changes ----------
const itemIn = (d: Draft<WallData>, wid: string, id: string) => d.walls.find(w => w.id === wid)?.items.find(x => x.id === id);
/** shows another wall */
export function go(id: string) { if (!id || !byId(data(), id)) return false; edit(d => { d.cur = id; }); return true; }
export const toggleLights = () => edit(d => { d.mode = d.mode === 'evening' ? 'day' : 'evening'; });
/** puts something new on a wall, in a free spot on a wire; `make` gets the wall (for its theme, name and next z) */
export function addItem(wid: string, make: (w: WallRec) => New): string | null {
  let id: string | null = null;
  edit(d => { const w = d.walls.find(x => x.id === wid); if (!w) return; const it = spot(w, make(w)); w.items.push(it); id = it.id; });
  return id;
}
/** a place: a new wall under this one, and its stack of prints on this one */
export function addPlace(wid: string, name: string) {
  edit(d => {
    const w = d.walls.find(x => x.id === wid); if (!w) return;
    const id = uid('w'); d.walls.push({ id, name, theme: w.theme, parent: w.id, items: [] });
    w.items.push(spot(w, { id: uid('g'), kind: 'place', r: lean(), z: nextZ(w), wall: id }));
  });
}
export function moveItem(wid: string, id: string, x: number, y: number, z: number) {
  edit(d => { const it = itemIn(d, wid, id); if (!it) return; it.z = z; it.x = x; it.y = y; });
}
/** what the viewer's fields say, all of them at once, as the classic page saved them */
export function setFields(wid: string, id: string, vals: [string, string][]) {
  edit(d => { const it = itemIn(d, wid, id) as Record<string, unknown> | undefined; if (it) vals.forEach(([k, v]) => { it[k] = v; }); });
}
/** your own photo on a print or postcard, or back to its drawing (null) */
export function setPhoto(wid: string, id: string, s: string | null) {
  edit(d => { const it = itemIn(d, wid, id); if (!it) return; if (s == null) delete it.src; else it.src = s; });
}
export function removeItem(wid: string, id: string) {
  edit(d => { const w = d.walls.find(x => x.id === wid); if (w) w.items = w.items.filter(x => x.id !== id); });
}
export function newWall(name: string, theme: ThemeId) {
  edit(d => { const id = uid('w'); d.walls.push({ id, name, theme, parent: null, items: [] }); d.cur = id; });
}
export function renameWall(id: string, name: string) { edit(d => { const w = d.walls.find(x => x.id === id); if (w) w.name = name; }); }
/** a top wall and every wall under it */
export function deleteWall(id: string) {
  edit(d => {
    const gone = new Set([id]); let grew = true;
    while (grew) { grew = false; d.walls.forEach(x => { if (x.parent && gone.has(x.parent) && !gone.has(x.id)) { gone.add(x.id); grew = true; } }); }
    d.walls = d.walls.filter(x => !gone.has(x.id));
    if (gone.has(d.cur)) d.cur = (d.walls.find(x => !x.parent) || d.walls[0]).id;
  });
}
