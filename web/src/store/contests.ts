// Tessera · upcoming contests from Codeforces, CodeChef and LeetCode. serve.py fetches them from the sites and keeps them
// for half an hour; the app asks again every half hour.
//
// Every round of up to six hours goes into your calendar by itself, as an ordinary event (category Work), so it shows up
// in Today, Next up, Home and the widget like anything else you planned, and finishing it logs its hours as Coding.
// Its id comes from the contest's address ("ct-CF-2292"), so it is added once. If the site moves it, the event follows,
// unless you changed its time yourself. Removing it from the calendar keeps it removed. Multi-day contests (practice
// weeks, online challenges) stay in the Contests tile and as chips on the calendar, not as tasks.
import { create } from 'zustand';
import { update } from './data';
import { dayIdx } from '../lib/dates';
import type { CalEvent } from '../lib/types';

export interface Contest { plat: string; title: string; start: number; end: number; url: string; id: string; D: number; s: number }
// null while loading; 'off' when there's no server to ask (a static host)
export const useContests = create<{ list: Contest[] | null | 'off' }>(() => ({ list: null }));

const LONGEST = 6 * 3.6e6; // longer than this is a practice week or a challenge, not a round you sit down for
export const contestId = (c: { plat: string; url: string }) => 'ct-' + c.plat + '-' + c.url.replace(/\/+$/, '').split('/').pop()!.replace(/[^\w-]/g, '');
const hourOf = (ms: number) => { const d = new Date(ms); return d.getHours() + d.getMinutes() / 60; };

/** puts the rounds into the calendar: new ones are added, moved ones follow the site, removed ones stay removed */
function addToCalendar(list: Contest[]) {
  update(d => {
    for (const c of list) {
      if (c.end - c.start > LONGEST) continue;
      const id = contestId(c), day = dayIdx(new Date(c.start)), s = hourOf(c.start), e = Math.min(24, s + (c.end - c.start) / 3.6e6);
      const ct = { plat: c.plat, url: c.url, start: c.start, end: c.end };
      const ev = d.events.find(x => x.id === id);
      if (!ev) { d.events.push({ id, cal: 'code', day, s, e, title: c.title, rep: '', ct } as CalEvent); continue; }
      if ((ev.skip || []).length || ev.ct?.start === c.start && ev.ct?.end === c.end) continue; // removed by you, or unchanged
      Object.assign(ev, { day, s, e, ct });                                                     // the site moved it
    }
  });
}

async function load() {
  try {
    const r = await fetch('api/contests', { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status));
    const list: Contest[] = ((await r.json()).contests as Omit<Contest, 'id' | 'D' | 's'>[]).map(c => ({ ...c, id: contestId(c), D: dayIdx(new Date(c.start)), s: hourOf(c.start) }));
    useContests.setState({ list });
    addToCalendar(list);
  } catch { useContests.setState({ list: 'off' }); }
}
let started = false;
/** start once the saved state has loaded (so the rounds land on top of it, not under it) */
export function startContests() { if (started) return; started = true; load(); setInterval(load, 30 * 60000); }
