// Tessera · links on tasks: a meeting, a contest page, anything a task opens. A task with a link gets a button beside its
// star that opens it. A link can be typed straight into a task ("Standup meet.google.com/abc-defg at 10am"): it comes out
// of the title and onto the task.
import { sortTime } from './sort';

const NAMES: [RegExp, string][] = [
  [/(^|\.)meet\.google\.com$/, 'Google Meet'], [/(^|\.)zoom\.us$/, 'Zoom'], [/(^|\.)teams\.(microsoft|live)\.com$/, 'Teams'],
  [/(^|\.)webex\.com$/, 'Webex'], [/(^|\.)discord\.(gg|com)$/, 'Discord'], [/(^|\.)codeforces\.com$/, 'Codeforces'],
  [/(^|\.)leetcode\.com$/, 'LeetCode'], [/(^|\.)codechef\.com$/, 'CodeChef'], [/(^|\.)github\.com$/, 'GitHub'],
];

/** a typed or pasted link, made safe to open: http and https only, and "meet.google.com/x" gets its https:// */
export function cleanUrl(raw: string): string | null {
  let v = raw.trim().replace(/[),.;:!?'"]+$/, '');
  if (!v) return null;
  if (!/^[a-z][\w+.-]*:/i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null;
  } catch { return null; }
}

/** where a link goes, in a word or two: "Google Meet", "Zoom", or the site's own name */
export function linkName(url: string) {
  try { const h = new URL(url).hostname.replace(/^www\./, ''); return NAMES.find(([re]) => re.test(h))?.[1] || h; } catch { return 'the link'; }
}

// a link inside typed text: anything starting http(s):// or www., or a meeting address without them
const IN_TEXT = /(?:https?:\/\/|www\.)\S+|\b(?:meet\.google\.com|(?:[\w-]+\.)?zoom\.us|teams\.(?:microsoft|live)\.com|discord\.gg)\/\S*/i;

/** "Standup meet.google.com/abc at 10am" → { text: "Standup at 10am", url: "https://meet.google.com/abc" } */
export function splitLink(text: string): { text: string; url: string | null } {
  const m = IN_TEXT.exec(text);
  const url = m && cleanUrl(m[0]);
  if (!m || !url) return { text, url: null };
  return { text: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim(), url };
}

/** a new task as typed: its title, its time if it has one ("at 6pm"), and its link if it has one.
 *  Only a link and a time ("meet.google.com/abc at 10am") is named after where the link goes. */
export function readTask(raw: string): { title: string; s?: number; url?: string } {
  const { text, url } = splitLink(raw.trim()), tm = sortTime(text);
  let title = tm ? tm.title : text;
  if (tm && title === text.trim()) title = '';            // nothing but a time was left
  if (!title) title = url ? linkName(url) : raw.trim();
  return { title, ...(tm ? { s: tm.s } : {}), ...(url ? { url } : {}) };
}
