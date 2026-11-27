// Tessera · the on-device task sorter. No network, no API: it runs in the page.
// Four categories, kept as calendar ids (CALS in lib/data.ts):
//   code = Work · fit = Health · cre = Art · life = Life
//
// How it decides, adding up points for each category:
//   1. Words it knows: strong words 2, loose verbs like "buy" or "call" 1, phrases 4.
//      Each word of the title counts once per category, so "painting" is not counted twice.
//   2. Your calendar as examples: a word shared with "Gym — Legs" adds 1 to Health.
//   3. What you taught it: every time you change a tag it remembers the title (saved with everything else).
//      A shared word adds 3, the same title adds 10.
//   Nothing matched: Life, with sure: false.
// It also reads a time out of the title: "Gym at 7am", "call mom 6:30 pm", "standup 18:30".
import { CALS } from './data';
import type { CalId, Saved } from './types';

export const SORT_ORDER: CalId[] = ['code', 'fit', 'cre', 'life']; // also the order that wins a tie
export const SORT_NAMES = Object.fromEntries(SORT_ORDER.map(c => [c, CALS[c].name])) as Record<CalId, string>;
const SORT_WORDS: Record<CalId, { strong: string[]; loose: string[]; phrases: string[] }> = {
  code: {
    strong: ['kaggle', 'leetcode', 'codeforces', 'codechef', 'hackerrank', 'dsa', 'algorithm', 'contest', 'intern', 'internship', 'job',
      'resume', 'cv', 'interview', 'oa', 'referral', 'linkedin', 'portfolio', 'recruiter', 'placement', 'hackathon', 'gsoc', 'github',
      'pr', 'commit', 'deploy', 'bug', 'feature', 'code', 'coding', 'project', 'api', 'database', 'frontend', 'backend', 'ml', 'dataset',
      'notebook', 'paper', 'research', 'study', 'exam', 'assignment', 'lecture', 'course', 'kamilabs', 'harness', 'client', 'meeting',
      'standup', 'deadline', 'slides', 'presentation', 'report', 'email', 'office', 'work', 'team', 'sprint', 'review', 'invoice'],
    loose: ['apply', 'fix', 'build', 'ship', 'submit', 'send', 'prepare', 'finish', 'plan', 'solve'],
    phrases: ['open source', 'pull request', 'system design', 'cover letter', 'mock interview', 'side project'],
  },
  fit: {
    strong: ['gym', 'workout', 'exercise', 'run', 'running', 'jog', 'walk', 'cardio', 'yoga', 'stretch', 'pushup', 'pullup', 'deadlift',
      'squat', 'bench', 'legs', 'chest', 'biceps', 'triceps', 'shoulders', 'abs', 'protein', 'creatine', 'whey', 'diet', 'calories',
      'sugar', 'water', 'sleep', 'nap', 'doctor', 'dentist', 'medicine', 'meds', 'vitamin', 'weigh', 'weight', 'football', 'cricket',
      'badminton', 'tennis', 'swim', 'swimming', 'cycling', 'steps', 'physio', 'checkup', 'hair', 'skin', 'skincare', 'oil', 'haircut',
      'barber', 'meditate', 'meditation', 'health', 'turf'],
    loose: ['drink', 'eat', 'rest'],
    phrases: ['morning drink', 'leg day', 'hair oil', 'push-ups'],
  },
  cre: {
    strong: ['paint', 'painting', 'draw', 'drawing', 'sketch', 'art', 'guitar', 'piano', 'music', 'song', 'sing', 'video', 'youtube',
      'vlog', 'reel', 'instagram', 'photo', 'photography', 'film', 'blog', 'poem', 'poetry', 'design', 'figma', 'canvas', 'watercolor',
      'illustration', 'animation', 'dance', 'craft', 'pottery', 'thumbnail', 'script', 'story'],
    loose: ['write', 'writing', 'edit', 'editing', 'post', 'record', 'shoot', 'compose', 'make'],
    phrases: ['short film'],
  },
  life: {
    strong: ['groceries', 'grocery', 'laundry', 'clean', 'cleaning', 'tidy', 'room', 'cook', 'cooking', 'dinner', 'lunch', 'breakfast',
      'mom', 'dad', 'mum', 'family', 'friend', 'birthday', 'gift', 'party', 'bank', 'bill', 'rent', 'recharge', 'passport', 'visa',
      'trip', 'travel', 'ticket', 'flight', 'movie', 'plants', 'car', 'bike', 'parcel', 'japanese', 'kanji', 'hiragana',
      'katakana', 'english', 'language', 'journal', 'diary', 'home', 'house', 'shopping', 'dishes', 'garden', 'novel'],
    loose: ['buy', 'call', 'pay', 'text', 'visit', 'pick', 'order', 'renew', 'learn', 'practice', 'book', 'read', 'wash', 'feed', 'dog', 'cat'],
    phrases: ['read aloud', 'pick up', 'water plants'],
  },
};
const SORT_STOP = new Set(['a', 'an', 'the', 'to', 'for', 'of', 'and', 'or', 'in', 'on', 'at', 'my', 'do', 'get', 'go', 'with', 'from',
  'by', 'up', 'new', 'task', 'min', 'mins', 'hr', 'hrs', 'today', 'tomorrow', 'some', 'it', 'is']);

const sortTokens = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(w => w && !SORT_STOP.has(w));
// a word matches its plural and -ing/-ed forms; words of 6+ letters also match longer words ("intern" → "internship")
const sortHit = (w: string, kw: string) => w === kw || w === kw + 's' || w === kw + 'es' || w === kw + 'ing' || w === kw + 'ed' || (kw.length >= 6 && w.startsWith(kw));

/** remember that this title belongs to that category (changes the draft's sort list in place) */
export function sortTeach(learned: [string, CalId][], title: string, cal: CalId) {
  const t = title.trim().toLowerCase(); if (!t) return;
  const i = learned.findIndex(([x]) => x === t); if (i >= 0) learned.splice(i, 1);
  learned.push([t, cal]);
  if (learned.length > 300) learned.splice(0, learned.length - 300);
}

const sortExamples = (d: Saved): [string, CalId][] => [
  ...d.routines.map(r => [r.title, r.cal] as [string, CalId]),
  ...d.events.map(e => [e.short || e.title, e.cal] as [string, CalId]),
  ...d.oneoffs.map(o => [o.title, o.cal] as [string, CalId]),
];

/** → { cal, name, sure, why }: the category, how sure it is, and the strongest reason */
export function sortTask(d: Saved, title: string): { cal: CalId; name: string; sure: boolean; why: string } {
  const text = ' ' + title.toLowerCase().replace(/\s+/g, ' ') + ' ';
  let tok = sortTokens(title);
  const score: Record<CalId, number> = { code: 0, fit: 0, cre: 0, life: 0 };
  const why: Record<CalId, [number, string][]> = { code: [], fit: [], cre: [], life: [] };
  // 1. phrases first; their words then stop counting on their own ("hair oil" is one hit, not two)
  for (const cal of SORT_ORDER) for (const p of SORT_WORDS[cal].phrases) {
    if (!text.includes(' ' + p + ' ') && !text.includes(' ' + p + 's ')) continue;
    score[cal] += 4; why[cal].push([4, `“${p}”`]);
    const parts = p.split(/[\s-]+/); tok = tok.filter(w => !parts.includes(w));
  }
  // 1b. single words: each word once per category, at its best weight
  for (const w of tok) for (const cal of SORT_ORDER) {
    const pts = SORT_WORDS[cal].strong.some(k => sortHit(w, k)) ? 2 : SORT_WORDS[cal].loose.some(k => sortHit(w, k)) ? 1 : 0;
    if (pts) { score[cal] += pts; why[cal].push([pts, `“${w}”`]); }
  }
  // 2. your calendar as examples, 3. what you taught it
  const all = sortTokens(title).filter(w => w.length >= 3);
  for (const [exTitle, cal] of sortExamples(d)) {
    if (!(cal in score) || exTitle.toLowerCase() === title.trim().toLowerCase()) continue;
    const shared = sortTokens(exTitle).filter(w => w.length >= 3 && all.includes(w)).length;
    if (shared) { score[cal] += shared; why[cal].push([shared, `like “${exTitle}”`]); }
  }
  const norm = title.trim().toLowerCase();
  for (const [t, cal] of d.sort) {
    if (!(cal in score)) continue;
    const pts = t === norm ? 10 : 3 * sortTokens(t).filter(w => w.length >= 3 && all.includes(w)).length;
    if (pts) { score[cal] += pts; why[cal].push([pts, `you filed “${t}” as ${SORT_NAMES[cal]}`]); }
  }
  const total = SORT_ORDER.reduce((n, c) => n + score[c], 0);
  const best = [...SORT_ORDER].sort((a, b) => score[b] - score[a])[0]; // ties keep Work, Health, Art, Life order
  return total === 0
    ? { cal: 'life', name: SORT_NAMES.life, sure: false, why: 'nothing it knows yet' }
    : { cal: best, name: SORT_NAMES[best], sure: score[best] >= 2 && score[best] / total >= 0.6, why: why[best].sort((a, b) => b[0] - a[0])[0][1] };
}

/** "Gym at 7am" → { s: 7, title: 'Gym' }. No time in the text → null. */
export function sortTime(text: string): { s: number; title: string } | null {
  let m: RegExpMatchArray | null, h: number, min = 0;
  if ((m = text.match(/\s*(?:\bat\s+|@\s*)?\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i)) && +m[1] >= 1 && +m[1] <= 12) {
    h = (+m[1] % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0); min = +(m[2] || 0);
  } else if ((m = text.match(/\s*(?:\bat\s+|@\s*)?\b([01]?\d|2[0-3]):([0-5]\d)\b/))) {
    h = +m[1]; min = +m[2];
  } else if ((m = text.match(/\s*(?:\bat\s+|@\s*)(\d{1,2})\b(?!\s*(?:min|mins|minutes|hr|hrs|hours|km|k|x|reps|pages|questions)\b)/i)) && +m[1] <= 23) {
    h = +m[1]; if (h >= 1 && h <= 7) h += 12; // "at 6" means 6 in the evening
  } else return null;
  const title = text.replace(m[0], ' ').replace(/\s{2,}/g, ' ').trim();
  return { s: h + min / 60, title: title || text.trim() };
}
