// Tessera · the archive's data: folders, monthly files, project books and their notes.
// Review (pages/review/review.js) builds every page from this; core/store.js saves the parts you can change.
'use strict';
const FOLDERS = [
  { id: 'gym', name: 'Gym', since: 'Sep 2026', files: ['gym-nov', 'gym-oct', 'gym-sep'] },
  { id: 'code', name: 'Coding & Job', since: 'Aug 2026', files: ['code-nov', 'code-oct'] },
  { id: 'cre', name: 'Creative', since: 'Oct 2026', files: ['cre-nov', 'cre-oct'] },
  { id: 'proj', short: 'Projects', name: 'Personal projects', since: '2025', files: ['p-lyra', 'p-vincula', 'p-jobbot', 'p-montra', 'p-liveos'] },
  { id: 'kami', name: 'KamiLabs', since: 'Nov 2026', files: ['k-all', 'k-web', 'k-torii', 'k-chai', 'k-neo'] },
];
// project / company logs → each project is a book: About, Plan, then one page per week
const BOOK_WEEKS = [new Date(2026, 9, 26), new Date(2026, 10, 2), new Date(2026, 10, 9), new Date(2026, 10, 16)];
const BOOKS = {
  lyra: { name: 'Lyra', group: 'Personal', status: 'ACTIVE', started: 'Sep 2026', path: 'Personal Projects / Lyra',
    tagline: 'A vinyl-style music player for the web.',
    about: 'Comes with <b>Encore</b>, a next-song recommender that runs in the browser and learns from every song you play. A mood reader asks Claude what mood the session is in.',
    stack: ['Web', 'JavaScript', 'Claude API'],
    plan: [[1, 'Player and vinyl UI', 'Oct'], [1, 'Encore recommender', 'Oct'], [0, 'Playlists that sync', 'Dec'], [0, 'Share a listening session', 'Jan']],
    hours: [5, 4, 7, 3], entries: [[9, 28, 'Encore: first next-song recommendations'], [10, 4, 'Vinyl spin animation, scratch to seek'], [10, 10, 'Mood reader asks Claude for the session mood'], [10, 13, 'Fixed audio cutting out on track change'], [10, 16, 'Queue: drag and drop to reorder']] },
  vincula: { name: 'Vincula', group: 'Personal', status: 'ACTIVE', started: 'Oct 2026', path: 'Personal Projects / Vincula',
    tagline: 'A campus social app for Parul University.',
    about: 'Friends in private circles see each other on a <b>pixel-art campus map</b>: which building someone is in, never GPS coordinates.',
    stack: ['Mobile app', 'Expo'],
    plan: [[1, 'Pixel-art campus map', 'Nov'], [1, 'Private circles', 'Nov'], [0, 'Pilot with 20 students', 'Dec'], [0, 'Play Store build', 'Jan']],
    hours: [0, 6, 5, 0], entries: [[10, 3, 'Campus map: first 6 buildings'], [10, 6, 'Private circles: invite by code'], [10, 12, 'Fixed a friend showing in the wrong building']] },
  jobbot: { name: 'Job Bot', group: 'Personal', status: 'ACTIVE', started: 'Oct 2026', path: 'Personal Projects / Job Bot',
    tagline: 'One bot, five modules, one inbox.',
    about: 'Finds opportunities, filters them, prepares documents, applies and tracks everything. It only asks me when it truly needs me.',
    stack: ['Python'],
    plan: [[1, 'Plan: 5 modules', 'Oct'], [1, 'Finder module', 'Nov'], [0, 'Auto-apply module', 'Dec'], [0, 'Tracker inbox', 'Dec']],
    hours: [3, 4, 5, 2], entries: [[9, 30, 'Wrote the plan: 5 modules, one inbox'], [10, 7, 'Finder scrapes 3 job boards'], [10, 14, 'Filter drops roles that need 3+ years'], [10, 16, 'Fixed duplicate applications bug']] },
  montra: { name: 'Montra', group: 'Personal', status: 'PAUSED', started: 'Oct 2026', path: 'Personal Projects / Montra',
    tagline: 'Say it, and it’s saved.',
    about: 'A <b>voice-first expense tracker</b> for Android. “Add 10 rupees rickshaw” becomes ₹10 · Transport · today. My first Android app.',
    stack: ['Android'],
    plan: [[1, 'Voice to expense', 'Oct'], [1, 'Date words (“yesterday”)', 'Nov'], [0, 'Monthly charts', 'Dec'], [0, 'Play Store release', 'Jan']],
    hours: [2, 4, 2, 0], entries: [[10, 2, 'Voice input parses amount and category'], [10, 8, 'Understands “yesterday” and “last Friday”'], [10, 11, 'Fixed amounts over ₹1,000 parsing wrong']] },
  liveos: { name: 'Tessera', group: 'Personal', status: 'ACTIVE', started: 'Nov 2026', path: 'Personal Projects / Tessera',
    tagline: 'My whole life in one app.',
    about: 'Today, Hours, Calendar, Ideas, a memory Wall and Review files in one desktop app, with phone sync later.',
    stack: ['Tauri', 'React'],
    plan: [[1, 'Idea and references', 'Nov 15'], [1, 'Clickable mockup', 'Nov 16'], [0, 'Lock the UI', 'Nov'], [0, 'Build the real app', 'Dec']],
    hours: [0, 0, 0, 7], entries: [[10, 15, 'Idea and competitor teardown'], [10, 16, 'Clickable mockup of all 6 views'], [10, 16, 'Today: minimal board that reads from Calendar']] },
  web: { name: 'Web harness', group: 'KamiLabs', status: 'ACTIVE', started: 'Nov 2026', path: 'KamiLabs / Purusharth Harness',
    tagline: 'How KamiLabs builds websites with Claude Code.',
    about: 'Sight, an art-direction conversation, a critic with no stake, hard gates, and a starter with no look.',
    stack: ['Claude Code'],
    plan: [[1, 'Brief and scout stages', 'Nov'], [1, 'Critic and gates', 'Nov'], [0, 'Use it on 3 client sites', 'Dec']],
    hours: [0, 12, 10, 3], entries: [[10, 3, 'Design critic with a scoring rubric'], [10, 5, 'Tokens and variants step'], [10, 10, 'Device lab: Chrome, Safari, Firefox'], [10, 12, 'Pixel diff against the last run'], [10, 16, 'iOS 100vh check']] },
  torii: { name: 'Torii', group: 'KamiLabs', status: 'ACTIVE', started: 'Nov 2026', path: 'KamiLabs / Torii Harness',
    tagline: 'Turns a business into a site that sells.',
    about: 'Interviews the owner, researches the market, then locks every fact in one truth file before anything is designed.',
    stack: ['Claude Code'],
    plan: [[1, 'Owner interview', 'Nov'], [1, 'Truth file', 'Nov'], [0, 'First client run', 'Dec']],
    hours: [0, 8, 9, 2], entries: [[10, 4, 'Owner interview script'], [10, 9, 'Truth file: every fact in one place'], [10, 13, 'Market research step']] },
  chai: { name: 'Chai Bistro', group: 'KamiLabs', status: 'ACTIVE', started: 'Nov 2026', path: 'KamiLabs / chaibistro',
    tagline: 'A restaurant site built on the web harness.',
    about: 'Client website: menu, story and location. Built stage by stage with the harness.',
    stack: ['Web harness'],
    plan: [[1, 'Art direction', 'Nov'], [1, 'Menu page', 'Nov'], [0, 'Launch', 'Nov 28']],
    hours: [0, 6, 7, 2], entries: [[10, 6, 'Art direction locked'], [10, 11, 'Menu page with photos'], [10, 14, 'Fixed mobile nav overlapping the logo']] },
  neo: { name: 'Neo Urja portal', group: 'KamiLabs', status: 'ACTIVE', started: 'Nov 2026', path: 'KamiLabs / Job Portal Neo Urja',
    tagline: 'A career portal for Neo Urja.',
    about: 'Job listings, applications and a recruiter view, built from the build spec and briefs.',
    stack: ['Web'],
    plan: [[1, 'Demo database', 'Nov'], [1, 'Round 2 fixes', 'Nov'], [0, 'Apply flow', 'Nov'], [0, 'Hand over', 'Dec']],
    hours: [0, 6, 4, 1], entries: [[10, 2, 'Onboarding, read the build spec'], [10, 5, 'Demo DB and job listing API'], [10, 12, 'Round 2 fixes from review'], [10, 16, 'Apply flow: resume upload']] },
  kami: { name: 'KamiLabs', group: 'Company', status: 'INTERNSHIP', started: 'Nov 2, 2026', path: 'KamiLabs', aggregate: ['web', 'torii', 'chai', 'neo'],
    tagline: 'Internship: building websites with Claude Code.',
    about: 'Every update I log on a KamiLabs project also shows up here, tagged with its project. One place to see the whole internship.',
    stack: ['4 projects'],
    plan: [[1, 'Onboarding', 'Nov 2'], [1, 'First PR merged', 'Nov 5'], [0, 'Chai Bistro launch', 'Nov 28'], [0, 'Mid-internship review', 'Dec']],
    hours: [0, 32, 30, 8] },
};
// the sticky note on each project's About page
const BOOK_NOTES = {
  lyra: 'Encore should feel like a friend’s mixtape, not an algorithm.',
  vincula: 'Never show GPS. Only “in the library”. Privacy first.',
  jobbot: 'It should only ping me when it truly needs me.',
  montra: 'Paused till December. Voice works, charts next.',
  liveos: 'Lock the UI first, then build. Phone sync later.',
  web: 'A critic with no stake catches what I can’t see.',
  torii: 'No design until every fact is in the truth file.',
  chai: 'Launch Nov 28. Menu photos need a re-shoot.',
  neo: 'Apply flow next. Resume upload must work on phones.',
  kami: '30 hours a week. Ask for feedback at mid-review.',
};
const projSVG = body => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 228">${body}</svg>`);
const PROJ_ART = {
  lyra: () => projSVG(`<rect width="300" height="228" fill="#1b1430"/><circle cx="150" cy="118" r="92" fill="#0d0b12"/>${[82, 70, 58, 46].map(r => `<circle cx="150" cy="118" r="${r}" fill="none" stroke="#2c2645" stroke-width="2"/>`).join('')}<circle cx="150" cy="118" r="30" fill="#ff5fa2"/><circle cx="150" cy="118" r="4" fill="#0d0b12"/><rect x="232" y="26" width="9" height="104" rx="4.5" fill="#c9c9d6" transform="rotate(24 236 26)"/><text x="16" y="30" font-family="Arial" font-weight="700" font-size="17" fill="#ff9cc8">Encore ▶</text>`),
  vincula: () => projSVG(`<rect width="300" height="228" fill="#8fcf7a"/>${Array.from({ length: 15 }, (_, i) => `<rect x="${(i % 5) * 60 + 8}" y="${Math.floor(i / 5) * 72 + 10}" width="44" height="52" fill="${['#f2d16b', '#e9845e', '#7ab3e0', '#d9a7e8', '#f0f0e6'][i % 5]}" stroke="#2d4a2a" stroke-width="3"/>`).join('')}${[[52, 40], [170, 112], [236, 186]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#ff3b5c" stroke="#fff" stroke-width="3"/>`).join('')}<rect x="0" y="200" width="300" height="28" fill="#2d4a2a"/><text x="12" y="219" font-family="Courier New,monospace" font-weight="700" font-size="14" fill="#d9f7c9">3 friends · Library</text>`),
  jobbot: () => projSVG(`<rect width="300" height="228" fill="#f4f1ea"/>${['Finder', 'Filter', 'Documents', 'Apply', 'Tracker'].map((t, i) => `<rect x="22" y="${18 + i * 40}" width="256" height="32" rx="7" fill="#fff" stroke="#d9d2c3"/><circle cx="42" cy="${34 + i * 40}" r="9" fill="${i < 2 ? '#22a55b' : '#d9d2c3'}"/><text x="60" y="${39 + i * 40}" font-family="Arial" font-weight="700" font-size="14" fill="#2b2620">${t}</text><text x="262" y="${39 + i * 40}" font-family="Arial" font-size="12" fill="#8a7f6e" text-anchor="end">${i < 2 ? 'running' : 'next'}</text>`).join('')}`),
  montra: () => projSVG(`<rect width="300" height="228" fill="#0f766e"/><circle cx="150" cy="92" r="52" fill="#14b8a6"/><rect x="136" y="58" width="28" height="50" rx="14" fill="#fff"/><path d="M122 96 a28 28 0 0 0 56 0" fill="none" stroke="#fff" stroke-width="5"/><rect x="147" y="122" width="6" height="14" fill="#fff"/><rect x="40" y="166" width="220" height="40" rx="10" fill="#fff"/><text x="150" y="192" font-family="Arial" font-weight="700" font-size="16" fill="#0f766e" text-anchor="middle">₹10 · Transport · today</text>`),
  liveos: () => projSVG(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="300" height="228" fill="url(#g)"/><text x="150" y="96" font-family="Arial Black,Arial" font-weight="900" font-size="38" fill="#fff" text-anchor="middle">Tessera</text><rect x="48" y="150" width="204" height="44" rx="12" fill="#fff"/>${['#22a55b', '#3d63f0', '#ef8a17', '#ffd43b', '#e5484d', '#9747ff'].map((c, i) => `<rect x="${60 + i * 31}" y="160" width="24" height="24" rx="6" fill="${c}"/>`).join('')}`),
  web: () => projSVG(`<rect width="300" height="228" fill="#e8ecf4"/><rect x="18" y="18" width="264" height="192" rx="10" fill="#fff" stroke="#c9d1e0"/><rect x="18" y="18" width="264" height="28" rx="10" fill="#1e2433"/><circle cx="36" cy="32" r="5" fill="#ff5f57"/><circle cx="52" cy="32" r="5" fill="#febc2e"/><circle cx="68" cy="32" r="5" fill="#28c840"/>${['Sight', 'Critic', 'Gates'].map((t, i) => `<rect x="${34 + i * 82}" y="96" width="66" height="44" rx="8" fill="${['#dbe7ff', '#ffe1dd', '#dcf5e3'][i]}"/><text x="${67 + i * 82}" y="123" font-family="Arial" font-weight="700" font-size="14" fill="#1e2433" text-anchor="middle">${t}</text>`).join('')}<path d="M100 118 h16 M182 118 h16" stroke="#1e2433" stroke-width="3"/><text x="150" y="182" font-family="Arial" font-size="13" fill="#5b6478" text-anchor="middle">score 8.6 / 10 · ship it</text>`),
  torii: () => projSVG(`<rect width="300" height="228" fill="#f6efe2"/><circle cx="226" cy="58" r="26" fill="#f4b183" opacity=".6"/><rect x="40" y="52" width="220" height="16" rx="4" fill="#c8312b"/><rect x="58" y="80" width="184" height="11" fill="#c8312b"/><rect x="82" y="68" width="16" height="140" fill="#c8312b"/><rect x="202" y="68" width="16" height="140" fill="#c8312b"/><rect x="146" y="68" width="8" height="23" fill="#c8312b"/><rect x="0" y="206" width="300" height="22" fill="#d9ccb2"/>`),
  chai: () => ART.chai(),
  neo: () => projSVG(`<rect width="300" height="228" fill="#fff8e6"/><circle cx="252" cy="46" r="26" fill="#ffc83d"/>${[0, 1, 2].map(i => `<rect x="22" y="${30 + i * 62}" width="190" height="50" rx="8" fill="#fff" stroke="#eadfbf"/><rect x="34" y="${42 + i * 62}" width="104" height="9" rx="4" fill="#2b2620"/><rect x="34" y="${58 + i * 62}" width="70" height="7" rx="3.5" fill="#c9bfa5"/><rect x="152" y="${44 + i * 62}" width="48" height="22" rx="11" fill="#22a55b"/><text x="176" y="${59 + i * 62}" font-family="Arial" font-weight="700" font-size="11" fill="#fff" text-anchor="middle">Apply</text>`).join('')}`),
  kami: () => projSVG(`<rect width="300" height="228" fill="#1f2937"/><text x="150" y="70" font-family="Arial Black,Arial" font-weight="900" font-size="32" fill="#f2ead8" text-anchor="middle">KamiLabs</text>${['Web', 'Torii', 'Chai', 'Neo'].map((t, i) => `<rect x="${24 + i * 66}" y="110" width="56" height="70" rx="8" fill="${['#93c5fd', '#fca5a5', '#fcd34d', '#86efac'][i]}"/><text x="${52 + i * 66}" y="150" font-family="Arial" font-weight="700" font-size="13" fill="#1f2937" text-anchor="middle">${t}</text>`).join('')}`),
};
function bookEntries(id) {
  const b = BOOKS[id];
  if (!b.aggregate) return b.entries.map(e => [...e, null]);
  return b.aggregate.flatMap(k => BOOKS[k].entries.map(e => [...e, BOOKS[k].name])).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}
function bookWeek(m, d) { const t = new Date(2026, m, d); let w = 0; BOOK_WEEKS.forEach((st, i) => { if (t >= st) w = i; }); return w; }
// DSA questions per day in November (index 0 = Nov 1); today's count follows the "2 DSA questions" routine
const DSA_NOV = [3, 2, 4, 3, 2, 5, 0, 3, 0, 4, 3, 4, 3, 2, 5, 3];
const FILES = {
  'gym-nov': { folder: 'gym', title: 'November', year: 2026, no: 'GYM-1126', opened: 'NOV 01', band: ['PROGRESS REPORT', 'Read only if you lift'], spread: 'gym', r: -3, live: true },
  'gym-oct': { folder: 'gym', title: 'October', year: 2026, no: 'GYM-1026', opened: 'OCT 01', band: ['CLOSED FILE', '26 sessions logged'], spread: 'gym', r: 2 },
  'gym-sep': { folder: 'gym', title: 'September', year: 2026, no: 'GYM-0926', opened: 'SEP 01', band: ['CLOSED FILE', 'Where it started'], spread: 'gym', r: -1 },
  'code-nov': { folder: 'code', title: 'November', year: 2026, no: 'COD-1126', opened: 'NOV 01', band: ['PROGRESS REPORT', '46 problems and counting'], spread: 'code', r: -2, live: true },
  'code-oct': { folder: 'code', title: 'October', year: 2026, no: 'COD-1026', opened: 'OCT 01', band: ['CLOSED FILE', 'Rating 1520'], spread: 'code', r: 3 },
  'cre-nov': { folder: 'cre', title: 'November', year: 2026, no: 'CRE-1126', opened: 'NOV 01', band: ['PROGRESS REPORT', 'Paint, play, speak'], spread: 'cre', r: -2, live: true },
  'cre-oct': { folder: 'cre', title: 'October', year: 2026, no: 'CRE-1026', opened: 'OCT 01', band: ['CLOSED FILE', 'First brush'], spread: 'cre', r: 2 },
  'p-lyra': { folder: 'proj', title: 'Lyra', year: 2026, no: 'PRJ-0101', opened: 'SEP 2026', band: ['PROJECT FILE', 'Updated today'], spread: 'book', book: 'lyra', r: -2 },
  'p-vincula': { folder: 'proj', title: 'Vincula', year: 2026, no: 'PRJ-0102', opened: 'OCT 2026', band: ['PROJECT FILE', 'Campus social app'], spread: 'book', book: 'vincula', r: 2 },
  'p-jobbot': { folder: 'proj', title: 'Job Bot', year: 2026, no: 'PRJ-0103', opened: 'OCT 2026', band: ['PROJECT FILE', 'Updated today'], spread: 'book', book: 'jobbot', r: -1 },
  'p-montra': { folder: 'proj', title: 'Montra', year: 2026, no: 'PRJ-0104', opened: 'OCT 2026', band: ['PROJECT FILE', 'Paused'], spread: 'book', book: 'montra', r: 3 },
  'p-liveos': { folder: 'proj', title: 'Tessera', year: 2026, no: 'PRJ-0105', opened: 'NOV 2026', band: ['PROJECT FILE', 'Mockup stage'], spread: 'book', book: 'liveos', r: -2 },
  'k-all': { folder: 'kami', title: 'KamiLabs', year: 2026, no: 'KML-0000', opened: 'NOV 02', band: ['COMPANY FILE', 'All projects, one book'], spread: 'book', book: 'kami', r: -2 },
  'k-web': { folder: 'kami', title: 'Web harness', year: 2026, no: 'KML-0001', opened: 'NOV 03', band: ['PROJECT FILE', 'Updated today'], spread: 'book', book: 'web', r: 2 },
  'k-torii': { folder: 'kami', title: 'Torii', year: 2026, no: 'KML-0002', opened: 'NOV 04', band: ['PROJECT FILE', 'Truth file done'], spread: 'book', book: 'torii', r: -1 },
  'k-chai': { folder: 'kami', title: 'Chai Bistro', year: 2026, no: 'KML-0003', opened: 'NOV 06', band: ['PROJECT FILE', 'Launch Nov 28'], spread: 'book', book: 'chai', r: 3 },
  'k-neo': { folder: 'kami', title: 'Neo Urja portal', year: 2026, no: 'KML-0004', opened: 'NOV 02', band: ['PROJECT FILE', 'Updated today'], spread: 'book', book: 'neo', r: -2 },
};

// the manila case-file folder for each department (first screen)
const CASES = {
  gym: { no: 'GYM-26', div: 'FITNESS DIVISION', sub: 'Building the stronger me', art: () => ART.gym(), cap: '120 KG',
    profile: ['6 days a week', 'Progressive overload', 'No sugar'], circle: 'Not a phase.' },
  code: { no: 'COD-26', div: 'CODE & CAREER DIVISION', sub: 'Two questions a day', art: () => ART.contest(), cap: '+67',
    profile: ['2 DSA a day', 'Contests weekly', 'Open source'], circle: 'Pupil now.' },
  cre: { no: 'CRE-26', div: 'CREATIVE DIVISION', sub: 'Paint, play, speak', art: () => ART.paint(), cap: 'SUNSET',
    profile: ['Painting Saturdays', 'Japanese daily', 'Football Thu + Fri'], circle: 'Keep going.' },
  proj: { no: 'PRJ-26', div: 'PERSONAL PROJECTS', sub: 'Five things I’m building', art: () => PROJ_ART.liveos(), cap: 'TESSERA',
    profile: ['Lyra · Vincula', 'Job Bot · Montra', 'Tessera'], circle: 'Ship weekly.' },
  kami: { no: 'KML-26', div: 'COMPANY · INTERNSHIP', sub: 'Building sites with Claude', art: () => PROJ_ART.kami(), cap: 'INTERN',
    profile: ['Web harness', 'Torii · Chai Bistro', 'Neo Urja portal'], circle: 'Day 15.' },
};
// gym stamps for November (day → label); core/store.js redraws them from the Gym hours
const GYM_STAMPS = { 1: 'DAY 1', 2: 'CHEST', 3: 'BACK', 4: 'LEGS', 5: 'SHLD', 6: 'ARMS', 7: 'FULL', 10: 'BACK', 11: 'LEGS', 12: 'SHLD', 13: 'ARMS', 14: 'PR!', 16: 'CHEST' };
const SPLIT = ['', 'CHEST', 'BACK', 'LEGS', 'SHLD', 'ARMS', 'FULL']; // by getDay()

// the deadlift PR day; its gym stamp says PR!
const PR_DAY = 14;
// documents you can change in the archive (saved by store.js): lift log [lift, Nov 1, now], diet rules [kept, rule],
// body measurements, and the things done this month that weren't on any list
const LIFTS = [['Deadlift', 100, 120], ['Squat', 80, 95], ['Bench', 60, 70], ['Overhead press', 40, 45], ['Pull-ups', 6, 10], ['Body weight', 72.0, 74.5]];
const DIET = [[1, 'Only clean food'], [1, 'No sugar'], [1, '3 L of water a day'], [0, 'Late-night snacks']];
const BODY = [['Weight', '72.0 → 74.5 kg'], ['Chest', '96 → 98 cm'], ['Arms', '33 → 34.5 cm'], ['Waist', '81 → 80 cm']];
const ALSO = [['2 Kaggle problems', 'Titanic, House prices'], ['Codeforces +67', 'Reached Pupil'], ['3 open source PRs merged', 'Docs, parser test, CLI flag'], ['Applied to 18 internships', '3 OAs, 1 interview'], ['Learned segment trees', '6 problems']];
