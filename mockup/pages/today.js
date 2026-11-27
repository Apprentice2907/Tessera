// Tessera · Today: the day's routines, events and one-off tasks in one list. Drag a task to In progress or Done,
// star it to keep it on top, right-click it to change its category. Finishing a task with a time fills its hours in Hours.
// The New task tile also logs a project update ("KamiLabs · Chartwells: updated the link"), filed under its week in Review.
'use strict';
Object.assign(S, { day: 0, fresh: null, ntStar: false, ntMode: 'task' });

const ST_NAME = { todo: 'To do', prog: 'In progress', done: 'Done' };
const STAR = '<svg viewBox="0 0 16 16"><path d="M8 1.7l1.93 3.92 4.32.63-3.13 3.05.74 4.3L8 11.57l-3.86 2.03.74-4.3L1.75 6.25l4.32-.63z"/></svg>';
const taskSource = id => ROUTINES.find(r => r.id === id) || EVENTS.find(e => e.id === id) || ONEOFFS.find(o => o.id === id);
const starBtn = (id, title, on) => `<button class="star${on ? ' on' : ''}" data-star="${id}" aria-pressed="${on}" aria-label="${on ? 'Unstar' : 'Star'} ${esc(title)}">${STAR}</button>`;

function setStatus(id, st) {
  if (statusOf(S.day, id) === st) return;
  STATUS[S.day + '|' + id] = st;
  const said = S.day === 0 ? STORE.syncHours(0) : [];
  render();
  $(`[data-drop="${st}"]`)?.classList.add('bump');
  toast(`Moved to ${ST_NAME[st]}${said.length ? `. Logged ${said.join(', ')} in Hours` : ''}`);
}
function setCat(id, cal) {
  const src = taskSource(id); if (!src) return;
  src.cal = cal;
  sortTeach(src.short || src.title, cal); render();
  toast(`Filed under ${SORT_NAMES[cal]}. It will remember.`);
}

// ---------- the task menu: change the category, move the task, or delete a one-off ----------
function closeMenu() { $('#tmenu')?.remove(); document.removeEventListener('pointerdown', closeMenu.out, true); }
FLOATS.push(closeMenu);
function openMenu({ x, y, id }) {
  closeFloats();
  const src = taskSource(id), st = statusOf(S.day, id), cur = src?.cal;
  const m = document.createElement('div'); m.className = 'tmenu'; m.id = 'tmenu'; m.dataset.float = ''; m.setAttribute('role', 'menu');
  m.innerHTML = `<small>Category</small>${SORT_ORDER.map(c => `<button role="menuitem" data-cat="${c}" class="${cur === c ? 'on' : ''}" style="--c:${CALS[c].color}"><i></i>${SORT_NAMES[c]}</button>`).join('')}`
    + `<small>Move to</small>${['todo', 'prog', 'done'].map(s => `<button role="menuitem" data-st="${s}" class="${st === s ? 'on' : ''}">${ST_NAME[s]}</button>`).join('')}`
    + (src && ONEOFFS.includes(src) ? '<button role="menuitem" data-del class="del">Delete task</button>' : '');
  document.body.appendChild(m);
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
  m.style.top = (y + 6 + h > innerHeight - 8 ? Math.max(8, y - h - 6) : y + 6) + 'px';
  m.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; closeMenu();
    if (b.dataset.cat) setCat(id, b.dataset.cat);
    else if (b.dataset.st) setStatus(id, b.dataset.st);
    else if (b.hasAttribute('data-del')) { ONEOFFS.splice(ONEOFFS.indexOf(src), 1); render(); toast('Task deleted'); }
  };
  m.onkeydown = e => {
    const bs = $$('button', m), i = bs.indexOf(document.activeElement);
    if (e.key === 'Escape') closeMenu();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); }
  };
  closeMenu.out = e => { if (!m.contains(e.target)) closeMenu(); };
  document.addEventListener('pointerdown', closeMenu.out, true);
  ($('button.on', m) || $('button', m)).focus();
}

// ---------- drag a task (mouse or pen) onto a tile that has data-drop ----------
function dragTasks(root, onDrop) {
  $$('[data-drag]', root).forEach(el => el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.pointerType === 'touch' || e.target.closest('button, input')) return;
    e.preventDefault();
    const id = el.dataset.drag, x0 = e.clientX, y0 = e.clientY, zones = $$('[data-drop]', root);
    let ghost = null, hot = null;
    const move = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        const r = el.getBoundingClientRect();
        ghost = el.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.classList.remove('fresh');
        ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px'; ghost.style.width = r.width + 'px';
        root.firstElementChild.appendChild(ghost);
        el.classList.add('dragging'); document.body.classList.add('is-dragging');
        zones.forEach(z => z.classList.add('drop-ok'));
      }
      ghost.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px) rotate(-1.5deg)`;
      const z = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]') || null;
      if (z !== hot) { hot?.classList.remove('drop-hot'); hot = z; hot?.classList.add('drop-hot'); }
    };
    const end = ev => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); removeEventListener('keydown', key);
      if (!ghost) return;
      ghost.remove(); el.classList.remove('dragging'); document.body.classList.remove('is-dragging');
      zones.forEach(z => z.classList.remove('drop-ok', 'drop-hot'));
      if (ev.type === 'pointerup' && hot) onDrop(id, hot.dataset.drop);
    };
    const key = ev => { if (ev.key === 'Escape') end({ type: 'cancel' }); };
    addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end); addEventListener('keydown', key);
  }));
}

P.today = () => {
  const day = S.day, d = addDays(TODAY, day), tasks = tasksForDay(day);
  const st = t => statusOf(day, t.id), starred = t => !!STARS[day + '|' + t.id];
  const order = (a, b) => (starred(b) - starred(a)) || (startOf(a) - startOf(b)); // starred first, then by time
  const todo = tasks.filter(t => st(t) === 'todo').sort(order);
  const doneL = tasks.filter(t => st(t) === 'done').sort(order);
  const prog = tasks.filter(t => st(t) === 'prog').sort((a, b) => starred(b) - starred(a));
  const tmr = eventsOn(day + 1).slice(0, 4), td = addDays(TODAY, day + 1);
  const evs = eventsOn(day).filter(e => day > 0 || e.s > NOW_H), next = evs[0];
  const label = day === 0 ? 'Today' : day === 1 ? 'Tomorrow' : DAY_LONG[d.getDay()];
  const updating = S.ntMode === 'update';
  const row = t => `<div class="row ${st(t)}${t.id === S.fresh ? ' fresh' : ''}" data-drag="${t.id}" style="--c:${CALS[t.cal].color}"><button class="chk" data-tick="${t.id}" aria-label="Tick ${esc(t.title)}">${CHECK}</button><span class="t">${esc(t.title)}</span>${starBtn(t.id, t.title, starred(t))}${t.time ? `<time>${t.time}</time>` : ''}</div>`;
  const progCard = t => `<div class="pcard prog${t.id === S.fresh ? ' fresh' : ''}" data-drag="${t.id}"><div class="tt" style="--c:${CALS[t.cal].color}"><button class="chk" data-tick="${t.id}" aria-label="Tick ${esc(t.title)}">${CHECK}</button><span>${esc(t.title)}</span>${starBtn(t.id, t.title, starred(t))}${t.time ? `<time>${t.time}</time>` : ''}</div><input data-note="${t.id}" value="${esc(PNOTES[day + '|' + t.id] || '')}" placeholder="Where did you stop?" aria-label="Note for ${esc(t.title)}"></div>`;
  return `<main class="bento p-today">
    <section class="tile g-bands lead drop" style="grid-area:list" data-drop="todo" data-drop-label="Back to the list">
      <div class="copy"><b>${label}.</b> <span>Drag a task to start or finish it.</span></div>
      <div class="card">
        <div class="card-head"><strong>${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}</strong><small class="left">${todo.length ? `${todo.length} to do` : 'all done'}</small>${day === 0 ? '<a class="wlink" href="widget.html" target="_blank" rel="noopener" title="Today’s list as a small widget: keep it open, add it to your home screen, or embed it">Widget</a>' : ''}</div>
        <div class="rows" data-keep="rows${day}">${todo.map(row).join('') || '<div class="empty">All clear. Add a task or drag one back.</div>'}${doneL.length ? `<div class="sub">Done · ${doneL.length}</div>${doneL.map(row).join('')}` : ''}</div>
      </div>
    </section>
    <section class="tile g-lilac tall drop" style="grid-area:prog" data-drop="prog" data-drop-label="Start it">
      <div class="copy"><b>In progress.</b> <span>Where you stopped.</span></div>
      <div class="plist" data-keep="plist${day}">${prog.map(progCard).join('') || '<div class="pcard empty">Drag a task here when you start it.</div>'}</div>
    </section>
    <section class="tile g-orange" style="grid-area:next">
      <div class="copy"><span class="label">Next up</span></div>
      ${next ? `<div class="stat" style="font-size:clamp(40px, 8.5vh, 70px)">${fmtTime(next.s)}</div><div class="aside">${esc(next.short || next.title)}<small>${evs[1] ? 'then ' + esc(evs[1].short || evs[1].title) : 'last one today'}</small></div>` : '<div class="aside">Nothing else today</div>'}
    </section>
    <section class="tile g-green drop" style="grid-area:done" data-drop="done" data-drop-label="Finish it">
      <div class="copy"><b>Done.</b> <span>Out of ${tasks.length} for ${label.toLowerCase()}.</span></div>
      <div class="stat">${doneL.length}<small>/ ${tasks.length}</small></div>
    </section>
    <section class="tile g-paper wide" style="grid-area:week">
      <div class="copy"><b>This week.</b> <span>Pick a day to plan it.</span></div>
      <div class="wk7">${Array.from({ length: 7 }, (_, i) => { const w = addDays(TODAY, i); return `<button class="${i === day ? 'on' : ''}" data-day="${i}" aria-pressed="${i === day}">${DAY_NAMES[w.getDay()]}<b>${w.getDate()}</b><em>${tasksForDay(i).length}</em></button>`; }).join('')}</div>
    </section>
    <section class="tile g-night" style="grid-area:rout">
      <div class="copy"><b>${DAY_LONG[td.getDay()]}.</b> <span>Coming up next.</span></div>
      <div class="rlist">${tmr.map(e => `<div class="rl" style="--c:${CALS[e.cal].color}"><i></i><span>${esc(e.short || e.title)}</span><small>${fmtTime(e.s)}</small></div>`).join('')}</div>
    </section>
    <section class="tile g-yellow nt-tile${updating ? ' updating' : ''}" style="grid-area:new">
      <div class="ntmode" role="tablist" aria-label="Add"><button type="button" role="tab" data-mode="task" aria-selected="${!updating}" class="${updating ? '' : 'on'}">Task</button><button type="button" role="tab" data-mode="update" aria-selected="${updating}" class="${updating ? 'on' : ''}" title="Project update (U)">Update</button></div>
      ${updating ? `<div class="copy"><b>Project update.</b> <span>Filed under its week in Review.</span></div>
      <form class="addf" id="add-update" autocomplete="off">
        <div class="upchips">${STORE.recentBooks(3).map(b => `<button type="button" data-proj="${esc(b.name)}">${esc(b.name)}</button>`).join('')}</div>
        <input id="nt" placeholder="KamiLabs · Chartwells: updated the link" aria-label="Project and what happened, like Lyra: fixed the queue">
        <button class="add" type="submit">Log update</button>
      </form>` : `<div class="copy"><b>New task.</b> <span>For ${label.toLowerCase()}.</span></div>
      <form class="addf" id="add-task" autocomplete="off">
        <div class="nt"><input id="nt" placeholder="e.g. Buy protein at 6pm" aria-label="Task. Add a time like at 6pm"><span class="ntime" id="nt-time" hidden></span><button type="button" class="star nt-star${S.ntStar ? ' on' : ''}" id="nt-star" aria-pressed="${S.ntStar}" aria-label="Star this task">${STAR}</button></div>
        <button class="add" type="submit">Add task</button>
      </form>`}
    </section>
  </main>`;
};

P.today.bind = root => {
  $$('[data-tick]', root).forEach(b => b.onclick = () => {
    const k = S.day + '|' + b.dataset.tick; STATUS[k] = STATUS[k] === 'done' ? 'todo' : 'done';
    const said = S.day === 0 ? STORE.syncHours(0) : [];
    render();
    if (said.length) toast(`Logged ${said.join(', ')} in Hours`);
  });
  $$('[data-star]', root).forEach(b => b.onclick = () => { const k = S.day + '|' + b.dataset.star; STARS[k] = !STARS[k]; S.fresh = STARS[k] ? b.dataset.star : null; render(); });
  $$('[data-day]', root).forEach(b => b.onclick = () => { S.day = +b.dataset.day; render(); });
  $$('[data-note]', root).forEach(i => i.onchange = () => { PNOTES[S.day + '|' + i.dataset.note] = i.value.trim(); });
  $$('[data-drag]', root).forEach(el => el.oncontextmenu = e => { e.preventDefault(); openMenu({ x: e.clientX, y: e.clientY, id: el.dataset.drag }); });
  dragTasks(root, setStatus);

  // the list scrolls (no visible bar); a fade at the bottom says there is more
  const rows = $('.rows', root);
  const fade = () => rows.classList.toggle('more', rows.scrollTop + rows.clientHeight < rows.scrollHeight - 4);
  rows.onscroll = fade; fade();
  // a task just added or starred: scroll it into view
  const fresh = $('.fresh', root);
  if (fresh) {
    const box = fresh.closest('.rows, .plist'), r = fresh.getBoundingClientRect(), c = box.getBoundingClientRect();
    if (r.bottom > c.bottom || r.top < c.top) box.scrollTop += r.top - c.top - (c.height - r.height) / 2;
    S.fresh = null;
  }

  $$('[data-mode]', root).forEach(b => b.onclick = () => { S.ntMode = b.dataset.mode; render(); $('#nt')?.focus(); });
  if ($('#add-update', root)) bindUpdate(root); else bindNewTask(root);
};

// a project update: "Project: what happened" goes into that project's week; a project it doesn't know gets a file
function bindUpdate(root) {
  const inp = $('#nt', root);
  $$('[data-proj]', root).forEach(b => b.onclick = () => { inp.value = `${b.dataset.proj}: `; inp.focus(); });
  $('#add-update', root).onsubmit = e => {
    e.preventDefault();
    const raw = inp.value.trim(); if (!raw) return inp.focus();
    const r = STORE.logUpdate(raw);
    if (!r.ok) { toast(r.msg); return inp.focus(); }
    render(); $('#nt')?.focus();
    toast(r.made ? `New file for ${r.name} in ${r.folder}, update filed` : `Filed under ${r.name}, this week`);
  };
}
// a new task: a time typed into the text ("at 6pm", "18:30") is picked up and shown in the field
function bindNewTask(root) {
  const nt = $('#nt', root), chip = $('#nt-time', root), starB = $('#nt-star', root);
  nt.oninput = () => {
    const tm = sortTime(nt.value.trim());
    chip.hidden = !tm; chip.textContent = tm ? fmtTime(tm.s) : '';
    nt.parentNode.classList.toggle('has-time', !!tm);
  };
  starB.onclick = () => { S.ntStar = !S.ntStar; starB.classList.toggle('on', S.ntStar); starB.setAttribute('aria-pressed', S.ntStar); nt.focus(); };
  $('#add-task', root).onsubmit = e => {
    e.preventDefault();
    const raw = nt.value.trim(); if (!raw) return nt.focus();
    const tm = sortTime(raw), title = tm ? tm.title : raw;
    const o = { id: 'o' + Date.now(), day: S.day, cal: sortTask(title).cal, title };
    if (tm) { o.s = tm.s; o.time = fmtTime(tm.s); }
    ONEOFFS.push(o);
    if (S.ntStar) STARS[S.day + '|' + o.id] = true;
    const msg = (S.ntStar ? 'Starred and added' : 'Added') + (o.time ? ` for ${o.time}` : '');
    S.ntStar = false; S.fresh = o.id;
    render(); toast(msg);
  };
}

// U, from any page: log a project update
SHORTCUTS.u = () => {
  S.ntMode = 'update'; S.day = 0;
  if (current() !== 'today') location.hash = 'today'; else render();
  setTimeout(() => $('#nt')?.focus(), 80);
};
