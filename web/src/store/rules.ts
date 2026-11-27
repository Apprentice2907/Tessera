// Tessera · the rules that tie the pages together.
//   Calendar → Today: Today lists what the calendar has for the day (tasksForDay in lib/data.ts).
//   Today → Hours: finishing a task that has a time fills its hours in, in the matching category.
//   Hours → Review: a monthly folder counts its category's hours, day by day.
// They run on Immer drafts (store/data.ts update()), the same way the classic app changed its globals in place.
import type { Draft } from 'immer';
import { useData, update } from './data';
import { clock } from './clock';
import { fmtHour, keyOf } from '../lib/dates';
import { folderById, statusOf, tasksForDay } from '../lib/data';
import type { Folder, HourCells, Project, Saved, Task } from '../lib/types';

type D = Draft<Saved>;
const hoursFor = (d: D, D: number): HourCells => d.hours[keyOf(D)] || (d.hours[keyOf(D)] = Array(24).fill(null));

// ---------- Today → Hours ----------
/** which Hours category a finished task's time belongs to */
export function hoursCat(d: Saved, t: { title?: string; cal?: string }) {
  const s = (t.title || '').toLowerCase();
  const id = /football|cricket|turf|match|badminton|tennis|swim/.test(s) ? 'sport'
    : /japanese|english|kana|read|study|course|lecture|exam/.test(s) ? 'study'
    : t.cal === 'fit' ? 'gym' : t.cal === 'code' ? 'code' : t.cal === 'cre' ? 'create' : t.cal === 'life' ? 'life' : null;
  return id && d.cats.some(c => c.id === id) ? id : null;
}
/** a task's hours: an event has a start and an end; a one-off with a time takes an hour */
function span(d: Saved, t: Task): [number, number] | null {
  const e = d.events.find(x => x.id === t.id), s = e ? e.s : t.s;
  if (s == null) return null;
  const a = Math.floor(s), b = Math.max(a + 1, Math.ceil(e ? e.e : s + 1));
  return [a, Math.min(24, b)];
}
/** fills in the hours of the day's finished tasks; returns what it filled in, e.g. ["7–8 AM as Gym"], so Today can say so */
export function syncHours(d: D, D: number) {
  const k = keyOf(D), tasks = tasksForDay(d as Saved, D), said: string[] = [];
  let cells = d.hours[k];
  Object.keys(d.auto).forEach(key => {
    const [dk, h] = key.split('|'); if (dk !== k) return;
    const a = d.auto[key];
    if (a.id === 'stamp') return; // a stamp from Review stays until it's taken off there
    if (statusOf(d as Saved, D, a.id) === 'done' && tasks.some(t => t.id === a.id)) return;
    if (cells && cells[+h] === a.cat) cells[+h] = null;
    delete d.auto[key];
  });
  tasks.forEach(t => {
    if (statusOf(d as Saved, D, t.id) !== 'done') return;
    const sp = span(d as Saved, t), cat = hoursCat(d as Saved, t); if (!sp || !cat) return;
    cells = hoursFor(d, D);
    const got: number[] = [];
    for (let h = sp[0]; h < sp[1]; h++) {
      const key = k + '|' + h;
      if (d.auto[key] || cells[h]) continue; // already filled, by this or by you: yours wins
      cells[h] = cat; d.auto[key] = { id: t.id, cat }; got.push(h);
    }
    if (got.length) said.push(`${fmtHour(got[0])}${got.length > 1 ? '–' + fmtHour(got[got.length - 1] + 1) : ''} as ${d.cats.find(c => c.id === cat)!.name}`);
  });
  return said;
}
/** painting an hour by hand makes it yours */
export function paintHour(d: D, D: number, h: number, brush: string) {
  const cells = hoursFor(d, D); cells[h] = cells[h] === brush ? null : brush;
  delete d.auto[keyOf(D) + '|' + h];
}

// the classic app re-ran this on every redraw: here it runs whenever the tasks, their status or the day change
export function keepHoursInStep() {
  const run = () => update(d => { syncHours(d, clock().T); });
  useData.subscribe((s, p) => {
    if (s.d.status !== p.d.status || s.d.events !== p.d.events || s.d.oneoffs !== p.d.oneoffs || s.d.routines !== p.d.routines || s.d.cats !== p.d.cats) queueMicrotask(run);
  });
  run();
  return run;
}

// ---------- Hours → Review ----------
// stamping a day in Review puts an hour of the folder's category on it (the first free hour from 7 AM, remembering what was
// there); taking the stamp off clears that day's hours of the category and puts the stamped hour back as it was
export function toggleCatDay(d: D, cat: string, D: number) {
  const cells = hoursFor(d, D), k = keyOf(D);
  if (cells.includes(cat)) {
    Object.keys(d.auto).forEach(key => { const [dk, h] = key.split('|'); if (dk === k && d.auto[key].id === 'stamp' && d.auto[key].cat === cat) { cells[+h] = d.auto[key].prev ?? null; delete d.auto[key]; } });
    cells.forEach((c, h) => { if (c === cat) cells[h] = null; });
    return false;
  }
  let h = [...Array(24).keys()].map(i => (i + 7) % 24).find(i => !cells[i]);
  if (h == null) h = 7;
  d.auto[k + '|' + h] = { id: 'stamp', cat, prev: cells[h] };
  cells[h] = cat;
  return true;
}

// ---------- a project update, from anywhere: "Portfolio: fixed the nav", "Work · Website: shipped" ----------
const allProjects = (d: Saved) => Object.values(d.archive.projects).map(p => ({ ...p, folderName: folderById(d.archive, p.folder)?.name || '' }));
function parseUpdate(raw: string) {
  const m = /^(.+?)\s*(?::|->|→|—|–(?=\s))\s*(.+)$/.exec(raw.trim());
  if (!m) return null;
  const parts = m[1].split(/\s*(?:·|\/|>|\s-\s|\|)\s*/).map(s => s.trim()).filter(Boolean);
  const folder = parts.length > 1 ? parts.shift()! : null, name = parts.join(' ').replace(/\s+project$/i, '').trim(), text = m[2].trim();
  return name && text ? { folder, name, text } : null;
}
function findProject(d: Saved, name: string, folder: string | null) {
  const n = name.toLowerCase(), list = allProjects(d).filter(p => !folder || p.folderName.toLowerCase() === folder.toLowerCase());
  return list.find(p => p.name.toLowerCase() === n) || list.find(p => p.name.toLowerCase().startsWith(n)) || list.find(p => n.startsWith(p.name.toLowerCase()));
}
/** a new project, in a projects folder (one called "Projects" is made if there's none yet) */
export function newProject(d: D, name: string, f?: Folder | null): Project {
  const T = clock().T;
  if (!f) {
    f = d.archive.folders.find(x => x.kind === 'projects');
    if (!f) { f = { id: 'f' + Date.now().toString(36), name: 'Projects', ground: 'night', kind: 'projects', created: keyOf(T) }; d.archive.folders.push(f); }
  }
  const p: Project = { id: 'p' + Date.now().toString(36), folder: f.id, name, created: keyOf(T), status: 'ACTIVE', tagline: 'Just started.', about: '', note: '', plan: [], entries: [] };
  d.archive.projects[p.id] = p;
  return p;
}
/** files the update under today in that project's file; a project it hasn't seen yet gets its own file first */
export function logUpdate(d: D, raw: string): { ok: false; msg: string } | { ok: true; made: boolean; name: string; folder: string; id: string } {
  const u = parseUpdate(raw);
  if (!u) return { ok: false, msg: 'Write it as Project: what happened' };
  let p: { id: string; name: string; folder: string } | undefined = findProject(d as Saved, u.name, u.folder), made = false;
  if (!p) {
    const f = u.folder ? d.archive.folders.find(x => x.kind === 'projects' && x.name.toLowerCase() === u.folder!.toLowerCase()) : null;
    p = newProject(d, u.name.replace(/\b\w/g, c => c.toUpperCase()), f); made = true;
  }
  d.archive.projects[p.id].entries.push([keyOf(clock().T), u.text]);
  return { ok: true, made, name: p.name, folder: folderById(d.archive, p.folder)!.name, id: p.id };
}
export const recentProjects = (d: Saved, n = 4) => allProjects(d)
  .map(p => ({ ...p, last: p.entries.reduce((m, e) => (e[0] > m ? e[0] : m), p.created) }))
  .sort((a, b) => (a.last < b.last ? 1 : -1)).slice(0, n);
