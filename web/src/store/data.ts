// Tessera · the saved state, in one Zustand store. Every change goes through update(), which runs on an Immer
// draft, so the rules ported from the classic app (that change things in place) keep their exact meaning.
// store/persist.ts saves it; store/rules.ts holds the rules that tie the pages together.
import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { DEFAULT_CATS } from '../lib/data';
import type { Saved } from '../lib/types';

export const emptyState = (): Saved => ({
  status: {}, notes: {}, stars: {}, oneoffs: [], events: [], routines: [],
  cats: DEFAULT_CATS.map(c => ({ ...c })), hours: {}, auto: {},
  archive: { folders: [], projects: {}, months: {} }, sort: [],
});

export const useData = create<{ d: Saved }>(() => ({ d: emptyState() }));
export const data = () => useData.getState().d;

/** change the saved state: fn gets a draft to change in place, and what it returns is handed back */
export function update<R>(fn: (d: Draft<Saved>) => R): R {
  let out!: R;
  useData.setState(s => {
    const next = produce(s.d, dr => { out = fn(dr); });
    return next === s.d ? s : { d: next };
  });
  return out;
}

// ---------- what is saved: name → [check it fits, put it back], in the order it is written ----------
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
export const PART_NAMES = ['status', 'notes', 'stars', 'oneoffs', 'events', 'routines', 'cats', 'hours', 'auto', 'archive', 'sort'] as const;

/** a saved text's parts laid over the current state; a part that no longer fits is skipped */
export function merge(cur: Saved, saved: Record<string, unknown>): Saved {
  const next: Saved = { ...cur };
  const put: Record<string, (v: unknown) => void> = {
    status: v => { if (isObj(v)) next.status = v as Saved['status']; },
    notes: v => { if (isObj(v)) next.notes = v as Saved['notes']; },
    stars: v => { if (isObj(v)) next.stars = v as Saved['stars']; },
    oneoffs: v => { if (Array.isArray(v)) next.oneoffs = v; },
    events: v => { if (Array.isArray(v)) next.events = v; },
    routines: v => { if (Array.isArray(v)) next.routines = v; },
    cats: v => { if (Array.isArray(v) && v.length) next.cats = v; },
    hours: v => { if (isObj(v)) next.hours = v as Saved['hours']; },
    auto: v => { if (isObj(v)) next.auto = v as Saved['auto']; },
    archive: v => {
      if (isObj(v) && Array.isArray(v.folders)) next.archive = { folders: v.folders, projects: (v.projects as Saved['archive']['projects']) || {}, months: (v.months as Saved['archive']['months']) || {} };
    },
    sort: v => { if (Array.isArray(v)) next.sort = v; },
  };
  PART_NAMES.forEach(k => { if (k in saved) { try { put[k](saved[k]); } catch { /* skipped */ } } });
  return next;
}

/** the saved text without its time: the parts in their fixed order */
export const body = (d: Saved) => JSON.stringify(Object.fromEntries(PART_NAMES.map(k => [k, d[k]])));
