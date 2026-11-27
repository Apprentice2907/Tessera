// Tessera · Home: one tile per section, each showing where it stands today. Every tile opens its section.
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { motion } from 'motion/react';
import { useData } from '../store/data';
import { monthSoFar, useClock } from '../store/clock';
import { reducedMotion } from '../store/ui';
import { calColor, doneOn, eventsOn, hoursOn, startOf, statusOf, streak, tasksForDay } from '../lib/data';
import { DAY_NAMES, MONTHS, fmtTime, inHM, plural, shortDate } from '../lib/dates';
import type { Saved, Task } from '../lib/types';
import { Bento, Copy, LinkTile } from '../ui/motion';
import { CountUp } from '../ui/CountUp';
import { Strip, Ticks } from '../ui/Strip';
import { Check } from '../ui/icons';
import { openDataCard } from '../ui/DataCard';
import { useWallSummary } from './wall/store';

// what the Ideas board holds (the board saves itself in this browser); null until it has been opened once
function ideasNow() {
  try {
    const b = JSON.parse(localStorage.getItem('tessera.wb.b.ideas') || 'null');
    if (b && b.objs) {
      const notes = Object.values(b.objs as Record<string, { type: string; text?: string }>).filter(o => o.type === 'note');
      return { n: notes.length, first: notes.find(o => (o.text || '').trim())?.text || '' };
    }
  } catch { /* nothing saved yet */ }
  return null;
}

// this month, a square a day lit by how many tasks you finished; rows start on Monday, days to come are outlines.
// The squares light up in order when Home opens.
function Month({ d, T, today }: { d: Saved; T: number; today: Date }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || reducedMotion()) return;
    const ctx = gsap.context(() => { gsap.from('i:not(.x)', { scale: 0.4, opacity: 0, duration: 0.35, ease: 'back.out(2)', stagger: 0.014, delay: 0.3, clearProps: 'transform,opacity' }); }, ref);
    return () => ctx.revert();
  }, []);
  const days = monthSoFar(T, today), first = days[0], last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < ((first % 7) + 7) % 7; i++) cells.push(<i key={'x' + i} className="x" />);
  for (let i = 0; i < last; i++) {
    const D = first + i, n = D <= T ? doneOn(d, D) : -1;
    cells.push(n < 0 ? <i key={D} className="f" /> : <i key={D} className={n ? 'l' + Math.min(4, n) : ''} title={`${shortDate(D)}: ${plural(n, 'task')} done`} />);
  }
  return <div className="gh" ref={ref}>{cells}</div>;
}

// the Memory wall tile: a pin on each print's top centre, red rope between them in order
function WallTile() {
  const { memories, walls, recent } = useWallSummary(), tile = useRef<HTMLAnchorElement>(null);
  const at: [React.CSSProperties, number][] = [
    [{ width: '46%', right: '-8%', bottom: '-10%', ['--r' as string]: '5deg' }, 2],
    [{ width: '58%', left: '14%', top: '30%', ['--r' as string]: '-4deg', zIndex: 2 }, 1],
  ];
  useLayoutEffect(() => {
    const el = tile.current; if (!el) return;
    const place = () => {
      const pics = [...el.querySelectorAll<HTMLElement>('.ix')].sort((a, b) => +a.dataset.seq! - +b.dataset.seq!);
      const pts = pics.map(p => [p.offsetLeft + p.offsetWidth / 2, p.offsetTop + 15]);
      el.querySelectorAll('.pin').forEach(p => p.remove());
      pts.forEach(([x, y]) => { const p = document.createElement('span'); p.className = 'pin'; p.style.left = x + 'px'; p.style.top = y + 'px'; el.appendChild(p); });
      const dd = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
      el.querySelector('.rope')!.innerHTML = pts.length > 1 ? `<path d="${dd}" stroke="#9E0C17" stroke-width="5" stroke-linejoin="round"/><path d="${dd}" stroke="#DC1F2B" stroke-width="3.6" stroke-dasharray="3.2 2.2" stroke-linecap="butt" stroke-linejoin="round"/>` : '';
    };
    place();
    const ro = new ResizeObserver(place); ro.observe(el);
    return () => { ro.disconnect(); el.querySelectorAll('.pin').forEach(p => p.remove()); };
  }, [recent.length]);
  return (
    <LinkTile href="#/wall" area="wall" g="g-kraft" className="tall" data-rope="" ref={tile as never}>
      <Copy b="Memory wall." s={memories ? `${plural(memories, 'memory', 'memories')} on ${plural(walls, 'wall')}.` : 'A wall for a trip, a festival, a season.'} />
      {recent.length
        ? recent.map((m, i) => <div key={i} className="ix" data-seq={at[i][1]} style={at[i][0]}><div className="ph" style={{ backgroundImage: `url("${m.src}")` }} /><div className="d">{m.date || m.title || ''}</div></div>)
        : <div className="ix blank" data-seq="1" style={at[1][0]}><div className="ph" /><div className="d">your first memory</div></div>}
      <svg className="rope" />
    </LinkTile>
  );
}

export function Home() {
  const d = useData(s => s.d), { T, today, nowH } = useClock();
  const cells = hoursOn(d, T), logged = cells.filter(Boolean).length;
  const tasks = tasksForDay(d, T), stOf = (t: Task) => statusOf(d, T, t.id), done = tasks.filter(t => stOf(t) === 'done').length;
  const rank = (t: Task) => ({ done: 2, prog: 0, todo: 1 })[stOf(t)];
  const list = [...tasks].sort((a, b) => rank(a) - rank(b) || startOf(a) - startOf(b)).slice(0, 6);
  const evs = eventsOn(d, T).filter(e => e.s > nowH), next = evs[0];
  const run = streak(D => doneOn(d, D) > 0, T), month = monthSoFar(T, today), active = month.filter(D => doneOn(d, D) > 0).length;
  const doneMonth = month.reduce((n, D) => n + doneOn(d, D), 0);
  const idea = ideasNow();
  return (
    <Bento className="p-home">
      <LinkTile href="#/today" area="today" g="g-bands" className="lead">
        <Copy b="Today." s="Everything due, in one list." />
        <div className="card" style={{ left: '16%', top: '23%' }}>
          <div className="card-head"><strong>{DAY_NAMES[today.getDay()]} {today.getDate()} {MONTHS[today.getMonth()]}</strong>{tasks.length > 0 && <span className="pill">{done} of {tasks.length} done</span>}</div>
          <div className="rows">
            {list.map(t => { const note = d.notes[T + '|' + t.id]; return <div key={t.id} className={`row ${stOf(t)}`} style={{ ['--c' as string]: calColor(t.cal) }}><span className="chk"><Check /></span><span className="t">{t.title}{note && <i>{note}</i>}</span>{t.time && <time>{t.time}</time>}</div>; })}
            {!list.length && <div className="empty">Nothing planned yet. Open Today to add your first task.</div>}
          </div>
        </div>
      </LinkTile>
      <LinkTile href="#/today" area="lift" g="g-green">
        <Copy b="Streak." s="Days in a row you finished something." />
        <div className="stat"><CountUp to={run} /><small>{run === 1 ? 'day' : 'days'}</small></div>
        <div className="aside">{plural(done, 'task')}<small>done today</small></div>
      </LinkTile>
      <WallTile />
      <LinkTile href="#/calendar" area="next" g="g-lilac">
        {next ? <>
          <div className="copy home-next"><span className="label">Next up</span><span>in {inHM(next.s - nowH)}</span></div>
          <div className="stat" style={{ fontSize: 'clamp(44px, 9.5vh, 76px)' }}>{fmtTime(next.s)}</div>
          <div className="aside">{next.short || next.title}<small>{evs[1] ? `then ${evs[1].short || evs[1].title}, ${fmtTime(evs[1].s)}` : 'last one today'}</small></div>
        </> : <Copy b="Nothing else today." s="The calendar is clear." />}
      </LinkTile>
      <LinkTile href="#/hours" area="hours" g="g-paper" className="wide">
        <Copy b="Where today went." s={logged ? `${logged} of 24 hours logged.` : 'Paint your hours in Hours.'} />
        <div className="hstrip-mini"><Strip cells={cells} cats={d.cats} /><Ticks /></div>
      </LinkTile>
      <LinkTile href="#/today" area="dsa" g="g-night">
        <Copy b={`${MONTHS[today.getMonth()]}.`} s={`${plural(doneMonth, 'task')} done so far.`} />
        <Month d={d} T={T} today={today} />
        <div className="aside">{active} of {today.getDate()} days<small>with something done</small></div>
      </LinkTile>
      <LinkTile href="#/ideas" area="ideas" g="g-orange">
        <Copy b="Ideas." s={idea && idea.n ? `${plural(idea.n, 'note')} on the board.` : 'Dump it here, connect what matters.'} />
        <div className="stk" style={{ background: '#FFD966', left: 22, bottom: -18, ['--r' as string]: '-5deg', zIndex: 3 }}>{(idea && idea.first) || ''}</div>
        <div className="stk" style={{ background: '#A8DAFF', left: 130, bottom: -44, ['--r' as string]: '6deg', zIndex: 2 }} />
        <div className="stk" style={{ background: '#FFB8D1', left: 236, bottom: -30, ['--r' as string]: '-3deg' }} />
      </LinkTile>
      {/* the badge lands last, where the four tiles meet */}
      <motion.button className="badge" title="Your data and backups" aria-label="Your data and backups" onClick={e => openDataCard(e.currentTarget)}
        variants={{ hidden: { opacity: 0, scale: 0.6 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 22, delay: 0.32 } } }}
        whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}>
        <span className="mark"><i /><i /><i /><i /></span><b>Tessera</b>
      </motion.button>
    </Bento>
  );
}
