// Tessera · the to-do widget: today's list on its own page. It reads and saves the same store as the app,
// so ticking something here ticks it in Today (and fills its hours in Hours), and the other way round.
//   widget.html        a small page: keep it open, add it to a phone's home screen, or embed it
//   widget.html?bare   no page background, for embedding
//   widget.html?desk   the desktop widget: drag any empty part to move it, the corner to resize it. In the desktop app it's the
//                      app's second window (src-tauri); the older Python widget (mockup/desktop/widget.pyw) opens it with ?desk
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useData, update } from './store/data';
import { save, restore } from './store/persist';
import { keepHoursInStep, syncHours } from './store/rules';
import { tickClock, useClock } from './store/clock';
import { startContests } from './store/contests';
import { inApp, openLinksOutside } from './store/backend';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { calColor, startOf, statusOf, tasksForDay } from './lib/data';
import { DAY_NAMES, MONTHS, fmtTime } from './lib/dates';
import { sortTask, sortTime } from './lib/sort';
import type { Task } from './lib/types';
import { EASE } from './ui/motion';
import { Check } from './ui/icons';
import './styles/app.css';
import './styles/widget.css';
import './styles/motion.css';

const Q = new URLSearchParams(location.search), APPWIDGET = inApp && getCurrentWindow().label === 'widget', DESK = Q.has('desk') || APPWIDGET;
document.body.classList.toggle('bare', Q.has('bare') || DESK);
document.body.classList.toggle('desk', DESK);
// the older Python widget: its side moves, resizes and closes the window, opens the app,
// and tucks the widget back behind other windows when you click away
interface DeskApi { open_app(page: string): void; close(): void; sink(): void; move_to(x: number, y: number): void; resize(w: number, h: number): void; settle_down(): void }
const py = () => (window as unknown as { pywebview?: { api?: DeskApi } }).pywebview?.api;
// in the desktop app, the window sits behind the others by itself, and the system moves and resizes it
const desk = {
  open: () => (APPWIDGET ? invoke('open_main', { page: 'today' }) : py()?.open_app('today')),
  close: () => (APPWIDGET ? invoke('set_widget', { on: false }) : py()?.close()),
};

const slide = { layout: true, initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: { duration: 0.15 } }, transition: { duration: 0.3, ease: EASE } } as const;

function Widget() {
  const d = useData(s => s.d), { T, today } = useClock();
  const [value, setValue] = useState(''), [fresh, setFresh] = useState<string | null>(null), [more, setMore] = useState(false);
  const input = useRef<HTMLInputElement>(null), rows = useRef<HTMLDivElement>(null), card = useRef<HTMLElement>(null);
  const tasks = tasksForDay(d, T), st = (t: Task) => statusOf(d, T, t.id), starred = (t: Task) => !!d.stars[T + '|' + t.id];
  const order = (a: Task, b: Task) => (+starred(b) - +starred(a)) || (startOf(a) - startOf(b));
  const prog = tasks.filter(t => st(t) === 'prog').sort(order), todo = tasks.filter(t => st(t) === 'todo').sort(order), done = tasks.filter(t => st(t) === 'done').sort(order);
  const n = tasks.length, tm = sortTime(value.trim());
  const fade = () => { const r = rows.current; if (r) setMore(r.scrollTop + r.clientHeight < r.scrollHeight - 4); };
  useLayoutEffect(fade);
  useEffect(() => { if (!fresh) return; const t = setTimeout(() => setFresh(null), 1200); return () => clearTimeout(t); }, [fresh]);
  useDeskDrag(card);

  // tick: done, or back to the list; a task with a time fills its hours in Hours
  const tick = (id: string) => { update(dr => { const k = T + '|' + id; dr.status[k] = dr.status[k] === 'done' ? 'todo' : 'done'; syncHours(dr, T); }); save(); };
  // add: "at 7pm" sets the time; the category is picked the same way as in Today
  const add = (e: FormEvent) => {
    e.preventDefault();
    const raw = value.trim(); if (!raw) return input.current?.focus();
    const t = sortTime(raw), title = t ? t.title : raw;
    const o = { id: 'o' + Date.now(), day: T, cal: sortTask(d, title).cal, title, ...(t ? { s: t.s, time: fmtTime(t.s) } : {}) };
    update(dr => { dr.oneoffs.push(o); }); save();
    setFresh(o.id); setValue(''); input.current?.focus();
  };
  const row = (t: Task) => {
    const note = d.notes[T + '|' + t.id];
    return (
      <motion.div key={t.id} {...slide} className={`row ${st(t)}${t.id === fresh ? ' fresh' : ''}`} style={{ ['--c' as string]: calColor(t.cal) }}>
        <button className="chk" aria-label={`${st(t) === 'done' ? 'Untick' : 'Tick'} ${t.title}`} aria-pressed={st(t) === 'done'} onClick={() => tick(t.id)}><Check /></button>
        <span className="t">{t.title}{note && st(t) === 'prog' && <i>{note}</i>}</span>{t.time && <time>{t.time}</time>}
      </motion.div>
    );
  };
  const list = [...prog, ...todo].map(row);
  if (!list.length) list.push(<div key="empty" className="empty">{n ? 'All clear for today.' : 'Nothing planned. Add a task below.'}</div>);
  if (done.length) list.push(<motion.div key="sub" layout="position" className="sub">Done · {done.length}</motion.div>, ...done.map(row));
  return (
    <main className="tile g-bands w" id="w" aria-label="Today's to-do list" ref={card}>
      <div className="copy"><b>Today.</b> <span>Everything due, in one list.</span></div>
      {DESK ? <>
        <div className="deskbar">
          <button className="open" onClick={() => desk.open()}>Open Tessera</button>
          <button className="x" aria-label="Close the widget" title="Close" onClick={() => desk.close()}><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l6 6M9 3 3 9" /></svg></button>
        </div>
        <div className="grip" data-grip title="Drag to resize" aria-hidden="true"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M10.5 4.5l-6 6M10.5 8.5l-2 2" /></svg></div>
      </> : <a className="open" href="./#/today" target="_top">Open Tessera</a>}
      <div className="card">
        <div className="card-head"><strong>{DAY_NAMES[today.getDay()]} {today.getDate()} {MONTHS[today.getMonth()]}</strong>{n > 0 && <span className="pill">{done.length} of {n} done</span>}</div>
        <div className="bar" aria-hidden="true"><i style={{ width: `${n ? done.length / n * 100 : 0}%` }} /></div>
        <motion.div layoutScroll className={'rows' + (more ? ' more' : '')} ref={rows} onScroll={fade}>
          <AnimatePresence initial={false} mode="popLayout">{list}</AnimatePresence>
        </motion.div>
        <div className="foot">
          <form className="add" autoComplete="off" onSubmit={add}>
            <input id="add" ref={input} value={value} onChange={e => setValue(e.target.value)} placeholder="Add a task, e.g. Call home at 7pm" aria-label="New task for today. Add a time like at 7pm" />
            <span className="when" hidden={!tm}>{tm ? fmtTime(tm.s) : ''}</span><button>Add</button>
          </form>
        </div>
      </div>
    </main>
  );
}

// ---------- on the desktop: move by any empty part of the card, resize by the corner ----------
// Pointer moves become window moves in screen pixels (CSS pixels × the display scale), sent once a frame.
function useDeskDrag(card: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const W = card.current; if (!DESK || !W) return;
    const NOT_DRAG = 'button, input, a, textarea, select, .chk, [data-grip]';
    if (APPWIDGET) {
      const win = getCurrentWindow();
      const down = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const t = e.target as Element;
        if (t.closest('[data-grip]')) { e.preventDefault(); win.startResizeDragging('SouthEast'); }
        else if (!t.closest(NOT_DRAG)) win.startDragging();
      };
      W.addEventListener('pointerdown', down);
      return () => W.removeEventListener('pointerdown', down);
    }
    const blur = () => py()?.sink();
    addEventListener('blur', blur);
    const MIN_W = 250, MIN_H = 270, MAX_W = 760, MAX_H = 1100;
    type Op = { kind: 'size'; sx: number; sy: number; w: number; h: number; r: number; next?: [string, number, number] | null } | { kind: 'move'; ox: number; oy: number; sx: number; sy: number; r: number; moved: boolean; next?: [string, number, number] | null };
    let op: Op | null = null, frame = 0;
    const send = () => {
      frame = 0; if (!op || !op.next) return;
      const [kind, a, b] = op.next; op.next = null;
      if (kind === 'move') py()?.move_to(a, b); else py()?.resize(a, b);
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const grip = (e.target as Element).closest('[data-grip]');
      if (!grip && (e.target as Element).closest(NOT_DRAG)) return;
      const r = devicePixelRatio || 1;
      op = grip ? { kind: 'size', sx: e.screenX, sy: e.screenY, w: innerWidth, h: innerHeight, r } : { kind: 'move', ox: e.clientX, oy: e.clientY, sx: e.screenX, sy: e.screenY, r, moved: false };
      try { W.setPointerCapture(e.pointerId); } catch { /* a pointer that's already gone */ }
      if (grip) e.preventDefault();
    };
    const move = (e: PointerEvent) => {
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
    };
    const end = () => { if (!op) return; send(); op = null; document.body.classList.remove('moving'); py()?.settle_down(); };
    W.addEventListener('pointerdown', down); W.addEventListener('pointermove', move); W.addEventListener('pointerup', end); W.addEventListener('pointercancel', end);
    return () => { removeEventListener('blur', blur); W.removeEventListener('pointerdown', down); W.removeEventListener('pointermove', move); W.removeEventListener('pointerup', end); W.removeEventListener('pointercancel', end); };
  }, [card]);
}

// the same saved state as the app; when the app (in another window) changes something, the widget redraws.
// The desktop widget stays open for days: at midnight it turns to the new day.
openLinksOutside();
restore().then(startContests);
const sync = keepHoursInStep();
setInterval(() => { if (tickClock()) sync(); }, 30000);
createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion="user"><Widget /></MotionConfig>);
