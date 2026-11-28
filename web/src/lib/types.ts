// Tessera · the shape of what is saved. Every name and field here matches the classic app's saved state
// (the "tessera.state" key), so old data and backups load as they are.

/** the four task categories: Work, Health, Art, Life */
export type CalId = 'code' | 'fit' | 'cre' | 'life';
export type Status = 'todo' | 'prog' | 'done';

/** an Hours category: solid is the block colour, fg the text on it */
export interface Cat { id: string; name: string; solid: string; fg: string; custom?: boolean }

/** a timed event. `rep` ("Weekly · Mon, Wed") repeats it every week on its weekday; `skip` holds deleted single days.
 *  Events, routines and one-offs can carry `url`: a link the task opens (a meeting, a page), shown beside its star. */
export interface CalEvent { id: string; cal: CalId; day: number; s: number; e: number; title: string; short?: string; rep?: string; skip?: number[]; ct?: ContestRef; url?: string }
/** a contest the app put in the calendar by itself: where it's from, its page, and when the site said it runs (ms) */
export interface ContestRef { plat: string; url: string; start: number; end: number }
/** repeats with no time, so it shows as a dot. months: 'YYYY-MM' → getDay() numbers; a month without one carries the last over */
export interface Routine { id: string; cal: CalId; title: string; months: Record<string, number[]>; skip?: number[]; url?: string }
/** a one-off task, from Today, the widget or the Calendar */
export interface OneOff { id: string; day: number; cal: CalId; title: string; s?: number; time?: string; url?: string }

/** hours filled in from a finished task ('YYYY-MM-DD|hour' → this); a stamp from Review is { id: 'stamp', cat, prev } */
export interface AutoHour { id: string; cat: string; prev?: string | null }

export interface Folder { id: string; name: string; ground: string; kind: 'month' | 'projects'; cat?: string; created: string }
export interface Project {
  id: string; folder: string; name: string; created: string; status: 'ACTIVE' | 'PAUSED' | string;
  tagline: string; about: string; note: string;
  plan: [number | boolean, string][];
  entries: [string, string][];
}
export interface MonthNote { note: string; also: [string, string][] }
export interface Archive { folders: Folder[]; projects: Record<string, Project>; months: Record<string, MonthNote> }

export type HourCells = (string | null)[];

/** the saved state, part by part, in the order it is written */
export interface Saved {
  status: Record<string, Status>;   // "day|taskId" → todo | prog | done
  notes: Record<string, string>;    // "day|taskId" → where you stopped
  stars: Record<string, boolean>;   // "day|taskId" → starred
  oneoffs: OneOff[];
  events: CalEvent[];
  routines: Routine[];
  cats: Cat[];
  hours: Record<string, HourCells>; // 'YYYY-MM-DD' → 24 category ids
  auto: Record<string, AutoHour>;
  archive: Archive;
  sort: [string, CalId][];          // what you taught the sorter: [title, category], newest last
}

/** a task on a day: a routine, a one-off or an event */
export interface Task { id: string; title: string; cal: CalId; kind: 'routine' | 'oneoff' | 'event'; s?: number; time?: string; day?: number; url?: string }
