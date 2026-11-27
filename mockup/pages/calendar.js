// Tessera · Calendar: a week at a time, the month beside it, routines as dots, and the coding contests imported for you.
// Double-click a day to add, an event to edit. A card opens beside what you clicked; Esc or a click outside closes it.
'use strict';
Object.assign(S, { wk: 0, mmOff: 0, calFresh: null });

const SVG = d => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const IC = { l: SVG('M10 3.5 5.5 8l4.5 4.5'), r: SVG('M6 3.5 10.5 8 6 12.5'), plus: SVG('M8 3v10M3 8h10'), x: SVG('M4.5 4.5l7 7M11.5 4.5l-7 7') };
const toHHMM = t => String(Math.floor(t)).padStart(2, '0') + ':' + String(Math.round((t % 1) * 60)).padStart(2, '0');
const fromHHMM = v => { const [h, m] = v.split(':').map(Number); return h + (m || 0) / 60; };
const dayLabel = D => { const d = addDays(TODAY, D); return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`; };
const drop = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); };
const noBrackets = title => title.replace(/\s*\(.*\)/, '');

function goWeek(wk) {
  S.wk = wk;
  const ws = addDays(TODAY, wk * 7);
  S.mmOff = (ws.getFullYear() - TODAY.getFullYear()) * 12 + ws.getMonth() - TODAY.getMonth();
  render();
}

// ---------- the card: opens next to what you clicked ----------
function closePop() {
  $('#pop')?.remove();
  document.removeEventListener('pointerdown', closePop.out, true);
  document.removeEventListener('keydown', closePop.key, true);
}
FLOATS.push(closePop);
function openPop(anchor, html, bind, below = false) {
  closeFloats();
  const p = document.createElement('div'); p.className = 'pop'; p.id = 'pop'; p.dataset.float = ''; p.setAttribute('role', 'dialog');
  p.innerHTML = html; document.body.appendChild(p);
  const place = () => {
    const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight, gap = 10;
    let x = r.right + gap, y = r.top;
    if (x + w > innerWidth - 12) x = r.left - gap - w;
    if (below) { x = Math.max(12, Math.min(innerWidth - w - 12, r.right - w)); y = r.bottom + gap; }
    else if (x < 12) { x = Math.max(12, Math.min(innerWidth - w - 12, r.left)); y = r.bottom + gap; }
    p.style.left = x + 'px'; p.style.top = Math.max(12, Math.min(innerHeight - h - 12, y)) + 'px';
  };
  place(); p.place = place;
  closePop.out = e => { if (!p.contains(e.target)) closePop(); };
  closePop.key = e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } };
  setTimeout(() => document.addEventListener('pointerdown', closePop.out, true));
  document.addEventListener('keydown', closePop.key, true);
  $$('[data-x]', p).forEach(b => b.onclick = closePop);
  bind(p);
  return p;
}
const popTop = label => `<div class="ptop"><span>${label}</span><button type="button" class="px" data-x aria-label="Close">${IC.x}</button></div>`;
const catChips = cal => `<div class="pcats" role="radiogroup" aria-label="Category">${Object.entries(CALS).map(([k, c]) => `<button type="button" data-cat="${k}" class="${k === cal ? 'on' : ''}" style="--cs:${c.color}" role="radio" aria-checked="${k === cal}">${c.name}<i class="tick">${TICK}</i></button>`).join('')}</div>`;
function bindCats(p, set) {
  $$('[data-cat]', p).forEach(b => b.onclick = () => {
    set(b.dataset.cat);
    $$('[data-cat]', p).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
  });
}
// Delete and Save; deleting something that repeats turns the footer into choices
function footer(p, del, save) {
  const foot = $('.pfoot', p);
  foot.innerHTML = '<button type="button" class="pbtn redt" data-del>Delete</button><button type="button" class="pbtn dark" data-save>Save</button>';
  $('[data-del]', foot).onclick = del; $('[data-save]', foot).onclick = save;
}
function askDelete(p, question, choices, back) {
  const foot = $('.pfoot', p);
  foot.innerHTML = `<p class="pask">${question}</p>` + choices.map(([label, , red], i) => `<button type="button" class="pbtn ${red ? 'red' : ''}" data-ch="${i}">${label}</button>`).join('') + '<button type="button" class="pbtn" data-back>Cancel</button>';
  foot.classList.add('asking'); p.place();
  $$('[data-ch]', foot).forEach(b => b.onclick = () => choices[+b.dataset.ch][1]());
  $('[data-back]', foot).onclick = () => { foot.classList.remove('asking'); back(); p.place(); };
}
const calDone = msg => { closePop(); render(); toast(msg); };

// + or a double-click on a day: title, day, optional time, optional weekly repeat. The colour is picked for you.
function addPop(anchor, D, below = false) {
  const D0 = S.wk * 7, pick = new Set([D]);
  let timed = false, rep = false, s = 18, en = 19;
  openPop(anchor, `${popTop('New event')}
    <input class="ptitle" id="pe-t" placeholder="e.g. Mock interview at 6pm" aria-label="Title" autocomplete="off">
    <div class="plabel">Day</div>
    <div class="pdays">${Array.from({ length: 7 }, (_, i) => `<button type="button" data-day="${D0 + i}">${dayLabel(D0 + i)}</button>`).join('')}</div>
    <div class="plabel">Time</div>
    <div class="ptimes"><span class="pseg"><button type="button" data-t="0">No time</button><button type="button" data-t="1">Add time</button></span>
      <span class="prange"><input type="time" id="pe-s" aria-label="Starts"><em>to</em><input type="time" id="pe-e" aria-label="Ends"></span></div>
    <button type="button" class="ptog" id="pe-rep" aria-pressed="false"><i></i>Repeat every week</button>
    <div class="pfoot"><button type="button" class="pbtn" data-x>Cancel</button><button type="button" class="pbtn dark" id="pe-add">Add</button></div>`, p => {
    const title = $('#pe-t', p), si = $('#pe-s', p), ei = $('#pe-e', p);
    const sync = () => {
      $$('[data-day]', p).forEach(b => b.classList.toggle('on', pick.has(+b.dataset.day)));
      $$('[data-t]', p).forEach(b => b.classList.toggle('on', +b.dataset.t === +timed));
      $('.prange', p).hidden = !timed; si.value = toHHMM(s); ei.value = toHHMM(en);
      $('#pe-rep', p).classList.toggle('on', rep); $('#pe-rep', p).setAttribute('aria-pressed', rep);
      p.place();
    };
    $$('[data-day]', p).forEach(b => b.onclick = () => {
      const i = +b.dataset.day;
      if (!rep) { pick.clear(); pick.add(i); } else if (pick.has(i) && pick.size > 1) pick.delete(i); else pick.add(i);
      sync();
    });
    $$('[data-t]', p).forEach(b => b.onclick = () => { timed = b.dataset.t === '1'; sync(); });
    $('#pe-rep', p).onclick = () => { rep = !rep; if (!rep && pick.size > 1) { const f = Math.min(...pick); pick.clear(); pick.add(f); } sync(); };
    si.onchange = () => { s = fromHHMM(si.value || '18:00'); if (en <= s) en = Math.min(24, s + 1); sync(); };
    ei.onchange = () => { en = fromHHMM(ei.value || '19:00'); };
    // "at 6pm" in the title sets the time
    title.oninput = () => { const tm = sortTime(title.value.trim()); if (tm) { timed = true; s = tm.s; en = Math.min(24, s + 1); sync(); } };
    const add = () => {
      const raw = title.value.trim(); if (!raw) return title.focus();
      const tm = sortTime(raw), name = tm ? tm.title : raw, cal = sortTask(name).cal;
      const sel = [...pick].sort((a, b) => a - b), dows = sel.map(x => addDays(TODAY, x).getDay());
      const ids = []; let msg;
      if (timed) {
        if (en <= s) en = Math.min(24, s + 1);
        sel.forEach((x, n) => { const id = 'e' + Date.now() + n; ids.push(id); EVENTS.push({ id, cal, day: x, s, e: en, title: name, rep: rep ? 'Weekly · ' + daySummary(dows) : '' }); });
        msg = `Added at ${fmtTime(s)}${rep ? ', every week' : ''}`;
      } else if (rep) {
        const id = 'r' + Date.now(); ids.push(id);
        ROUTINES.push({ id, cal, title: name, months: { [monthKey(addDays(TODAY, sel[0]))]: dows } });
        msg = 'Repeats with no time, so it shows as a dot';
      } else {
        const id = 'o' + Date.now(); ids.push(id);
        ONEOFFS.push({ id, day: sel[0], cal, title: name });
        msg = `Added to ${dayLabel(sel[0])}`;
      }
      S.calFresh = new Set(ids);
      calDone(msg);
    };
    $('#pe-add', p).onclick = add;
    title.onkeydown = e => { if (e.key === 'Enter') add(); };
    sync(); title.focus();
  }, below);
}

// double-click an event or a task: change its title, time and colour, or delete it
function editPop(anchor, id, D) {
  const e = EVENTS.find(x => x.id === id), o = !e && ONEOFFS.find(x => x.id === id);
  const item = e || o; if (!item) return;
  const d = addDays(TODAY, D), pl = e && e.plat && PLATFORMS[e.plat];
  let cal = item.cal, t = o ? (o.s ?? null) : null;
  const kind = e ? (e.contest ? 'Contest' : e.rep ? `Repeats · ${e.rep.replace(/^Weekly · /, 'every ')}` : 'Event') : 'Task';
  const timesHTML = () => e
    ? `<input type="time" id="pe-s" value="${toHHMM(e.s)}" aria-label="Starts"><em>to</em><input type="time" id="pe-e" value="${toHHMM(e.e)}" aria-label="Ends">`
    : t != null ? `<input type="time" id="pe-s" value="${toHHMM(t)}" aria-label="Time"><button type="button" class="plink" data-notime>No time</button>`
    : '<span class="pmuted">No time</span><button type="button" class="plink" data-addtime>Add a time</button>';
  openPop(anchor, `${popTop(kind)}
    <input class="ptitle" id="pe-t" value="${esc(item.title)}" aria-label="Title" autocomplete="off">
    <div class="prow">${DAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}</div>
    <div class="ptimes">${timesHTML()}</div>
    ${pl ? `<div class="psrc"><span class="plat" style="background:${pl.bg};color:${pl.fg}">${e.plat}</span><span>From ${pl.name}. The time updates if the contest moves.</span></div>` : ''}
    ${catChips(cal)}
    <div class="pfoot"></div>`, p => {
    const bindTimes = () => {
      $('[data-addtime]', p)?.addEventListener('click', () => { t = 18; $('.ptimes', p).innerHTML = timesHTML(); bindTimes(); $('#pe-s', p).focus(); });
      $('[data-notime]', p)?.addEventListener('click', () => { t = null; $('.ptimes', p).innerHTML = timesHTML(); bindTimes(); });
      if (o && $('#pe-s', p)) $('#pe-s', p).onchange = ev => { t = fromHHMM(ev.target.value || '18:00'); };
    };
    bindTimes();
    bindCats(p, c => { cal = c; });
    const save = () => {
      const v = $('#pe-t', p).value.trim();
      if (v && v !== item.title) { item.title = v; delete item.short; }
      if (cal !== item.cal) { item.cal = cal; sortTeach(item.short || item.title, cal); }
      if (e) {
        const s = fromHHMM($('#pe-s', p).value || toHHMM(e.s)), en = fromHHMM($('#pe-e', p).value || toHHMM(e.e));
        e.s = s; e.e = en > s ? en : Math.min(24, s + 0.5);
      } else if (t != null) { o.s = t; o.time = fmtTime(t); } else { delete o.s; delete o.time; }
      calDone('Saved');
    };
    const del = () => {
      if (o) { drop(ONEOFFS, o); return calDone(`Deleted “${o.title}”`); }
      if (!e.rep) { drop(EVENTS, e); return calDone(`Deleted “${e.short || e.title}”`); }
      const sibs = EVENTS.filter(x => x.rep && x.title === e.title), when = dayLabel(D);
      askDelete(p, 'It repeats. Delete which?', [
        [`Only ${when}`, () => { (e.skip = e.skip || []).push(D); calDone(`Removed from ${when} only`); }],
        [`Every ${DAY_NAMES[d.getDay()]}`, () => { drop(EVENTS, e); calDone(`Deleted every ${DAY_NAMES[d.getDay()]}`); }, sibs.length <= 1],
        ...(sibs.length > 1 ? [['All days', () => { sibs.forEach(x => drop(EVENTS, x)); calDone(`Deleted “${e.title}”`); }, true]] : []),
      ], () => footer(p, del, save));
    };
    footer(p, del, save);
    $('#pe-t', p).onkeydown = ev => { if (ev.key === 'Enter') save(); };
  });
}

// a routine dot (double-click) or a routine in the list: its days, title and colour
function routinePop(anchor, id, D) {
  const r = ROUTINES.find(x => x.id === id); if (!r) return;
  const mk = monthKey(addDays(TODAY, D ?? S.wk * 7));
  let days = [...routineDaysForKey(r, mk)], cal = r.cal;
  openPop(anchor, `${popTop('Routine · no time, so a dot')}
    <input class="ptitle" id="pe-t" value="${esc(r.title)}" aria-label="Title" autocomplete="off">
    <div class="plabel">Repeats on · from ${monthLabel(mk)}</div>
    <div class="pdays wk">${[1, 2, 3, 4, 5, 6, 0].map(x => `<button type="button" data-dow="${x}" class="${days.includes(x) ? 'on' : ''}">${DAY_NAMES[x].slice(0, 2)}</button>`).join('')}</div>
    ${catChips(cal)}
    <div class="pfoot"></div>`, p => {
    $$('[data-dow]', p).forEach(b => b.onclick = () => {
      const x = +b.dataset.dow; days = days.includes(x) ? days.filter(y => y !== x) : [...days, x];
      b.classList.toggle('on', days.includes(x));
    });
    bindCats(p, c => { cal = c; });
    const save = () => {
      if (!days.length) return toast('Pick at least one day');
      const v = $('#pe-t', p).value.trim(); if (v) r.title = v;
      if (cal !== r.cal) { r.cal = cal; sortTeach(r.title, cal); }
      Object.keys(r.months).forEach(m => { if (m > mk) delete r.months[m]; });
      r.months[mk] = days;
      calDone('Saved');
    };
    const del = () => askDelete(p, D != null ? 'Delete just this day, or the routine?' : 'Delete this routine?', [
      ...(D != null ? [[`Only ${dayLabel(D)}`, () => { (r.skip = r.skip || []).push(D); calDone(`Removed from ${dayLabel(D)} only`); }]] : []),
      ['Whole routine', () => { drop(ROUTINES, r); calDone(`Deleted “${r.title}”`); }, true],
    ], () => footer(p, del, save));
    footer(p, del, save);
  });
}

P.calendar = () => {
  const D0 = S.wk * 7, ws = addDays(TODAY, D0), we = addDays(ws, 6);
  const days = Array.from({ length: 7 }, (_, i) => D0 + i);
  const contests = EVENTS.filter(e => e.contest && e.day * 24 + e.s > NOW_H).sort((a, b) => a.day - b.day || a.s - b.s);
  const nx = contests[0], h = nx ? nx.day * 24 + nx.s - NOW_H : 0, nd = nx && addDays(TODAY, nx.day), np = nx && PLATFORMS[nx.plat];
  const timedOn = D => [
    ...eventsOn(D).map(e => ({ kind: 'event', id: e.id, s: e.s, cal: e.cal, label: e.short || e.title })),
    ...ONEOFFS.filter(o => o.day === D && o.s != null).map(o => ({ kind: 'task', id: o.id, s: o.s, cal: o.cal, label: o.title })),
  ].sort((a, b) => a.s - b.s);
  const count = days.reduce((a, D) => a + timedOn(D).length, 0);
  const fresh = id => (S.calFresh && S.calFresh.has(id) ? ' fresh' : '');
  const evBtn = (kind, id, D, cal, time, label) => `<button class="ev${kind === 'task' ? ' task' : ''}${statusOf(D, id) === 'done' ? ' done' : ''}${fresh(id)}" data-ev="${id}" data-d="${D}" style="--ec:${CALS[cal].color}" title="Double-click to edit">${time ? `<small>${time}</small>` : ''}<b>${esc(label)}</b></button>`;
  const col = D => {
    const d = addDays(TODAY, D);
    return `<div class="wcol ${D === 0 ? 'today' : ''}" data-col="${D}">
      <div class="dh">${DAY_NAMES[d.getDay()]}<b>${d.getDate()}</b></div>
      <div class="dots">${ROUTINES.filter(r => routineOn(r, d)).map(r => `<button class="${statusOf(D, r.id) === 'done' ? 'on' : ''}${fresh(r.id)}" data-rt="${r.id}" data-d="${D}" style="--c:${CALS[r.cal].color}" title="${esc(r.title)} · double-click to edit" aria-label="${esc(r.title)}"></button>`).join('')}</div>
      ${ONEOFFS.filter(o => o.day === D && o.s == null).map(o => evBtn('task', o.id, D, o.cal, '', o.title)).join('')}
      ${timedOn(D).map(x => evBtn(x.kind, x.id, D, x.cal, fmtTime(x.s), x.label)).join('')}
      <button class="wadd" data-add="${D}" aria-label="Add on ${dayLabel(D)}">${IC.plus}</button>
    </div>`;
  };
  // the small month: any date jumps to its week
  const first = new Date(TODAY.getFullYear(), TODAY.getMonth() + S.mmOff, 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  let mm = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="dn">${x}</span>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), inWk = d >= ws && d <= we;
    const cls = [d.getMonth() !== first.getMonth() && 'out', inWk && 'wk', inWk && d.getDay() === 1 && 'first', inWk && d.getDay() === 0 && 'last', +d === +TODAY && 'today'].filter(Boolean).join(' ');
    mm += `<button class="${cls}" data-goto="${dayIdx(d)}" aria-label="Week of ${d.getDate()} ${MONTHS[d.getMonth()]}">${+d === +TODAY ? `<i>${d.getDate()}</i>` : d.getDate()}</button>`;
  }
  const title = ws.getMonth() === we.getMonth() ? `${MONTHS[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}.` : `${MON3[ws.getMonth()]} ${ws.getDate()} – ${MON3[we.getMonth()]} ${we.getDate()}.`;
  S.calFresh = null;
  return `<main class="bento p-cal">
    <section class="tile g-sea lead" style="grid-area:week">
      <div class="copy"><b>${title}</b> <span>Double-click a day to add, an event to edit.</span></div>
      <div class="wnav"><button class="pillb" data-wk="0" ${S.wk === 0 ? 'disabled' : ''}>Today</button><button data-wk="${S.wk - 1}" aria-label="Previous week">${IC.l}</button><button data-wk="${S.wk + 1}" aria-label="Next week">${IC.r}</button><button id="cal-add" aria-label="New event">${IC.plus}</button></div>
      <div class="card wcard">${days.map(col).join('')}</div>
    </section>
    <section class="tile g-night tall" style="grid-area:cont">
      ${nx ? `<div class="copy cont-head"><span class="plat" style="background:${np.bg};color:${np.fg}">${nx.plat}</span><b>Next contest.</b></div>
      <div class="cd"><div class="big">${Math.floor(h / 24)}<small>d</small>${Math.floor(h % 24)}<small>h</small></div>
        <p>${esc(noBrackets(nx.title))}<br>${DAY_LONG[nd.getDay()]} ${nd.getDate()} · ${fmtTime(nx.s)}</p>
        <button data-reg>Register</button></div>` : '<div class="copy"><b>No contests coming up.</b></div>'}
    </section>
    <section class="tile g-paper" style="grid-area:mini">
      <div class="copy"><b>${MONTHS[first.getMonth()]}${first.getFullYear() !== TODAY.getFullYear() ? ' ' + first.getFullYear() : ''}.</b></div>
      <div class="mmnav"><button data-mm="-1" aria-label="Previous month">${IC.l}</button><button data-mm="1" aria-label="Next month">${IC.r}</button></div>
      <div class="mm">${mm}</div>
    </section>
    <section class="tile g-cream" style="grid-area:rout">
      <div class="copy"><b>Routines.</b> <span>No time, so dots.</span></div>
      <div class="rmini">${ROUTINES.map(r => `<button data-rt="${r.id}" style="--cs:${CALS[r.cal].color}" title="Edit ${esc(r.title)}"><b>${esc(r.title)}</b><small>${daySummary(routineDaysForKey(r, monthKey(ws))).replace('Every day', 'Daily')}</small></button>`).join('')}</div>
    </section>
    <section class="tile g-green" style="grid-area:evs">
      <div class="copy"><b>${S.wk === 0 ? 'This week.' : 'That week.'}</b> <span>Timed things on the calendar.</span></div>
      <div class="stat">${count}</div>
    </section>
    <section class="tile g-orange" style="grid-area:upc">
      <div class="copy"><b>Contests.</b> <span>Imported for you.</span></div>
      <div class="ulist">${contests.slice(1, 4).map(e => { const pf = PLATFORMS[e.plat], d = addDays(TODAY, e.day); return `<button data-contest="${e.id}"><span class="plat" style="background:${pf.bg};color:${pf.fg}">${e.plat}</span><span>${esc(noBrackets(e.title))}</span><small>${DAY_NAMES[d.getDay()]} ${d.getDate()}</small></button>`; }).join('')}</div>
    </section>
  </main>`;
};

P.calendar.bind = root => {
  $('[data-reg]', root)?.addEventListener('click', () => toast('Opens the contest page to register'));
  $$('[data-wk]', root).forEach(b => b.onclick = () => goWeek(+b.dataset.wk));
  $$('[data-mm]', root).forEach(b => b.onclick = () => { S.mmOff += +b.dataset.mm; render(); });
  $$('[data-goto]', root).forEach(b => b.onclick = () => goWeek(Math.floor(+b.dataset.goto / 7)));
  $('#cal-add', root).onclick = ev => addPop(ev.currentTarget, S.wk === 0 ? 0 : S.wk * 7, true);
  $$('[data-add]', root).forEach(b => b.onclick = () => addPop(b.closest('.wcol'), +b.dataset.add));
  // on the week itself only a double-click opens a card, so a stray click never does anything
  $$('.wcol', root).forEach(c => c.ondblclick = ev => { if (ev.target === c) addPop(c, +c.dataset.col); });
  $$('[data-ev]', root).forEach(b => b.ondblclick = () => editPop(b, b.dataset.ev, +b.dataset.d));
  $$('.dots [data-rt]', root).forEach(b => b.ondblclick = () => routinePop(b, b.dataset.rt, +b.dataset.d));
  $$('.rmini [data-rt]', root).forEach(b => b.onclick = () => routinePop(b, b.dataset.rt, null));
  $$('[data-contest]', root).forEach(b => b.onclick = () => {
    const e = EVENTS.find(x => x.id === b.dataset.contest); if (!e) return;
    goWeek(Math.floor(e.day / 7));
    const el = $(`[data-ev="${e.id}"][data-d="${e.day}"]`); if (el) editPop(el, e.id, e.day);
  });
};
