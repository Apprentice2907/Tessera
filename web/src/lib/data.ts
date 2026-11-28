// Tessera · the fixed tables every page reads, and the pure helpers over the saved state.
import { dateOf, dayIdx, fmtTime, keyOf, monthKey } from './dates';
import type { Archive, CalEvent, CalId, Cat, Folder, HourCells, Routine, Saved, Status, Task } from './types';

// ---------- Hours ----------
// a starter set; Hours adds and deletes them
export const DEFAULT_CATS: Cat[] = [
  { id: 'sleep', name: 'Sleep', solid: '#1F7BFF', fg: '#fff' },
  { id: 'gym', name: 'Gym', solid: '#34C759', fg: '#fff' },
  { id: 'code', name: 'Coding', solid: '#7B61FF', fg: '#fff' },
  { id: 'study', name: 'Study', solid: '#FFC800', fg: '#1C1C1E' },
  { id: 'create', name: 'Creative', solid: '#FF4F96', fg: '#fff' },
  { id: 'sport', name: 'Sport', solid: '#2FB2EA', fg: '#fff' },
  { id: 'life', name: 'Meals & chores', solid: '#FF9500', fg: '#fff' },
  { id: 'waste', name: 'Social media', solid: '#FF3B4E', fg: '#fff' },
];
// colours for the categories you add (the ones already in use are skipped)
export const CAT_PALETTE = [
  { name: 'Teal', solid: '#14B88F', fg: '#fff' },
  { name: 'Coral', solid: '#FF6A3D', fg: '#fff' },
  { name: 'Black', solid: '#1C1C1E', fg: '#fff' },
  { name: 'Indigo', solid: '#5856D6', fg: '#fff' },
  { name: 'Brown', solid: '#A2845E', fg: '#fff' },
  { name: 'Lime', solid: '#A4D52A', fg: '#1C1C1E' },
  { name: 'Grey', solid: '#8E8E93', fg: '#fff' },
];
export const NO_HOURS: HourCells = Object.freeze(Array(24).fill(null)) as HourCells;
export const hoursOn = (d: Saved, D: number): HourCells => d.hours[keyOf(D)] || NO_HOURS;
export const catOf = (d: Saved, id: string | null | undefined) => (id ? d.cats.find(c => c.id === id) : undefined);

// ---------- Calendar ----------
export const CALS: Record<CalId, { name: string; color: string }> = {
  code: { name: 'Work', color: '#7B61FF' },
  fit: { name: 'Health', color: '#34C759' },
  cre: { name: 'Art', color: '#FF4F96' },
  life: { name: 'Life', color: '#FF9500' },
};
export const calColor = (c: string) => (CALS[c as CalId] || CALS.code).color;
export const PLATFORMS: Record<string, { name: string; bg: string; fg: string }> = {
  CF: { name: 'Codeforces', bg: '#1F5FBF', fg: '#fff' },
  CC: { name: 'CodeChef', bg: '#5B4636', fg: '#fff' },
  LC: { name: 'LeetCode', bg: '#FFA116', fg: '#1a1a1a' },
};

export function routineDaysForKey(r: Routine, k: string) { let cur: string | null = null; Object.keys(r.months).sort().forEach(x => { if (x <= k) cur = x; }); return cur ? r.months[cur] : []; }
export function routineOn(r: Routine, d: Date) { return routineDaysForKey(r, monthKey(d)).includes(d.getDay()) && !(r.skip || []).includes(dayIdx(d)); }
export function eventsOn(d: Saved, D: number): CalEvent[] {
  return d.events.filter(e => (e.rep ? ((D - e.day) % 7 + 7) % 7 === 0 && D >= e.day : e.day === D) && !(e.skip || []).includes(D)).sort((a, b) => a.s - b.s);
}

// ---------- Today: a day's tasks are its routines, one-offs and events ----------
/** the link an event opens: the one you gave it, or a contest's page */
export const linkOf = (e: CalEvent) => e.url || e.ct?.url;
export const statusOf = (d: Saved, D: number, id: string): Status => d.status[D + '|' + id] || 'todo';
export function tasksForDay(d: Saved, D: number): Task[] {
  const day = dateOf(D), out: Task[] = [];
  d.routines.forEach(r => { if (routineOn(r, day)) out.push({ id: r.id, title: r.title, cal: r.cal, kind: 'routine', url: r.url }); });
  d.oneoffs.filter(o => o.day === D).forEach(o => out.push({ ...o, kind: 'oneoff' }));
  eventsOn(d, D).forEach(e => out.push({ id: e.id, title: e.short || e.title, cal: e.cal, s: e.s, time: fmtTime(e.s), kind: 'event', url: linkOf(e) }));
  return out;
}
// when a task starts, for sorting; tasks without a time come first
export const startOf = (t: { s?: number }) => t.s ?? -1;
export const doneOn = (d: Saved, D: number) => Object.keys(d.status).filter(k => k.startsWith(D + '|') && d.status[k] === 'done').length;
export const catHours = (d: Saved, cat: string | undefined, D: number) => hoursOn(d, D).filter(c => c === cat).length;
// days in a row up to today that pass the test (today counts once it does; until then the run ends yesterday)
export function streak(test: (D: number) => boolean, T: number) {
  let n = 0, D = test(T) ? T : T - 1;
  while (test(D) && n < 3660) { n++; D--; }
  return n;
}

// ---------- Review's archive ----------
// the grounds a folder can wear; `on` is its colour where a tick is cut out of it, `a` its four day-square shades
export const FOLDER_LOOKS: Record<string, { g: string; on: string; a: [string, string, string, string] }> = {
  green: { g: 'g-green', on: '#3E8A66', a: ['#CFF2D8', '#8EDFA3', '#34C759', '#1F8A3B'] },
  lilac: { g: 'g-lilac', on: '#C9B8FF', a: ['#E2DBFF', '#B9A9FF', '#7B61FF', '#5A3ECF'] },
  orange: { g: 'g-orange', on: '#FF6A2C', a: ['#FFE2D1', '#FFB58C', '#FF7438', '#D9481A'] },
  night: { g: 'g-night', on: '#151517', a: ['#2E2E33', '#1E5B37', '#2E8A50', '#7BE08F'] },
  kraft: { g: 'g-kraft', on: '#C8A37C', a: ['#E9D8C2', '#D9B98F', '#A97C4F', '#6E4B2A'] },
  sea: { g: 'g-sea', on: '#38BDF8', a: ['#D6F0FD', '#9ADCFB', '#38BDF8', '#3D3BD6'] },
};
export const lookOf = (f: Folder) => FOLDER_LOOKS[f.ground] || FOLDER_LOOKS.green;
export const folderById = (a: Archive, id: string) => a.folders.find(f => f.id === id);
export const projectsIn = (a: Archive, f: Folder) => Object.values(a.projects).filter(p => p.folder === f.id);
export const monthNoteOf = (a: Archive, fid: string, ym: string) => a.months[fid + '|' + ym] || { note: '', also: [] };
