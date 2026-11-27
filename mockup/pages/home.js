// Tessera · Home: one tile per section, each showing where it stands today. Every tile opens its section.
'use strict';
// what the Ideas board holds (the board saves itself in this browser); null until it has been opened once
function ideasNow() {
  try {
    const b = JSON.parse(localStorage.getItem('tessera.wb.b.ideas'));
    if (b && b.objs) {
      const notes = Object.values(b.objs).filter(o => o.type === 'note');
      return { n: notes.length, first: notes.find(o => (o.text || '').trim())?.text || '' };
    }
  } catch { /* nothing saved yet */ }
  return null;
}
const inHM = h => { const m = Math.max(0, Math.round(h * 60)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`; };
// this month, a square a day lit by how many tasks you finished; rows start on Monday, days to come are outlines
function monthHTML() {
  const days = monthSoFar(), first = days[0], last = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();
  let g = '<i class="x"></i>'.repeat(((first % 7) + 7) % 7);
  for (let i = 0; i < last; i++) {
    const D = first + i, n = D <= T ? STORE.doneOn(D) : -1;
    g += n < 0 ? '<i class="f"></i>' : `<i class="${n ? 'l' + Math.min(4, n) : ''}" title="${shortDate(D)}: ${plural(n, 'task')} done"></i>`;
  }
  return g;
}
// the Memory wall tile: a pin on each print's top centre, red rope between them in order
function placeRopes(root) {
  $$('[data-rope]', root).forEach(tile => {
    const pics = $$('.ix', tile).sort((a, b) => a.dataset.seq - b.dataset.seq);
    const pts = pics.map(el => [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + 15]);
    $$('.pin', tile).forEach(p => p.remove());
    pts.forEach(([x, y]) => { const p = document.createElement('span'); p.className = 'pin'; p.style.left = x + 'px'; p.style.top = y + 'px'; tile.appendChild(p); });
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
    const svg = $('.rope', tile);
    svg.innerHTML = pts.length > 1 ? `<path d="${d}" stroke="#9E0C17" stroke-width="5" stroke-linejoin="round"/><path d="${d}" stroke="#DC1F2B" stroke-width="3.6" stroke-dasharray="3.2 2.2" stroke-linecap="butt" stroke-linejoin="round"/>` : '';
  });
}
function wallTile() {
  const walls = window.WALL ? WALL.data().walls : [], recent = window.WALL ? WALL.recent(2) : [];
  const memories = walls.reduce((n, w) => n + w.items.filter(it => it.kind !== 'prop' && it.kind !== 'place').length, 0);
  const at = [['width:46%;right:-8%;bottom:-10%;--r:5deg', 2], ['width:58%;left:14%;top:30%;--r:-4deg;z-index:2', 1]];
  const prints = recent.length
    ? recent.map((m, i) => `<div class="ix" data-seq="${at[i][1]}" style="${at[i][0]}"><div class="ph" style="background-image:url('${m.src}')"></div><div class="d">${esc(m.date || m.title || '')}</div></div>`).join('')
    : `<div class="ix blank" data-seq="1" style="${at[1][0]}"><div class="ph"></div><div class="d">your first memory</div></div>`;
  return `<a class="tile g-kraft tall" href="#wall" style="grid-area:wall" data-rope>
      <div class="copy"><b>Memory wall.</b> <span>${memories ? `${plural(memories, 'memory', 'memories')} on ${plural(walls.filter(w => !w.parent).length, 'wall')}.` : 'A wall for a trip, a festival, a season.'}</span></div>
      ${prints}<svg class="rope"></svg>
    </a>`;
}

P.home = () => {
  const cells = hoursOn(T), logged = cells.filter(Boolean).length;
  const tasks = tasksForDay(T), stOf = t => statusOf(T, t.id), done = tasks.filter(t => stOf(t) === 'done').length;
  const rank = t => ({ done: 2, prog: 0, todo: 1 })[stOf(t)];
  const list = [...tasks].sort((a, b) => rank(a) - rank(b) || startOf(a) - startOf(b)).slice(0, 6);
  const evs = eventsOn(T).filter(e => e.s > NOW_H), next = evs[0];
  const streak = STORE.streak(D => STORE.doneOn(D) > 0), month = monthSoFar(), active = month.filter(D => STORE.doneOn(D) > 0).length;
  const doneMonth = month.reduce((n, D) => n + STORE.doneOn(D), 0);
  const idea = ideasNow(), d = TODAY;
  return `<main class="bento p-home">
    <a class="tile g-bands lead" href="#today" style="grid-area:today">
      <div class="copy"><b>Today.</b> <span>Everything due, in one list.</span></div>
      <div class="card" style="left:16%;top:23%">
        <div class="card-head"><strong>${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}</strong>${tasks.length ? `<span class="pill">${done} of ${tasks.length} done</span>` : ''}</div>
        <div class="rows">${list.map(t => { const note = PNOTES[T + '|' + t.id]; return `<div class="row ${stOf(t)}" style="--c:${CALS[t.cal].color}"><span class="chk">${CHECK}</span><span class="t">${esc(t.title)}${note ? `<i>${esc(note)}</i>` : ''}</span>${t.time ? `<time>${t.time}</time>` : ''}</div>`; }).join('') || '<div class="empty">Nothing planned yet. Open Today to add your first task.</div>'}</div>
      </div>
    </a>
    <a class="tile g-green" href="#today" style="grid-area:lift">
      <div class="copy"><b>Streak.</b> <span>Days in a row you finished something.</span></div>
      <div class="stat">${streak}<small>${streak === 1 ? 'day' : 'days'}</small></div>
      <div class="aside">${plural(done, 'task')}<small>done today</small></div>
    </a>
    ${wallTile()}
    <a class="tile g-lilac" href="#calendar" style="grid-area:next">
      ${next ? `<div class="copy home-next"><span class="label">Next up</span><span>in ${inHM(next.s - NOW_H)}</span></div>
      <div class="stat" style="font-size:clamp(44px, 9.5vh, 76px)">${fmtTime(next.s)}</div>
      <div class="aside">${esc(next.short || next.title)}<small>${evs[1] ? `then ${esc(evs[1].short || evs[1].title)}, ${fmtTime(evs[1].s)}` : 'last one today'}</small></div>`
        : '<div class="copy"><b>Nothing else today.</b> <span>The calendar is clear.</span></div>'}
    </a>
    <a class="tile g-paper wide" href="#hours" style="grid-area:hours">
      <div class="copy"><b>Where today went.</b> <span>${logged ? `${logged} of 24 hours logged.` : 'Paint your hours in Hours.'}</span></div>
      <div class="hstrip-mini"><div class="strip">${stripHTML(cells)}</div><div class="ticks">${ticksHTML()}</div></div>
    </a>
    <a class="tile g-night" href="#today" style="grid-area:dsa">
      <div class="copy"><b>${MONTHS[d.getMonth()]}.</b> <span>${plural(doneMonth, 'task')} done so far.</span></div>
      <div class="gh">${monthHTML()}</div>
      <div class="aside">${active} of ${d.getDate()} days<small>with something done</small></div>
    </a>
    <a class="tile g-orange" href="#ideas" style="grid-area:ideas">
      <div class="copy"><b>Ideas.</b> <span>${idea && idea.n ? `${plural(idea.n, 'note')} on the board.` : 'Dump it here, connect what matters.'}</span></div>
      <div class="stk" style="background:#FFD966;left:22px;bottom:-18px;--r:-5deg;z-index:3">${esc((idea && idea.first) || '')}</div>
      <div class="stk" style="background:#A8DAFF;left:130px;bottom:-44px;--r:6deg;z-index:2"></div>
      <div class="stk" style="background:#FFB8D1;left:236px;bottom:-30px;--r:-3deg"></div>
    </a>
    <button class="badge" data-data title="Your data and backups" aria-label="Your data and backups"><span class="mark"><i></i><i></i><i></i><i></i></span><b>Tessera</b></button>
  </main>`;
};
P.home.bind = root => { $('[data-data]', root).onclick = e => openDataCard(e.currentTarget); };
P.home.layout = placeRopes;
P.home.live = true;
