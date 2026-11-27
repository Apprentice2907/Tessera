// Tessera · the sample data every page starts from, and the calendar helpers that read it.
// The mockup runs on a fixed "today": Monday 16 November 2026, 2:35 PM. core/store.js saves whatever you change.
'use strict';
const TODAY = new Date(2026, 10, 16);
const NOW_H = 14 + 35 / 60;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = MONTHS.map(m => m.slice(0, 3));

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtHour(h) { const hh = ((h + 11) % 12) + 1; return `${hh} ${h < 12 || h === 24 ? 'AM' : 'PM'}`; }
function fmtTime(t) { const h = Math.floor(t), m = Math.round((t - h) * 60), hh = ((h + 11) % 12) + 1; return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; }

// ---------- Hours: what each hour of the day went on ----------
// solid = the block colour, fg = the text on it. `let`: Hours adds and deletes categories.
let CATS = [
  { id: 'sleep',  name: 'Sleep',          solid: '#1F7BFF', fg: '#fff' },
  { id: 'gym',    name: 'Gym',            solid: '#34C759', fg: '#fff' },
  { id: 'code',   name: 'Coding',         solid: '#7B61FF', fg: '#fff' },
  { id: 'study',  name: 'Study',          solid: '#FFC800', fg: '#1C1C1E' },
  { id: 'create', name: 'Creative',       solid: '#FF4F96', fg: '#fff' },
  { id: 'sport',  name: 'Football',       solid: '#2FB2EA', fg: '#fff' },
  { id: 'life',   name: 'Meals & chores', solid: '#FF9500', fg: '#fff' },
  { id: 'waste',  name: 'Social media',   solid: '#FF3B4E', fg: '#fff' },
];

// 24 category ids for a typical day of the week; variant 1 loses an evening hour, variant 2 is a bad day
function dayPattern(dow, variant) {
  const c = Array(24).fill(null);
  const set = (a, b, id) => { for (let h = a; h < b; h++) c[h] = id; };
  set(0, 6, 'sleep'); set(23, 24, 'sleep');
  c[6] = 'life';
  c[7] = dow === 0 ? 'sleep' : 'gym';
  c[8] = 'life';
  set(9, 13, dow === 0 ? 'create' : 'code');
  c[13] = 'life';
  set(14, 17, 'study');
  set(17, 19, dow === 4 || dow === 5 ? 'sport' : 'code');
  if (dow === 6) set(11, 13, 'create');
  c[19] = 'life';
  set(20, 21, 'create');
  c[21] = 'study';
  c[22] = variant ? 'waste' : 'create';
  if (variant === 2) { set(14, 17, 'waste'); c[7] = 'sleep'; }
  return c;
}

// this month so far: today first (filled in up to 10 AM), then Nov 1 onwards
const HOUR_DAYS = (() => {
  const y = TODAY.getFullYear(), m = TODAY.getMonth(), t = TODAY.getDate();
  const today = Array(24).fill(null);
  for (let h = 0; h < 6; h++) today[h] = 'sleep';
  today[6] = 'life'; today[7] = 'gym'; today[8] = 'life'; today[9] = 'code';
  const out = [{ date: new Date(y, m, t), cells: today, kind: 'today' }];
  for (let d = 1; d < t; d++) {
    const date = new Date(y, m, d), variant = d === 9 ? 2 : d % 3 === 0 ? 1 : 0; // Mon 9 is the bad day
    out.push({ date, cells: dayPattern(date.getDay(), variant), kind: 'past' });
  }
  return out;
})();

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
// timed events. day: 0 = today (Mon 16). `rep` repeats it every week on that weekday; `skip` holds deleted single days.
const EVENTS = [];
(() => {
  const gym = ['Chest & Triceps', 'Back & Biceps', 'Legs', 'Shoulders & Abs', 'Arms', 'Full body'];
  for (let d = 0; d < 6; d++) EVENTS.push({ cal: 'fit', day: d, s: d === 5 ? 8 : 7, e: d === 5 ? 9 : 8, title: 'Gym — ' + gym[d], rep: 'Weekly · ' + DAY_NAMES[(d + 1) % 7] });
  for (let d = 0; d < 5; d++) EVENTS.push({ cal: 'code', day: d, s: 9, e: 12, title: 'DSA + deep study', rep: 'Mon – Fri' });
  for (let d = 0; d < 7; d++) EVENTS.push({ cal: 'life', day: d, s: 21.5, e: 22, title: 'Japanese', rep: 'Daily' });
  [0, 2].forEach(d => EVENTS.push({ cal: 'cre', day: d, s: 18, e: 18.5, title: '10-min video', rep: 'Mon · Wed' }));
  [3, 4].forEach(d => EVENTS.push({ cal: 'fit', day: d, s: 17, e: 19, title: 'Football', rep: 'Thu · Fri' }));
  EVENTS.push({ cal: 'cre', day: 5, s: 11, e: 13, title: 'Painting', rep: 'Weekly · Sat' });
  EVENTS.push({ cal: 'code', day: 1, s: 20 + 5 / 60, e: 22 + 5 / 60, title: 'Codeforces Round 1032 (Div. 2)', short: 'Codeforces contest', plat: 'CF', contest: true });
  EVENTS.push({ cal: 'code', day: 2, s: 20, e: 22, title: 'CodeChef Starters 212', short: 'CodeChef contest', plat: 'CC', contest: true });
  EVENTS.push({ cal: 'code', day: 5, s: 20, e: 21.5, title: 'LeetCode Biweekly 170', short: 'LeetCode contest', plat: 'LC', contest: true });
  EVENTS.push({ cal: 'code', day: 6, s: 8, e: 9.5, title: 'LeetCode Weekly 477', short: 'LeetCode contest', plat: 'LC', contest: true });
  EVENTS.forEach((e, i) => { e.id = 'e' + i; });
})();
// routines repeat with no time, so they show as dots. months: { 'YYYY-MM': [getDay() numbers] };
// a month without an entry carries the last one over
const EVERY = [0, 1, 2, 3, 4, 5, 6];
const ROUTINES = [
  { id: 'r1', cal: 'code', title: '2 DSA questions', months: { '2026-11': EVERY } },
  { id: 'r2', cal: 'code', title: '1 open source PR', months: { '2026-11': EVERY } },
  { id: 'r3', cal: 'fit', title: 'Morning drink', months: { '2026-11': EVERY } },
  { id: 'r4', cal: 'fit', title: 'Hair oil', months: { '2026-11': [2, 5], '2026-12': [0] } },
  { id: 'r5', cal: 'life', title: 'English: read aloud', months: { '2026-11': EVERY } },
];
// one-off tasks, from Today's "New task", the widget or the Calendar
const ONEOFFS = [{ id: 'o1', day: 0, cal: 'code', title: 'Apply to 3 internships' }];

function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function monthLabel(k) { const [y, m] = k.split('-'); return MONTHS[+m - 1] + ' ' + y; }
function routineDaysForKey(r, k) { let cur = null; Object.keys(r.months).sort().forEach(x => { if (x <= k) cur = x; }); return cur ? r.months[cur] : []; }
// day index: 0 = today, 1 = tomorrow, -1 = yesterday …
function dayIdx(d) { return Math.round((d - TODAY) / 864e5); }
function routineOn(r, d) { return routineDaysForKey(r, monthKey(d)).includes(d.getDay()) && !(r.skip || []).includes(dayIdx(d)); }
function eventsOn(D) {
  return EVENTS.filter(e => (e.rep ? ((D - e.day) % 7 + 7) % 7 === 0 : e.day === D) && !(e.skip || []).includes(D)).sort((a, b) => a.s - b.s);
}
function daySummary(arr) { if (arr.length === 7) return 'Every day'; if (!arr.length) return 'Off'; return [1, 2, 3, 4, 5, 6, 0].filter(x => arr.includes(x)).map(x => DAY_NAMES[x]).join(', '); }

// ---------- Today: a day's tasks are its routines, one-offs and events ----------
// all three keyed "dayIndex|taskId": STATUS → todo | prog | done, PNOTES → where you stopped, STARS → starred (sits at the top)
const STATUS = {};
const PNOTES = {};
const STARS = { '0|o1': true };
function statusOf(i, id) { return STATUS[i + '|' + id] || 'todo'; }
function tasksForDay(i) {
  const d = addDays(TODAY, i), out = [];
  ROUTINES.forEach(r => { if (routineOn(r, d)) out.push({ id: r.id, title: r.title, cal: r.cal, kind: 'routine' }); });
  ONEOFFS.filter(o => o.day === i).forEach(o => out.push({ ...o, kind: 'oneoff' }));
  eventsOn(i).forEach(e => out.push({ id: e.id, title: e.short || e.title, cal: e.cal, s: e.s, time: fmtTime(e.s), kind: 'event' }));
  return out;
}
// when a task starts, for sorting; tasks without a time come first
const startOf = t => t.s ?? -1;
(() => {
  const mon = t => EVENTS.find(e => e.day === 0 && e.title.startsWith(t)).id;
  STATUS['0|r3'] = 'done'; STATUS['0|r5'] = 'done'; STATUS['0|r1'] = 'prog';
  STATUS['0|' + mon('Gym')] = 'prog'; STATUS['0|' + mon('DSA')] = 'prog';
  PNOTES['0|r1'] = 'Solved 1 of 2. The graph one is left';
  PNOTES['0|' + mon('Gym')] = 'Bench + incline done, dips left';
})();

// ---------- placeholder photos, drawn as SVG ----------
function svgURI(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
// a football, drawn: five seams and the black patches, clipped to the ball
function drawnBall(cx, cy, r) {
  const at = (a, d) => [cx + Math.cos(a * Math.PI / 180) * d, cy + Math.sin(a * Math.PI / 180) * d];
  const pent = (x, y, d, rot) => 'M' + [0, 1, 2, 3, 4].map(i => { const a = (rot + i * 72) * Math.PI / 180; return `${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)}`; }).join('L') + 'Z';
  let seams = '', patches = '';
  for (let i = 0; i < 5; i++) {
    const a = -90 + i * 72, [x1, y1] = at(a, r * .36), [x2, y2] = at(a, r * .7), [ox, oy] = at(a + 36, r * 1.02);
    seams += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#2a2a2e" stroke-width="${(r * .07).toFixed(1)}" stroke-linecap="round"/>`;
    patches += `<path d="${pent(ox, oy, r * .34, a + 36 + 90)}" fill="#1d1d1f"/>`;
  }
  return `<defs><clipPath id="bc"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><radialGradient id="bs" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#eceae4"/><stop offset="1" stop-color="#b9b6ad"/></radialGradient></defs>`
    + `<ellipse cx="${cx + r * .12}" cy="${cy + r * 1.05}" rx="${r * .9}" ry="${r * .2}" fill="#000" opacity=".22"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#bs)"/><g clip-path="url(#bc)">${seams}${patches}</g>`
    + `<path d="${pent(cx, cy, r * .36, -90)}" fill="#1d1d1f"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2a2a2e" stroke-width="${(r * .05).toFixed(1)}"/>`;
}
const ART = {
  gym: () => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f4a"/><stop offset="1" stop-color="#15171c"/></linearGradient><radialGradient id="l" cx=".5" cy=".1" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="300" height="300" fill="url(#g)"/><rect width="300" height="300" fill="url(#l)"/><rect x="30" y="196" width="240" height="10" rx="5" fill="#c9ccd3"/><rect x="40" y="150" width="26" height="102" rx="6" fill="#e8492f"/><rect x="70" y="160" width="18" height="82" rx="5" fill="#2f6fe8"/><rect x="234" y="150" width="26" height="102" rx="6" fill="#e8492f"/><rect x="212" y="160" width="18" height="82" rx="5" fill="#2f6fe8"/><rect x="0" y="252" width="300" height="48" fill="#0d0e11"/><text x="150" y="110" font-family="Arial Black,Arial" font-weight="900" font-size="46" fill="#fff" text-anchor="middle" opacity=".92">120 KG</text></svg>`),
  football: () => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#3f9a4b"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${i * 50}" width="25" height="300" fill="#4aa957"/>`).join('')}<circle cx="150" cy="150" r="70" fill="none" stroke="#e9f5ea" stroke-width="5"/><rect x="147" y="0" width="6" height="300" fill="#e9f5ea"/>${drawnBall(150, 150, 36)}</svg>`),
  paint: () => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb07c"/><stop offset=".55" stop-color="#ff6f7d"/><stop offset="1" stop-color="#7a4b9a"/></linearGradient></defs><rect width="300" height="300" fill="url(#s)"/><circle cx="150" cy="170" r="52" fill="#ffe39a"/><path d="M0 210 Q70 170 140 205 T300 195 V300 H0Z" fill="#43305e"/><path d="M0 245 Q90 215 170 245 T300 240 V300 H0Z" fill="#2a1f3d"/></svg>`),
  paint2: () => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#f3ead8"/><path d="M20 230 C80 120 140 260 280 90" stroke="#2d6cdf" stroke-width="26" fill="none" stroke-linecap="round" opacity=".85"/><path d="M30 80 C110 40 160 140 270 60" stroke="#f0961f" stroke-width="22" fill="none" stroke-linecap="round" opacity=".85"/><circle cx="210" cy="200" r="38" fill="#e8492f" opacity=".85"/><rect x="0" y="0" width="300" height="300" fill="none" stroke="#d8ccb2" stroke-width="16"/></svg>`),
  japanese: () => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#f6efe2"/>${Array.from({ length: 6 }, (_, i) => `<line x1="0" x2="300" y1="${50 + i * 45}" y2="${50 + i * 45}" stroke="#e3d6bf"/>`).join('')}<text x="150" y="190" font-family="Yu Mincho,MS Mincho,serif" font-size="150" text-anchor="middle" fill="#2b2b2b">あ</text><circle cx="248" cy="58" r="22" fill="#d6372b"/></svg>`),
  code: () => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#0f1420"/><rect width="300" height="34" fill="#1a2132"/><circle cx="20" cy="17" r="6" fill="#ff5f57"/><circle cx="40" cy="17" r="6" fill="#febc2e"/><circle cx="60" cy="17" r="6" fill="#28c840"/><g font-family="Consolas,monospace" font-size="15"><text x="18" y="70" fill="#7ee787">✓ PR #1182 merged</text><rect x="14" y="88" width="230" height="18" fill="#12301f"/><text x="18" y="102" fill="#7ee787">+ fix: docs typo in setup</text><rect x="14" y="110" width="200" height="18" fill="#3b1519"/><text x="18" y="124" fill="#ff7b72">- old install step</text><text x="18" y="160" fill="#8b949e">1 file changed</text><text x="18" y="200" fill="#d2a8ff">first ever OSS PR</text></g></svg>`),
  contest: () => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#e9f0fb"/><path d="M20 230 L70 215 L110 222 L150 190 L190 196 L230 150 L280 118" stroke="#1F5FBF" stroke-width="5" fill="none"/>${[[20, 230], [70, 215], [110, 222], [150, 190], [190, 196], [230, 150], [280, 118]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#fff" stroke="#1F5FBF" stroke-width="3"/>`).join('')}<text x="24" y="70" font-family="Arial Black,Arial" font-weight="900" font-size="48" fill="#22A55B">+67</text><text x="26" y="100" font-family="Arial" font-weight="700" font-size="17" fill="#1F5FBF">Pupil unlocked</text></svg>`),
  chai: () => svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 228"><rect width="300" height="228" fill="#F3E3C8"/><rect y="166" width="300" height="62" fill="#C99A6B"/><ellipse cx="150" cy="168" rx="66" ry="8" fill="#000" opacity=".16"/><path d="M106 96h88l-12 72h-64z" fill="#B5582F"/><path d="M106 96h88l-2 11h-84z" fill="#8E3F1F"/><ellipse cx="150" cy="96" rx="44" ry="9" fill="#D97A45"/><ellipse cx="150" cy="97" rx="36" ry="6" fill="#7A4A22"/><path d="M130 80q-8-12 0-24t0-24M150 76q-8-12 0-24t0-24M170 80q-8-12 0-24t0-24" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".75"/><text x="150" y="207" font-family="Arial" font-weight="700" font-size="18" fill="#3B2412" text-anchor="middle">Chai Bistro</text></svg>'),
  body: w => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w > 1 ? '#3a3a3f' : '#6c6a68'}"/><stop offset="1" stop-color="${w > 1 ? '#121214' : '#2c2b2a'}"/></linearGradient></defs><rect width="300" height="360" fill="url(#g)"/><circle cx="150" cy="96" r="34" fill="#d8d3cc"/><path d="M${150 - 62 * w} 360 C${150 - 70 * w} 230 ${150 - 58 * w} 160 ${150 - 40 * w} 146 L150 140 L${150 + 40 * w} 146 C${150 + 58 * w} 160 ${150 + 70 * w} 230 ${150 + 62 * w} 360Z" fill="#d8d3cc"/><text x="150" y="340" font-family="Arial" font-size="13" text-anchor="middle" fill="#9a958e" letter-spacing="3">DROP YOUR PHOTO</text></svg>`),
};
