// Tessera · the data every page reads, and the calendar helpers.
//
// Days are numbered from a fixed Monday, EPOCH: day 0 is Mon 16 Nov 2026, day 11 is Fri 27 Nov 2026, day −1 is the
// Sunday before. A number always means the same date, so saved ticks and notes stay on their day, and every week
// starts on a multiple of 7. T is today's number; tickClock() moves it on at midnight.
'use strict';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = MONTHS.map(m => m.slice(0, 3));

const EPOCH = new Date(2026, 10, 16);
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dateOf = D => addDays(EPOCH, D);
const dayIdx = d => Math.round((midnight(d) - EPOCH) / 864e5); // rounding absorbs the 23- and 25-hour days of clock changes
const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const keyOf = D => dkey(dateOf(D));
const weekStart = D => D - (((D % 7) + 7) % 7); // the Monday of D's week
const shortDate = D => { const d = dateOf(D); return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MON3[d.getMonth()]}`; };

// ---------- the clock: today, its day number, and the time now in hours (14.5 is 2:30 PM) ----------
// It reads this device's clock, which Windows keeps in step with internet time. Returns true when the day changed.
let TODAY, T, NOW_H;
function tickClock() {
  const now = new Date(), d = midnight(now), moved = !TODAY || +d !== +TODAY;
  TODAY = d; T = dayIdx(d); NOW_H = now.getHours() + now.getMinutes() / 60;
  return moved;
}
tickClock();
// day numbers of this month so far: the 1st up to today
const monthSoFar = () => Array.from({ length: TODAY.getDate() }, (_, i) => T - TODAY.getDate() + 1 + i);

function fmtHour(h) { const hh = ((h + 11) % 12) + 1; return `${hh} ${h < 12 || h === 24 ? 'AM' : 'PM'}`; }
function fmtTime(t) { const h = Math.floor(t), m = Math.round((t - h) * 60), hh = ((h + 11) % 12) + 1; return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; }

// ---------- Hours: what each hour of each day went on ----------
// categories: solid = the block colour, fg = the text on it. A starter set; Hours adds and deletes them (so `let`).
let CATS = [
  { id: 'sleep',  name: 'Sleep',          solid: '#1F7BFF', fg: '#fff' },
  { id: 'gym',    name: 'Gym',            solid: '#34C759', fg: '#fff' },
  { id: 'code',   name: 'Coding',         solid: '#7B61FF', fg: '#fff' },
  { id: 'study',  name: 'Study',          solid: '#FFC800', fg: '#1C1C1E' },
  { id: 'create', name: 'Creative',       solid: '#FF4F96', fg: '#fff' },
  { id: 'sport',  name: 'Sport',          solid: '#2FB2EA', fg: '#fff' },
  { id: 'life',   name: 'Meals & chores', solid: '#FF9500', fg: '#fff' },
  { id: 'waste',  name: 'Social media',   solid: '#FF3B4E', fg: '#fff' },
];
// 'YYYY-MM-DD' → 24 category ids (null = not logged), for every day you have logged
const HOURS = {};
const NO_HOURS = Object.freeze(Array(24).fill(null));
const hoursOn = D => HOURS[keyOf(D)] || NO_HOURS;                                    // to read
const hoursFor = D => HOURS[keyOf(D)] || (HOURS[keyOf(D)] = Array(24).fill(null));   // to change

// ---------- Calendar ----------
// four task categories (core/sort.js files new tasks under them)
const CALS = {
  code: { name: 'Work',   color: '#7B61FF' },
  fit:  { name: 'Health', color: '#34C759' },
  cre:  { name: 'Art',    color: '#FF4F96' },
  life: { name: 'Life',   color: '#FF9500' },
};
const PLATFORMS = {
  CF: { name: 'Codeforces', bg: '#1F5FBF', fg: '#fff' },
  CC: { name: 'CodeChef', bg: '#5B4636', fg: '#fff' },
  LC: { name: 'LeetCode', bg: '#FFA116', fg: '#1a1a1a' },
};
// timed events: { id, cal, day, s, e, title, rep, skip }. `rep` repeats it every week on that weekday;
// `skip` holds the day numbers of single days deleted from a repeating event.
const EVENTS = [];
// routines repeat with no time, so they show as dots: { id, cal, title, months: { 'YYYY-MM': [getDay() numbers] }, skip }.
// A month without an entry carries the last one over.
const ROUTINES = [];
// one-off tasks: { id, day, cal, title, s, time }, from Today, the widget or the Calendar
const ONEOFFS = [];

function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function monthLabel(k) { const [y, m] = k.split('-'); return MONTHS[+m - 1] + ' ' + y; }
function routineDaysForKey(r, k) { let cur = null; Object.keys(r.months).sort().forEach(x => { if (x <= k) cur = x; }); return cur ? r.months[cur] : []; }
function routineOn(r, d) { return routineDaysForKey(r, monthKey(d)).includes(d.getDay()) && !(r.skip || []).includes(dayIdx(d)); }
function eventsOn(D) {
  return EVENTS.filter(e => (e.rep ? ((D - e.day) % 7 + 7) % 7 === 0 && D >= e.day : e.day === D) && !(e.skip || []).includes(D)).sort((a, b) => a.s - b.s);
}
function daySummary(arr) { if (arr.length === 7) return 'Every day'; if (!arr.length) return 'Off'; return [1, 2, 3, 4, 5, 6, 0].filter(x => arr.includes(x)).map(x => DAY_NAMES[x]).join(', '); }

// ---------- Today: a day's tasks are its routines, one-offs and events ----------
// all three keyed "dayNumber|taskId": STATUS → todo | prog | done, PNOTES → where you stopped, STARS → starred (sits at the top)
const STATUS = {};
const PNOTES = {};
const STARS = {};
function statusOf(D, id) { return STATUS[D + '|' + id] || 'todo'; }
function tasksForDay(D) {
  const d = dateOf(D), out = [];
  ROUTINES.forEach(r => { if (routineOn(r, d)) out.push({ id: r.id, title: r.title, cal: r.cal, kind: 'routine' }); });
  ONEOFFS.filter(o => o.day === D).forEach(o => out.push({ ...o, kind: 'oneoff' }));
  eventsOn(D).forEach(e => out.push({ id: e.id, title: e.short || e.title, cal: e.cal, s: e.s, time: fmtTime(e.s), kind: 'event' }));
  return out;
}
// when a task starts, for sorting; tasks without a time come first
const startOf = t => t.s ?? -1;
