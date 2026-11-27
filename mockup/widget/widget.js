// Tessera · the to-do widget: today's list on its own page. It reads and saves the same store as the app,
// so ticking something here ticks it in Today (and fills its hours in Hours), and the other way round.
//   widget.html        a small page: keep it open, add it to a phone's home screen, or embed it
//   widget.html?bare   no page background, for embedding
//   widget.html?desk   the Windows desktop widget (desktop/widget.pyw): drag any empty part to move it, the corner to resize it
'use strict';
const W = $('#w');
const Q = new URLSearchParams(location.search), DESK = Q.has('desk');
document.body.classList.toggle('bare', Q.has('bare') || DESK);
document.body.classList.toggle('desk', DESK);
// on the desktop, the Python side moves, resizes and closes the window, opens the app,
// and tucks the widget back behind other windows when you click away
const desk = () => window.pywebview?.api;
let fresh = null; // the task just added, so it slides in

function draw() {
  const tasks = tasksForDay(0), st = t => statusOf(0, t.id);
  const starred = t => !!STARS['0|' + t.id];
  const order = (a, b) => (starred(b) - starred(a)) || (startOf(a) - startOf(b));
  const prog = tasks.filter(t => st(t) === 'prog').sort(order), todo = tasks.filter(t => st(t) === 'todo').sort(order), done = tasks.filter(t => st(t) === 'done').sort(order);
  const n = tasks.length, d = TODAY;
  const row = t => {
    const note = PNOTES['0|' + t.id];
    return `<div class="row ${st(t)}${t.id === fresh ? ' fresh' : ''}" style="--c:${(CALS[t.cal] || CALS.code).color}">
      <button class="chk" data-tick="${t.id}" aria-label="${st(t) === 'done' ? 'Untick' : 'Tick'} ${esc(t.title)}" aria-pressed="${st(t) === 'done'}">${CHECK}</button>
      <span class="t">${esc(t.title)}${note && st(t) === 'prog' ? `<i>${esc(note)}</i>` : ''}</span>${t.time ? `<time>${t.time}</time>` : ''}</div>`;
  };
  const keep = $('.rows', W)?.scrollTop || 0;
  W.innerHTML = `
    <div class="copy"><b>Today.</b> <span>Everything due, in one list.</span></div>
    ${DESK ? `<div class="deskbar"><button class="open" data-open>Open Tessera</button><button class="x" data-close aria-label="Close the widget" title="Close"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l6 6M9 3 3 9"/></svg></button></div>
    <div class="grip" data-grip title="Drag to resize" aria-hidden="true"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10.5 4.5l-6 6M10.5 8.5l-2 2"/></svg></div>`
      : '<a class="open" href="./#today" target="_top">Open Tessera</a>'}
    <div class="card">
      <div class="card-head"><strong>${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}</strong><span class="pill">${done.length} of ${n} done</span></div>
      <div class="bar" aria-hidden="true"><i style="width:${n ? done.length / n * 100 : 0}%"></i></div>
      <div class="rows">${[...prog, ...todo].map(row).join('') || '<div class="empty">All clear for today.</div>'}${done.length ? `<div class="sub">Done · ${done.length}</div>${done.map(row).join('')}` : ''}</div>
      <div class="foot">
        <form class="add" autocomplete="off"><input id="add" placeholder="Add a task, e.g. Call home at 7pm" aria-label="New task for today. Add a time like at 7pm"><span class="when" hidden></span><button>Add</button></form>
      </div>
    </div>`;
  const rows = $('.rows', W); rows.scrollTop = keep;
  const fade = () => rows.classList.toggle('more', rows.scrollTop + rows.clientHeight < rows.scrollHeight - 4);
  rows.onscroll = fade; fade();
  bind();
}

function bind() {
  const op = $('[data-open]', W), cl = $('[data-close]', W);
  if (op) op.onclick = () => (desk() ? desk().open_app('today') : open('./#today', '_blank'));
  if (cl) cl.onclick = () => desk()?.close();
  // tick: done, or back to the list; a task with a time fills its hours in Hours
  $$('[data-tick]', W).forEach(b => b.onclick = () => {
    const k = '0|' + b.dataset.tick;
    STATUS[k] = STATUS[k] === 'done' ? 'todo' : 'done';
    STORE.syncHours(0); STORE.save(); draw();
    $(`[data-tick="${b.dataset.tick}"]`, W)?.focus();
  });
  // add: "at 7pm" sets the time; the category is picked the same way as in Today
  const form = $('.add', W), input = $('#add', W), when = $('.when', W);
  input.oninput = () => { const tm = sortTime(input.value.trim()); when.hidden = !tm; when.textContent = tm ? fmtTime(tm.s) : ''; };
  form.onsubmit = e => {
    e.preventDefault();
    const raw = input.value.trim(); if (!raw) return input.focus();
    const tm = sortTime(raw), title = tm ? tm.title : raw;
    const o = { id: 'o' + Date.now(), day: 0, cal: sortTask(title).cal, title };
    if (tm) { o.s = tm.s; o.time = fmtTime(tm.s); }
    ONEOFFS.push(o); fresh = o.id;
    STORE.save(); draw(); $('#add', W).focus();
    clearTimeout(bind.t); bind.t = setTimeout(() => { fresh = null; }, 1200);
  };
}

// ---------- on the desktop: move by any empty part of the card, resize by the corner ----------
// Pointer moves become window moves in screen pixels (CSS pixels × the display scale), sent once a frame.
if (DESK) {
  addEventListener('blur', () => desk()?.sink());
  const NOT_DRAG = 'button, input, a, textarea, select, .chk, [data-grip]';
  const MIN_W = 250, MIN_H = 270, MAX_W = 760, MAX_H = 1100;
  let op = null, frame = 0;
  const send = () => {
    frame = 0; if (!op || !op.next) return;
    const [kind, a, b] = op.next; op.next = null;
    if (kind === 'move') desk()?.move_to(a, b); else desk()?.resize(a, b);
  };
  W.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const grip = e.target.closest('[data-grip]');
    if (!grip && e.target.closest(NOT_DRAG)) return;
    const r = devicePixelRatio || 1;
    op = grip
      ? { kind: 'size', sx: e.screenX, sy: e.screenY, w: innerWidth, h: innerHeight, r }
      : { kind: 'move', ox: e.clientX, oy: e.clientY, sx: e.screenX, sy: e.screenY, r, moved: false };
    try { W.setPointerCapture(e.pointerId); } catch { /* a pointer that's already gone */ }
    if (grip) e.preventDefault();
  });
  W.addEventListener('pointermove', e => {
    if (!op) return;
    if (op.kind === 'move') {
      if (!op.moved && Math.hypot(e.screenX - op.sx, e.screenY - op.sy) < 4) return;
      op.moved = true; document.body.classList.add('moving');
      op.next = ['move', Math.round((e.screenX - op.ox) * op.r), Math.round((e.screenY - op.oy) * op.r)];
    } else {
      const w = Math.max(MIN_W, Math.min(MAX_W, op.w + e.screenX - op.sx)), h = Math.max(MIN_H, Math.min(MAX_H, op.h + e.screenY - op.sy));
      op.next = ['size', Math.round(w * op.r), Math.round(h * op.r)];
    }
    if (!frame) frame = requestAnimationFrame(send);
  });
  const end = () => { if (!op) return; send(); op = null; document.body.classList.remove('moving'); desk()?.settle_down(); };
  W.addEventListener('pointerup', end);
  W.addEventListener('pointercancel', end);
}

// the same saved state as the app; when the app (in another window) changes something, the widget redraws
STORE.restore(() => { if (document.activeElement?.id !== 'add') draw(); });
STORE.sync();
draw();
