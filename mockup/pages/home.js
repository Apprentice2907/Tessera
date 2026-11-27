// Tessera · Home: one tile per section, each showing where it stands today. Every tile opens its section.
'use strict';
// what the Ideas board holds (the board saves itself in this browser); null until it has been opened once
function ideasNow() {
  try {
    const b = JSON.parse(localStorage.getItem('lo.wb.b.ideas-2026'));
    if (b && b.objs) {
      const notes = Object.values(b.objs).filter(o => o.type === 'note');
      return { n: notes.length, first: notes.find(o => (o.text || '').trim())?.text || '' };
    }
  } catch { /* nothing saved yet */ }
  return null;
}
const inHM = h => { const m = Math.max(0, Math.round(h * 60)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`; };
const fmtN = v => (Math.round(v * 10) / 10).toString();
// November's DSA questions, one square a day; rows start on Monday (Nov 1, 2026 is a Sunday)
function ghHTML() {
  let g = '<i class="x"></i>'.repeat(6);
  for (let d = 1; d <= 30; d++) {
    const v = DSA_NOV[d - 1];
    g += v === undefined ? '<i class="f"></i>' : `<i class="${v === 0 ? '' : 'l' + (v <= 2 ? 1 : v === 3 ? 2 : v === 4 ? 3 : 4)}" title="Nov ${d}: ${v} questions"></i>`;
  }
  return g;
}
// the Memory wall tile: a pin on each polaroid's top centre, red rope between them in order
function placeRopes(root) {
  $$('[data-rope]', root).forEach(tile => {
    const pics = $$('.ix', tile).sort((a, b) => a.dataset.seq - b.dataset.seq);
    const pts = pics.map(el => [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + 15]);
    $$('.pin', tile).forEach(p => p.remove());
    pts.forEach(([x, y]) => { const p = document.createElement('span'); p.className = 'pin'; p.style.left = x + 'px'; p.style.top = y + 'px'; tile.appendChild(p); });
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
    const svg = $('.rope', tile);
    if (svg && pts.length > 1) svg.innerHTML = `<path d="${d}" stroke="#9E0C17" stroke-width="5" stroke-linejoin="round"/><path d="${d}" stroke="#DC1F2B" stroke-width="3.6" stroke-dasharray="3.2 2.2" stroke-linecap="butt" stroke-linejoin="round"/>`;
  });
}

P.home = () => {
  const cells = HOUR_DAYS[0].cells, logged = cells.filter(Boolean).length, st = STORE.stats();
  const tasks = tasksForDay(0), stOf = t => statusOf(0, t.id), done = tasks.filter(t => stOf(t) === 'done').length;
  const rank = t => ({ done: 2, prog: 0, todo: 1 })[stOf(t)];
  const list = [...tasks].sort((a, b) => rank(a) - rank(b) || startOf(a) - startOf(b)).slice(0, 6);
  const evs = eventsOn(0).filter(e => e.s > NOW_H), next = evs[0];
  const lift = LIFTS.find(l => /deadlift/i.test(l[0])) || ['Deadlift', 0, 0];
  const idea = ideasNow(), walls = window.WALL ? WALL.data().walls : [];
  const memories = walls.reduce((n, w) => n + w.items.filter(it => it.kind !== 'prop' && it.kind !== 'place').length, 0), tops = walls.filter(w => !w.parent).length;
  const d = TODAY;
  return `<main class="bento p-home">
    <a class="tile g-bands lead" href="#today" style="grid-area:today">
      <div class="copy"><b>Today.</b> <span>Everything due, in one list.</span></div>
      <div class="card" style="left:16%;top:23%">
        <div class="card-head"><strong>${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}</strong><small>from your calendar</small><span class="pill">${done} of ${tasks.length} done</span></div>
        <div class="rows">${list.map(t => { const note = PNOTES['0|' + t.id]; return `<div class="row ${stOf(t)}" style="--c:${CALS[t.cal].color}"><span class="chk">${CHECK}</span><span class="t">${esc(t.title)}${note ? `<i>${esc(note)}</i>` : ''}</span>${t.time ? `<time>${t.time}</time>` : ''}</div>`; }).join('')}</div>
      </div>
    </a>
    <a class="tile g-green" href="#review/gym" style="grid-area:lift">
      <div class="copy" style="right:72px"><b>${esc(lift[0])} PR.</b> <span>Up ${fmtN(lift[2] - lift[1])} kg since Nov 1.</span></div>
      <span class="up"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13 V3 M3.5 7.5 L8 3 L12.5 7.5"/></svg></span>
      <div class="stat">${fmtN(lift[2])}<small>kg</small></div>
    </a>
    <a class="tile g-kraft tall" href="#wall" style="grid-area:wall" data-rope>
      <div class="copy"><b>Memory wall.</b> <span>${memories ? `${memories} memories on ${tops} wall${tops === 1 ? '' : 's'}.` : 'Nov 10th, a first word.'}</span></div>
      <div class="ix" data-seq="2" style="width:46%;right:-8%;bottom:-10%;--r:5deg"><div class="ph" style="background-image:url('${ART.football()}')"></div><div class="d">November 5th</div></div>
      <div class="ix" data-seq="1" style="width:58%;left:14%;top:30%;--r:-4deg;z-index:2"><div class="ph" style="background-image:url('${ART.japanese()}')"></div><div class="d">November 10th</div></div>
      <svg class="rope"></svg>
    </a>
    <a class="tile g-lilac" href="#calendar" style="grid-area:next">
      ${next ? `<div class="copy" style="display:flex;align-items:center;gap:10px"><span class="label">Next up</span><span>in ${inHM(next.s - NOW_H)}</span></div>
      <div class="stat" style="font-size:clamp(44px, 9.5vh, 76px)">${fmtTime(next.s)}</div>
      <div class="aside">${esc(next.short || next.title)}<small>${evs[1] ? `then ${esc(evs[1].short || evs[1].title)}, ${fmtTime(evs[1].s)}` : 'last one today'}</small></div>`
        : '<div class="copy"><b>Nothing else today.</b> <span>The calendar is clear.</span></div>'}
    </a>
    <a class="tile g-paper wide" href="#hours" style="grid-area:hours">
      <div class="copy"><b>Where today went.</b> <span>${logged} of 24 hours logged.</span></div>
      <div class="hstrip-mini"><div class="strip">${stripHTML(cells)}</div><div class="ticks">${ticksHTML()}</div></div>
    </a>
    <a class="tile g-night" href="#review/code-nov" style="grid-area:dsa">
      <div class="copy"><b>${st.code.questions} questions.</b> <span>Two a day, all month.</span></div>
      <div class="gh">${ghHTML()}</div>
      <div class="aside">${st.code.qdays} of ${TODAY.getDate()} days<small>best streak ${st.code.qbest}</small></div>
    </a>
    <a class="tile g-orange" href="#ideas" style="grid-area:ideas">
      <div class="copy"><b>Ideas.</b> <span>${idea ? `${idea.n} on the board.` : 'Dump it here, connect what matters.'}</span></div>
      <div class="stk" style="background:#FFD966;left:22px;bottom:-18px;--r:-5deg;z-index:3">${esc((idea && idea.first) || 'Niche: dev vlogs + building in public')}</div>
      <div class="stk" style="background:#A8DAFF;left:130px;bottom:-44px;--r:6deg;z-index:2"></div>
      <div class="stk" style="background:#FFB8D1;left:236px;bottom:-30px;--r:-3deg"></div>
    </a>
    <div class="badge" aria-hidden="true"><span class="mark"><i></i><i></i><i></i><i></i></span><b>Tessera</b></div>
  </main>`;
};
P.home.layout = placeRopes;
