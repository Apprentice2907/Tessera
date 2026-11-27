// Tessera · Today: the day's routines, events and one-off tasks in one list. Drag a task to In progress or Done,
// star it to keep it on top, right-click it to change its category. Finishing a task with a time fills its hours in Hours.
// The New task tile also logs a project update ("Portfolio: new hero section"), filed under today in its project file in Review.
// Ticking or dragging a task moves it with a layout animation: it slides to its new place instead of jumping.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useData, update } from '../store/data';
import { useClock } from '../store/clock';
import { setUI, toast, ui, useUI, reducedMotion } from '../store/ui';
import { logUpdate, recentProjects, syncHours } from '../store/rules';
import { inApp } from '../store/backend';
import { invoke } from '@tauri-apps/api/core';
import { CALS, calColor, eventsOn, startOf, statusOf, tasksForDay } from '../lib/data';
import { DAY_LONG, DAY_NAMES, MONTHS, dateOf, fmtTime } from '../lib/dates';
import { SORT_NAMES, SORT_ORDER, sortTask, sortTeach, sortTime } from '../lib/sort';
import type { CalId, Saved, Status, Task } from '../lib/types';
import { Bento, Copy, Tile, EASE } from '../ui/motion';
import { CountUp } from '../ui/CountUp';
import { Check, Star } from '../ui/icons';

const ST_NAME: Record<Status, string> = { todo: 'To do', prog: 'In progress', done: 'Done' };
const taskSource = (d: Saved, id: string) => d.routines.find(r => r.id === id) || d.events.find(e => e.id === id) || d.oneoffs.find(o => o.id === id);

/** a tile that a task just landed on gives a small bump */
export function bump(el: Element | null | undefined) {
  if (!el || reducedMotion()) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.02)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.25,.8,.25,1)' });
}

// ---------- the status rules, for the day shown ----------
function setStatus(day: number, id: string, st: Status) {
  if (statusOf(useData.getState().d, day, id) === st) return;
  const said = update(d => { d.status[day + '|' + id] = st; return syncHours(d, day); });
  bump(document.querySelector(`[data-drop="${st}"]`));
  toast(`Moved to ${ST_NAME[st]}${said.length ? `. Logged ${said.join(', ')} in Hours` : ''}`);
}
function tickTask(day: number, id: string) {
  const said = update(d => { const k = day + '|' + id; d.status[k] = d.status[k] === 'done' ? 'todo' : 'done'; return syncHours(d, day); });
  if (said.length) toast(`Logged ${said.join(', ')} in Hours`);
}
function setCat(id: string, cal: CalId) {
  update(d => { const src = taskSource(d as Saved, id); if (!src) return; src.cal = cal; sortTeach(d.sort, ('short' in src && src.short) || src.title, cal); });
  toast(`Filed under ${SORT_NAMES[cal]}. It will remember.`);
}

// ---------- the task menu (right-click): change the category, move the task, or delete a one-off ----------
function TaskMenu({ x, y, id, day, close }: { x: number; y: number; id: string; day: number; close: () => void }) {
  const d = useData(s => s.d), ref = useRef<HTMLDivElement>(null);
  const src = taskSource(d, id), st = statusOf(d, day, id), cur = src?.cal, oneoff = !!d.oneoffs.find(o => o.id === id);
  useLayoutEffect(() => {
    const m = ref.current!; const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
    m.style.top = (y + 6 + h > innerHeight - 8 ? Math.max(8, y - h - 6) : y + 6) + 'px';
    (m.querySelector<HTMLElement>('button.on') || m.querySelector('button'))?.focus();
    const out = (e: PointerEvent) => { if (!m.contains(e.target as Node)) close(); };
    document.addEventListener('pointerdown', out, true);
    return () => document.removeEventListener('pointerdown', out, true);
  }, [x, y, close]);
  const keys = (e: React.KeyboardEvent) => {
    const bs = [...ref.current!.querySelectorAll('button')], i = bs.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); }
  };
  const run = (fn: () => void) => () => { close(); fn(); };
  return createPortal(
    <motion.div className="tmenu" id="tmenu" data-float="" role="menu" ref={ref} onKeyDown={keys}
      initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.16, ease: EASE }}>
      <small>Category</small>
      {SORT_ORDER.map(c => <button key={c} role="menuitem" className={cur === c ? 'on' : ''} style={{ ['--c' as string]: CALS[c].color }} onClick={run(() => setCat(id, c))}><i />{SORT_NAMES[c]}</button>)}
      <small>Move to</small>
      {(['todo', 'prog', 'done'] as Status[]).map(s => <button key={s} role="menuitem" className={st === s ? 'on' : ''} onClick={run(() => setStatus(day, id, s))}>{ST_NAME[s]}</button>)}
      {oneoff && <button role="menuitem" className="del" onClick={run(() => { update(dr => { dr.oneoffs = dr.oneoffs.filter(o => o.id !== id); }); toast('Task deleted'); })}>Delete task</button>}
    </motion.div>, document.body);
}

// ---------- drag a task (mouse or pen) onto a tile that has data-drop ----------
function useDragTasks(root: React.RefObject<HTMLElement | null>, onDrop: (id: string, st: Status) => void) {
  const drop = useRef(onDrop); drop.current = onDrop;
  useEffect(() => {
    const host = root.current; if (!host) return;
    const down = (e: PointerEvent) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-drag]');
      if (!el || e.button !== 0 || e.pointerType === 'touch' || (e.target as Element).closest('button, input')) return;
      e.preventDefault();
      const id = el.dataset.drag!, x0 = e.clientX, y0 = e.clientY, zones = [...host.querySelectorAll<HTMLElement>('[data-drop]')];
      let ghost: HTMLElement | null = null, hot: HTMLElement | null = null;
      const move = (ev: PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
          const r = el.getBoundingClientRect();
          ghost = el.cloneNode(true) as HTMLElement; ghost.classList.add('drag-ghost'); ghost.classList.remove('fresh');
          Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', transform: '' });
          document.body.appendChild(ghost);
          el.classList.add('dragging'); document.body.classList.add('is-dragging');
          zones.forEach(z => z.classList.add('drop-ok'));
        }
        ghost.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px) rotate(-1.5deg)`;
        const z = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-drop]') || null;
        if (z !== hot) { hot?.classList.remove('drop-hot'); hot = z; hot?.classList.add('drop-hot'); }
      };
      const end = (ev: { type: string }) => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); removeEventListener('keydown', key);
        if (!ghost) return;
        ghost.remove(); el.classList.remove('dragging'); document.body.classList.remove('is-dragging');
        zones.forEach(z => z.classList.remove('drop-ok', 'drop-hot'));
        if (ev.type === 'pointerup' && hot) drop.current(id, hot.dataset.drop as Status);
      };
      const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') end({ type: 'cancel' }); };
      addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end); addEventListener('keydown', key);
    };
    host.addEventListener('pointerdown', down);
    return () => host.removeEventListener('pointerdown', down);
  }, [root]);
}

// a list item that slides to its new place when the list changes, and eases in or out when it arrives or leaves
const slide = { layout: true, initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.96, transition: { duration: 0.18 } }, transition: { duration: 0.32, ease: EASE } } as const;

function StarBtn({ id, title, on, day }: { id: string; title: string; on: boolean; day: number }) {
  return (
    <button className={'star' + (on ? ' on' : '')} aria-pressed={on} aria-label={`${on ? 'Unstar' : 'Star'} ${title}`}
      onClick={() => { const k = day + '|' + id, next = !useData.getState().d.stars[k]; update(d => { d.stars[k] = next; }); setUI({ fresh: next ? id : null }); }}>
      <Star />
    </button>
  );
}

export function Today() {
  const d = useData(s => s.d), { T, nowH } = useClock(), { day: off, fresh, ntMode } = useUI();
  const root = useRef<HTMLElement>(null), rows = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [more, setMore] = useState(false);
  const day = T + off, date = dateOf(day), tasks = tasksForDay(d, day);
  const st = (t: Task) => statusOf(d, day, t.id), starred = (t: Task) => !!d.stars[day + '|' + t.id];
  const order = (a: Task, b: Task) => (+starred(b) - +starred(a)) || (startOf(a) - startOf(b)); // starred first, then by time
  const todo = tasks.filter(t => st(t) === 'todo').sort(order);
  const doneL = tasks.filter(t => st(t) === 'done').sort(order);
  const prog = tasks.filter(t => st(t) === 'prog').sort((a, b) => +starred(b) - +starred(a));
  const tmr = tasksForDay(d, day + 1).sort((a, b) => startOf(a) - startOf(b)).slice(0, 4), td = dateOf(day + 1);
  const evs = eventsOn(d, day).filter(e => off > 0 || e.s > nowH), next = evs[0];
  const label = off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : DAY_LONG[date.getDay()];

  useDragTasks(root, (id, s) => setStatus(T + ui().day, id, s));
  const ctx = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, id }); };

  // the list scrolls (no visible bar); a fade at the bottom says there is more
  const fade = () => { const r = rows.current; if (r) setMore(r.scrollTop + r.clientHeight < r.scrollHeight - 4); };
  useLayoutEffect(fade);
  // a task just added or starred: scroll it into view, and let its highlight run out before forgetting it
  useLayoutEffect(() => {
    if (!fresh) return;
    const el = root.current?.querySelector<HTMLElement>('.fresh'), box = el?.closest<HTMLElement>('.rows, .plist');
    if (el && box) { const r = el.getBoundingClientRect(), c = box.getBoundingClientRect(); if (r.bottom > c.bottom || r.top < c.top) box.scrollTop += r.top - c.top - (c.height - r.height) / 2; }
    const t = setTimeout(() => setUI({ fresh: null }), 1800);
    return () => clearTimeout(t);
  }, [fresh]);

  const row = (t: Task) => (
    <motion.div key={t.id} {...slide} className={`row ${st(t)}${t.id === fresh ? ' fresh' : ''}`} data-drag={t.id} style={{ ['--c' as string]: calColor(t.cal) }} onContextMenu={ctx(t.id)}>
      <button className="chk" aria-label={`Tick ${t.title}`} onClick={() => tickTask(day, t.id)}><Check /></button>
      <span className="t">{t.title}</span>
      <StarBtn id={t.id} title={t.title} on={starred(t)} day={day} />
      {t.time && <time>{t.time}</time>}
    </motion.div>
  );
  const progCard = (t: Task) => (
    <motion.div key={t.id} {...slide} className={`pcard prog${t.id === fresh ? ' fresh' : ''}`} data-drag={t.id} onContextMenu={ctx(t.id)}>
      <div className="tt" style={{ ['--c' as string]: calColor(t.cal) }}>
        <button className="chk" aria-label={`Tick ${t.title}`} onClick={() => tickTask(day, t.id)}><Check /></button>
        <span>{t.title}</span>
        <StarBtn id={t.id} title={t.title} on={starred(t)} day={day} />
        {t.time && <time>{t.time}</time>}
      </div>
      <input key={day + '|' + t.id} defaultValue={d.notes[day + '|' + t.id] || ''} placeholder="Where did you stop?" aria-label={`Note for ${t.title}`}
        onBlur={e => { const v = e.target.value.trim(), k = day + '|' + t.id; if ((d.notes[k] || '') !== v) update(dr => { dr.notes[k] = v; }); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </motion.div>
  );

  let listBody: ReactNode[] = todo.map(row);
  if (!todo.length) listBody = [<div key="empty" className="empty">{tasks.length ? 'All clear. Add a task or drag one back.' : 'Nothing planned. Add a task below, or plan your week in the Calendar.'}</div>];
  if (doneL.length) listBody.push(<motion.div key="sub" layout="position" className="sub">Done · {doneL.length}</motion.div>, ...doneL.map(row));

  return (
    <Bento className="p-today" ref={root}>
      <Tile area="list" g="g-bands" className="lead drop" data-drop="todo" data-drop-label="Back to the list">
        <Copy b={`${label}.`} s="Drag a task to start or finish it." />
        <div className="card">
          <div className="card-head">
            <strong>{DAY_NAMES[date.getDay()]} {date.getDate()} {MONTHS[date.getMonth()]}</strong>
            <small className="left">{todo.length ? `${todo.length} to do` : 'all done'}</small>
            {off === 0 && (inApp
              ? <button className="wlink" title="Today’s list on your desktop, behind your windows" onClick={() => { invoke('set_widget', { on: true }); toast('The widget is on your desktop'); }}>Widget</button>
              : <a className="wlink" href="widget.html" target="_blank" rel="noopener" title="Today’s list as a small widget: keep it open, add it to your home screen, or embed it">Widget</a>)}
          </div>
          <motion.div layoutScroll className={'rows' + (more ? ' more' : '')} ref={rows} onScroll={fade}>
            <AnimatePresence initial={false} mode="popLayout">{listBody}</AnimatePresence>
          </motion.div>
        </div>
      </Tile>
      <Tile area="prog" g="g-lilac" className="tall drop" data-drop="prog" data-drop-label="Start it">
        <Copy b="In progress." s="Where you stopped." />
        <motion.div layoutScroll className="plist">
          <AnimatePresence initial={false} mode="popLayout">
            {prog.length ? prog.map(progCard) : <motion.div key="empty" {...slide} className="pcard empty">Drag a task here when you start it.</motion.div>}
          </AnimatePresence>
        </motion.div>
      </Tile>
      <Tile area="next" g="g-orange">
        <div className="copy"><span className="label">Next up</span></div>
        {next ? <>
          <div className="stat" style={{ fontSize: 'clamp(40px, 8.5vh, 70px)' }}>{fmtTime(next.s)}</div>
          <div className="aside next-what">{next.short || next.title}<small>{evs[1] ? 'then ' + (evs[1].short || evs[1].title) : 'last one today'}</small></div>
        </> : <div className="aside">Nothing else today</div>}
      </Tile>
      <Tile area="done" g="g-green" className="drop" data-drop="done" data-drop-label="Finish it">
        <Copy b="Done." s={`Out of ${tasks.length} for ${label.toLowerCase()}.`} />
        <div className="stat"><CountUp to={doneL.length} /><small>/ {tasks.length}</small></div>
      </Tile>
      <Tile area="week" g="g-paper" className="wide">
        <Copy b="This week." s="Pick a day to plan it." />
        <div className="wk7">
          {Array.from({ length: 7 }, (_, i) => {
            const w = dateOf(T + i), n = tasksForDay(d, T + i).length;
            return (
              <button key={i} className={i === off ? 'on' : ''} aria-pressed={i === off} onClick={() => setUI({ day: i })}>
                {i === off && <motion.span className="wk7-on" layoutId="wk7-on" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                <span className="wk7-in">{DAY_NAMES[w.getDay()]}<b>{w.getDate()}</b></span>{n ? <em>{n}</em> : null}
              </button>
            );
          })}
        </div>
      </Tile>
      <Tile area="rout" g="g-night">
        <Copy b={`${DAY_LONG[td.getDay()]}.`} s={tmr.length ? 'Coming up next.' : 'Nothing planned yet.'} />
        <div className="rlist">{tmr.map(t => <div key={t.id} className="rl" style={{ ['--c' as string]: calColor(t.cal) }}><i /><span>{t.title}</span>{t.time && <small>{t.time}</small>}</div>)}</div>
      </Tile>
      <NewTile label={label} day={day} updating={ntMode === 'update'} />
      {menu && <TaskMenu {...menu} day={day} close={closeMenu} />}
    </Bento>
  );
}

// ---------- New task / Project update ----------
function NewTile({ label, day, updating }: { label: string; day: number; updating: boolean }) {
  const d = useData(s => s.d), ntStar = useUI(s => s.ntStar);
  const [value, setValue] = useState(''), input = useRef<HTMLInputElement>(null);
  const tm = !updating ? sortTime(value.trim()) : null;
  const mode = (m: 'task' | 'update') => { setUI({ ntMode: m }); setValue(''); setTimeout(() => input.current?.focus()); };
  const addTask = (e: FormEvent) => {
    e.preventDefault();
    const raw = value.trim(); if (!raw) return input.current?.focus();
    const t = sortTime(raw), title = t ? t.title : raw;
    const o = { id: 'o' + Date.now(), day, cal: sortTask(d, title).cal, title, ...(t ? { s: t.s, time: fmtTime(t.s) } : {}) };
    update(dr => { dr.oneoffs.push(o); if (ntStar) dr.stars[day + '|' + o.id] = true; });
    toast((ntStar ? 'Starred and added' : 'Added') + (o.time ? ` for ${o.time}` : ''));
    setUI({ ntStar: false, fresh: o.id }); setValue('');
  };
  // a project update: "Project: what happened" goes into that project's week; a project it doesn't know gets a file
  const addUpdate = (e: FormEvent) => {
    e.preventDefault();
    const raw = value.trim(); if (!raw) return input.current?.focus();
    const r = update(dr => logUpdate(dr, raw));
    if (!r.ok) { toast(r.msg); return input.current?.focus(); }
    setValue(''); input.current?.focus();
    toast(r.made ? `New project file for ${r.name} in ${r.folder}, update filed` : `Filed under ${r.name}, today`);
  };
  return (
    <Tile area="new" g="g-yellow" className={'nt-tile' + (updating ? ' updating' : '')}>
      <div className="ntmode" role="tablist" aria-label="Add">
        <button type="button" role="tab" aria-selected={!updating} className={updating ? '' : 'on'} onClick={() => mode('task')}>Task</button>
        <button type="button" role="tab" aria-selected={updating} className={updating ? 'on' : ''} title="Project update (U)" onClick={() => mode('update')}>Update</button>
      </div>
      {updating ? <>
        <Copy b="Project update." s="Filed in its project in Review." />
        <form className="addf" id="add-update" autoComplete="off" onSubmit={addUpdate}>
          <div className="upchips">{recentProjects(d, 3).map(p => <button type="button" key={p.id} onClick={() => { setValue(`${p.name}: `); input.current?.focus(); }}>{p.name}</button>)}</div>
          <input id="nt" ref={input} value={value} onChange={e => setValue(e.target.value)} placeholder="Project: what happened, e.g. Portfolio: new hero" aria-label="Project and what happened, like Portfolio: new hero" />
          <button className="add" type="submit">Log update</button>
        </form>
      </> : <>
        <Copy b="New task." s={`For ${label.toLowerCase()}.`} />
        <form className="addf" id="add-task" autoComplete="off" onSubmit={addTask}>
          <div className={'nt' + (tm ? ' has-time' : '')}>
            <input id="nt" ref={input} value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. Buy protein at 6pm" aria-label="Task. Add a time like at 6pm" />
            <AnimatePresence>{tm && <motion.span key="t" className="ntime" initial={{ opacity: 0, scale: 0.85, y: '-50%' }} animate={{ opacity: 1, scale: 1, y: '-50%' }} exit={{ opacity: 0, scale: 0.85, y: '-50%' }} transition={{ duration: 0.16 }}>{fmtTime(tm.s)}</motion.span>}</AnimatePresence>
            <button type="button" className={'star nt-star' + (ntStar ? ' on' : '')} aria-pressed={ntStar} aria-label="Star this task" onClick={() => { setUI({ ntStar: !ntStar }); input.current?.focus(); }}><Star /></button>
          </div>
          <button className="add" type="submit">Add task</button>
        </form>
      </>}
    </Tile>
  );
}
