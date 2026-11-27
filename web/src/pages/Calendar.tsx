// Tessera · Calendar: a week at a time, the month beside it, routines as dots, and upcoming coding contests
// from Codeforces, CodeChef and LeetCode. Double-click a day to add, an event to edit.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useData, update } from '../store/data';
import { useClock, clock } from '../store/clock';
import { closePop, openPop, setUI, toast, ui, useUI } from '../store/ui';
import { CALS, PLATFORMS, calColor, eventsOn, routineDaysForKey, routineOn, statusOf } from '../lib/data';
import { DAY_LONG, DAY_NAMES, MON3, MONTHS, addDays, dateOf, dayIdx, dayLabel, daySummary, fmtTime, fromHHMM, monthKey, monthLabel, toHHMM, weekStart } from '../lib/dates';
import { sortTask, sortTeach, sortTime } from '../lib/sort';
import type { CalId } from '../lib/types';
import { Bento, Copy, Tile, EASE } from '../ui/motion';
import { CountUp } from '../ui/CountUp';
import { PopTop } from '../ui/Pop';
import { Left, Plus, Right, Tick } from '../ui/icons';
import { startContests, useContests, type Contest } from '../store/contests';

const shownWeek = (wk: number) => weekStart(clock().T) + wk * 7;
function goWeek(wk: number) {
  const ws = dateOf(shownWeek(wk)), today = clock().today;
  setUI({ wk, mmOff: (ws.getFullYear() - today.getFullYear()) * 12 + ws.getMonth() - today.getMonth() });
}

// ---------- contests: store/contests.ts fetches them and puts the rounds in your calendar ----------
/** a contest: when, how long, where from. One the app put in your calendar can be removed from it (and stays removed). */
function ContestCard({ c, added }: { c: Contest; added?: boolean }) {
  const pf = PLATFORMS[c.plat], d = dateOf(c.D), mins = Math.round((c.end - c.start) / 60000);
  const remove = () => {
    update(dr => { const x = dr.events.find(y => y.id === c.id); if (x) (x.skip = x.skip || []).push(x.day); });
    closePop(); toast(`Took ${c.title} off your calendar. It won’t be added again`);
  };
  return <>
    <PopTop label="Contest" />
    <div className="ptitle as-text">{c.title}</div>
    <div className="prow">{DAY_LONG[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]} · {fmtTime(c.s)} · {mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : `${mins} min`}</div>
    <div className="psrc"><span className="plat" style={{ background: pf.bg, color: pf.fg }}>{c.plat}</span><span>{added ? `From ${pf.name}, added to your calendar and your day by itself. The time follows the site if it moves.` : `From ${pf.name}. The time follows the site if the contest moves.`}</span></div>
    <div className="pfoot">{added && <button type="button" className="pbtn redt" onClick={remove}>Remove</button>}<button type="button" className="pbtn" onClick={closePop}>Close</button><a className="pbtn dark" href={c.url} target="_blank" rel="noopener">Open on {pf.name}</a></div>
  </>;
}

// ---------- the cards: add, edit, delete ----------
function CatChips({ cal, set }: { cal: CalId; set: (c: CalId) => void }) {
  return (
    <div className="pcats" role="radiogroup" aria-label="Category">
      {(Object.entries(CALS) as [CalId, { name: string; color: string }][]).map(([k, c]) => (
        <button key={k} type="button" className={k === cal ? 'on' : ''} style={{ ['--cs' as string]: c.color }} role="radio" aria-checked={k === cal} onClick={() => set(k)}>{c.name}<i className="tick"><Tick /></i></button>
      ))}
    </div>
  );
}
type Choice = [string, () => void, boolean?];
/** Delete and Save; deleting something that repeats turns the footer into choices */
function Foot({ asking, setAsking, del, save }: { asking: { q: string; choices: Choice[] } | null; setAsking: (a: null) => void; del: () => void; save: () => void }) {
  if (asking) return (
    <div className="pfoot asking"><p className="pask">{asking.q}</p>
      {asking.choices.map(([label, go, red]) => <button key={label} type="button" className={'pbtn ' + (red ? 'red' : '')} onClick={go}>{label}</button>)}
      <button type="button" className="pbtn" onClick={() => setAsking(null)}>Cancel</button></div>
  );
  return <div className="pfoot"><button type="button" className="pbtn redt" onClick={del}>Delete</button><button type="button" className="pbtn dark" onClick={save}>Save</button></div>;
}
const calDone = (msg: string, fresh?: string[]) => { closePop(); if (fresh) setUI({ calFresh: fresh }); toast(msg); };

// + or a double-click on a day: title, day, optional time, optional weekly repeat. The colour is picked for you.
function AddCard({ D }: { D: number }) {
  const D0 = shownWeek(ui().wk);
  const [pick, setPick] = useState<number[]>([D]), [timed, setTimed] = useState(false), [rep, setRep] = useState(false);
  const [s, setS] = useState(18), [en, setEn] = useState(19), [title, setTitle] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const add = () => {
    const raw = title.trim(); if (!raw) return ref.current?.focus();
    const d = useData.getState().d, tm = sortTime(raw), name = tm ? tm.title : raw, cal = sortTask(d, name).cal;
    const sel = [...pick].sort((a, b) => a - b), dows = sel.map(x => dateOf(x).getDay());
    const ids: string[] = []; let msg: string;
    if (timed) {
      const e2 = en <= s ? Math.min(24, s + 1) : en;
      update(dr => { sel.forEach((x, n) => { const id = 'e' + Date.now() + n; ids.push(id); dr.events.push({ id, cal, day: x, s, e: e2, title: name, rep: rep ? 'Weekly · ' + daySummary(dows) : '' }); }); });
      msg = `Added at ${fmtTime(s)}${rep ? ', every week' : ''}`;
    } else if (rep) {
      const id = 'r' + Date.now(); ids.push(id);
      update(dr => { dr.routines.push({ id, cal, title: name, months: { [monthKey(dateOf(sel[0]))]: dows } }); });
      msg = 'Repeats with no time, so it shows as a dot';
    } else {
      const id = 'o' + Date.now(); ids.push(id);
      update(dr => { dr.oneoffs.push({ id, day: sel[0], cal, title: name }); });
      msg = `Added to ${dayLabel(sel[0])}`;
    }
    calDone(msg, ids);
  };
  const onDay = (i: number) => {
    if (!rep) setPick([i]); else if (pick.includes(i) && pick.length > 1) setPick(pick.filter(x => x !== i)); else if (!pick.includes(i)) setPick([...pick, i]);
  };
  return <>
    <PopTop label="New event" />
    <input className="ptitle" id="pe-t" ref={ref} value={title} placeholder="e.g. Mock interview at 6pm" aria-label="Title" autoComplete="off"
      onChange={e => { setTitle(e.target.value); const tm = sortTime(e.target.value.trim()); if (tm) { setTimed(true); setS(tm.s); setEn(Math.min(24, tm.s + 1)); } }}
      onKeyDown={e => { if (e.key === 'Enter') add(); }} />
    <div className="plabel">Day</div>
    <div className="pdays">{Array.from({ length: 7 }, (_, i) => <button key={i} type="button" className={pick.includes(D0 + i) ? 'on' : ''} onClick={() => onDay(D0 + i)}>{dayLabel(D0 + i)}</button>)}</div>
    <div className="plabel">Time</div>
    <div className="ptimes">
      <span className="pseg"><button type="button" className={!timed ? 'on' : ''} onClick={() => setTimed(false)}>No time</button><button type="button" className={timed ? 'on' : ''} onClick={() => setTimed(true)}>Add time</button></span>
      <span className="prange" hidden={!timed}>
        <input type="time" id="pe-s" aria-label="Starts" value={toHHMM(s)} onChange={e => { const v = fromHHMM(e.target.value || '18:00'); setS(v); if (en <= v) setEn(Math.min(24, v + 1)); }} />
        <em>to</em>
        <input type="time" id="pe-e" aria-label="Ends" value={toHHMM(en)} onChange={e => setEn(fromHHMM(e.target.value || '19:00'))} />
      </span>
    </div>
    <button type="button" className={'ptog' + (rep ? ' on' : '')} id="pe-rep" aria-pressed={rep} onClick={() => { const r = !rep; setRep(r); if (!r && pick.length > 1) setPick([Math.min(...pick)]); }}><i />Repeat every week</button>
    <div className="pfoot"><button type="button" className="pbtn" onClick={closePop}>Cancel</button><button type="button" className="pbtn dark" id="pe-add" onClick={add}>Add</button></div>
  </>;
}

// double-click an event or a task: change its title, time and colour, or delete it
function EditCard({ id, D }: { id: string; D: number }) {
  const d0 = useData.getState().d, e = d0.events.find(x => x.id === id), o = !e ? d0.oneoffs.find(x => x.id === id) : undefined;
  const item = (e || o)!;
  const day = dateOf(D);
  const [cal, setCal] = useState<CalId>(item.cal), [t, setT] = useState<number | null>(o ? (o.s ?? null) : null);
  const [title, setTitle] = useState(item.title), [es, setEs] = useState(e ? toHHMM(e.s) : ''), [ee, setEe] = useState(e ? toHHMM(e.e) : '');
  const [asking, setAsking] = useState<{ q: string; choices: Choice[] } | null>(null);
  const kind = e ? (e.rep ? `Repeats · ${e.rep.replace(/^Weekly · /, 'every ')}` : 'Event') : 'Task';
  const save = () => {
    const v = title.trim();
    update(dr => {
      const it = e ? dr.events.find(x => x.id === id) : dr.oneoffs.find(x => x.id === id); if (!it) return;
      if (v && v !== it.title) { it.title = v; if ('short' in it) delete it.short; }
      if (cal !== it.cal) { it.cal = cal; sortTeach(dr.sort, ('short' in it && it.short) || it.title, cal); }
      if (e && 'e' in it) {
        const s = fromHHMM(es || toHHMM(it.s)), en = fromHHMM(ee || toHHMM(it.e));
        it.s = s; it.e = en > s ? en : Math.min(24, s + 0.5);
      } else if (!e) {
        const oo = it as typeof o & object;
        if (t != null) { oo.s = t; oo.time = fmtTime(t); } else { delete oo.s; delete oo.time; }
      }
    });
    calDone('Saved');
  };
  const del = () => {
    if (o) { update(dr => { dr.oneoffs = dr.oneoffs.filter(x => x.id !== id); }); return calDone(`Deleted “${o.title}”`); }
    if (!e!.rep) { update(dr => { dr.events = dr.events.filter(x => x.id !== id); }); return calDone(`Deleted “${e!.short || e!.title}”`); }
    const sibs = d0.events.filter(x => x.rep && x.title === e!.title), when = dayLabel(D);
    setAsking({
      q: 'It repeats. Delete which?', choices: [
        [`Only ${when}`, () => { update(dr => { const x = dr.events.find(y => y.id === id); if (x) (x.skip = x.skip || []).push(D); }); calDone(`Removed from ${when} only`); }],
        [`Every ${DAY_NAMES[day.getDay()]}`, () => { update(dr => { dr.events = dr.events.filter(x => x.id !== id); }); calDone(`Deleted every ${DAY_NAMES[day.getDay()]}`); }, sibs.length <= 1],
        ...(sibs.length > 1 ? [['All days', () => { const ids = sibs.map(x => x.id); update(dr => { dr.events = dr.events.filter(x => !ids.includes(x.id)); }); calDone(`Deleted “${e!.title}”`); }, true] as Choice] : []),
      ],
    });
  };
  return <>
    <PopTop label={kind} />
    <input className="ptitle" id="pe-t" value={title} onChange={ev => setTitle(ev.target.value)} aria-label="Title" autoComplete="off" onKeyDown={ev => { if (ev.key === 'Enter') save(); }} />
    <div className="prow">{DAY_LONG[day.getDay()]}, {day.getDate()} {MONTHS[day.getMonth()]}</div>
    <div className="ptimes">
      {e ? <><input type="time" id="pe-s" value={es} onChange={ev => setEs(ev.target.value)} aria-label="Starts" /><em>to</em><input type="time" id="pe-e" value={ee} onChange={ev => setEe(ev.target.value)} aria-label="Ends" /></>
        : t != null ? <><input type="time" id="pe-s" value={toHHMM(t)} onChange={ev => setT(fromHHMM(ev.target.value || '18:00'))} aria-label="Time" /><button type="button" className="plink" onClick={() => setT(null)}>No time</button></>
        : <><span className="pmuted">No time</span><button type="button" className="plink" onClick={() => { setT(18); setTimeout(() => document.getElementById('pe-s')?.focus()); }}>Add a time</button></>}
    </div>
    <CatChips cal={cal} set={setCal} />
    <Foot asking={asking} setAsking={setAsking} del={del} save={save} />
  </>;
}

// a routine dot (double-click) or a routine in the list: its days, title and colour
function RoutineCard({ id, D }: { id: string; D: number | null }) {
  const r = useData.getState().d.routines.find(x => x.id === id)!;
  const mk = monthKey(dateOf(D ?? Math.max(clock().T, shownWeek(ui().wk))));
  const [days, setDays] = useState<number[]>([...routineDaysForKey(r, mk)]), [cal, setCal] = useState<CalId>(r.cal), [title, setTitle] = useState(r.title);
  const [asking, setAsking] = useState<{ q: string; choices: Choice[] } | null>(null);
  const save = () => {
    if (!days.length) return toast('Pick at least one day');
    const v = title.trim();
    update(dr => {
      const x = dr.routines.find(y => y.id === id); if (!x) return;
      if (v) x.title = v;
      if (cal !== x.cal) { x.cal = cal; sortTeach(dr.sort, x.title, cal); }
      Object.keys(x.months).forEach(m => { if (m > mk) delete x.months[m]; });
      x.months[mk] = days;
    });
    calDone('Saved');
  };
  const del = () => setAsking({
    q: D != null ? 'Delete just this day, or the routine?' : 'Delete this routine?', choices: [
      ...(D != null ? [[`Only ${dayLabel(D)}`, () => { update(dr => { const x = dr.routines.find(y => y.id === id); if (x) (x.skip = x.skip || []).push(D); }); calDone(`Removed from ${dayLabel(D)} only`); }] as Choice] : []),
      ['Whole routine', () => { update(dr => { dr.routines = dr.routines.filter(y => y.id !== id); }); calDone(`Deleted “${r.title}”`); }, true],
    ],
  });
  return <>
    <PopTop label="Routine · no time, so a dot" />
    <input className="ptitle" id="pe-t" value={title} onChange={e => setTitle(e.target.value)} aria-label="Title" autoComplete="off" />
    <div className="plabel">Repeats on · from {monthLabel(mk)}</div>
    <div className="pdays wk">{[1, 2, 3, 4, 5, 6, 0].map(x => <button key={x} type="button" className={days.includes(x) ? 'on' : ''} onClick={() => setDays(days.includes(x) ? days.filter(y => y !== x) : [...days, x])}>{DAY_NAMES[x].slice(0, 2)}</button>)}</div>
    <CatChips cal={cal} set={setCal} />
    <Foot asking={asking} setAsking={setAsking} del={del} save={save} />
  </>;
}

export function Calendar() {
  const d = useData(s => s.d), { T, today } = useClock(), { wk, mmOff, calFresh } = useUI();
  const contests = useContests(s => s.list);
  useEffect(startContests, []);
  // things just added pop in; forget them once they have
  useEffect(() => { if (!calFresh) return; const t = setTimeout(() => setUI({ calFresh: null }), 600); return () => clearTimeout(t); }, [calFresh]);
  const dir = useRef(0), lastWk = useRef(wk);
  if (lastWk.current !== wk) { dir.current = wk > lastWk.current ? 1 : -1; lastWk.current = wk; }
  const D0 = weekStart(T) + wk * 7, ws = dateOf(D0), we = dateOf(D0 + 6);
  const days = Array.from({ length: 7 }, (_, i) => D0 + i);
  const list = Array.isArray(contests) ? contests : [];
  const coming = list.filter(c => c.start > Date.now()), nx = coming[0], np = nx && PLATFORMS[nx.plat], nd = nx && dateOf(nx.D);
  const h = nx ? (nx.start - Date.now()) / 3.6e6 : 0;
  const timedOn = (D: number) => [
    ...eventsOn(d, D).map(e => ({ kind: 'event', id: e.id, s: e.s, cal: e.cal, label: e.short || e.title, ct: e.ct })),
    ...d.oneoffs.filter(o => o.day === D && o.s != null).map(o => ({ kind: 'task', id: o.id, s: o.s!, cal: o.cal, label: o.title, ct: undefined })),
  ].sort((a, b) => a.s - b.s);
  const count = days.reduce((a, D) => a + timedOn(D).length, 0);
  const fresh = (id: string) => (calFresh && calFresh.includes(id) ? ' fresh' : '');
  const contestEl = (id: string) => document.querySelector<HTMLElement>(`[data-contest="${id}"]`);
  const evBtn = (kind: string, id: string, D: number, cal: CalId, time: string, label: string) => (
    <button key={id} className={`ev${kind === 'task' ? ' task' : ''}${statusOf(d, D, id) === 'done' ? ' done' : ''}${fresh(id)}`} style={{ ['--ec' as string]: calColor(cal) }} title="Double-click to edit"
      onDoubleClick={e => openPop(e.currentTarget, <EditCard key={id} id={id} D={D} />)}>{time && <small>{time}</small>}<b>{label}</b></button>
  );
  const col = (D: number) => {
    const day = dateOf(D);
    return (
      <div key={D} className={`wcol ${D === T ? 'today' : ''}${D < T ? ' past' : ''}`} onDoubleClick={e => { if (e.target === e.currentTarget) openPop(e.currentTarget, <AddCard D={D} />); }}>
        <div className="dh">{DAY_NAMES[day.getDay()]}<b>{day.getDate()}</b></div>
        <div className="dots">{d.routines.filter(r => routineOn(r, day)).map(r => (
          <button key={r.id} className={`${statusOf(d, D, r.id) === 'done' ? 'on' : ''}${fresh(r.id)}`} style={{ ['--c' as string]: calColor(r.cal) }} title={`${r.title} · double-click to edit`} aria-label={r.title}
            onDoubleClick={e => openPop(e.currentTarget, <RoutineCard key={r.id + D} id={r.id} D={D} />)} />
        ))}</div>
        {d.oneoffs.filter(o => o.day === D && o.s == null).map(o => evBtn('task', o.id, D, o.cal, '', o.title))}
        {timedOn(D).map(x => {
          if (!x.ct) return evBtn(x.kind, x.id, D, x.cal as CalId, fmtTime(x.s), x.label);
          // a contest the app added: its site's colours, a click opens it; ticking it in Today greys it out here too
          const pf = PLATFORMS[x.ct.plat] || PLATFORMS.CF, c: Contest = { ...x.ct, id: x.id, title: x.label, D, s: x.s };
          return (
            <button key={x.id} className={`ev contest${statusOf(d, D, x.id) === 'done' ? ' done' : ''}`} data-contest={x.id} style={{ ['--ec' as string]: pf.bg, ['--ef' as string]: pf.fg }} title={x.label}
              onClick={e => openPop(e.currentTarget, <ContestCard c={c} added />)}><small>{fmtTime(x.s)} · {x.ct.plat}</small><b>{x.label}</b></button>
          );
        })}
        {list.filter(c => c.D === D && !d.events.some(e => e.id === c.id)).map(c => (
          <button key={c.id} className="ev contest" data-contest={c.id} style={{ ['--ec' as string]: PLATFORMS[c.plat].bg, ['--ef' as string]: PLATFORMS[c.plat].fg }} title={c.title}
            onClick={e => openPop(e.currentTarget, <ContestCard c={c} />)}><small>{fmtTime(c.s)} · {c.plat}</small><b>{c.title}</b></button>
        ))}
        <button className="wadd" aria-label={`Add on ${dayLabel(D)}`} onClick={e => openPop(e.currentTarget.closest('.wcol') as HTMLElement, <AddCard D={D} />)}><Plus /></button>
      </div>
    );
  };
  // the small month: any date jumps to its week
  const first = new Date(today.getFullYear(), today.getMonth() + mmOff, 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const title = ws.getMonth() === we.getMonth() ? `${MONTHS[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}.` : `${MON3[ws.getMonth()]} ${ws.getDate()} – ${MON3[we.getMonth()]} ${we.getDate()}.`;
  const noContests = contests === null ? 'Looking for contests…' : contests === 'off' ? 'Contests show up when Tessera runs from serve.py.' : 'None announced yet.';
  return (
    <Bento className="p-cal">
      <Tile area="week" g="g-sea" className="lead">
        <Copy b={title} s="Double-click a day to add, an event to edit." />
        <div className="wnav">
          <button className="pillb" disabled={wk === 0} onClick={() => goWeek(0)}>Today</button>
          <button aria-label="Previous week" onClick={() => goWeek(wk - 1)}><Left /></button>
          <button aria-label="Next week" onClick={() => goWeek(wk + 1)}><Right /></button>
          <button id="cal-add" aria-label="New event" onClick={e => openPop(e.currentTarget, <AddCard D={wk === 0 ? T : D0} />, true)}><Plus /></button>
        </div>
        <AnimatePresence initial={false} mode="popLayout" custom={dir.current}>
          <motion.div key={D0} className="card wcard" custom={dir.current}
            variants={{ in: (k: number) => ({ opacity: 0, x: k * 48 }), on: { opacity: 1, x: 0 }, out: (k: number) => ({ opacity: 0, x: k * -48 }) }}
            initial="in" animate="on" exit="out" transition={{ duration: 0.32, ease: EASE }}>
            {days.map(col)}
          </motion.div>
        </AnimatePresence>
      </Tile>
      <Tile area="cont" g="g-night" className="tall">
        {nx ? <>
          <div className="copy cont-head"><span className="plat" style={{ background: np.bg, color: np.fg }}>{nx.plat}</span><b>Next contest.</b></div>
          <div className="cd">
            <div className="big"><CountUp to={Math.floor(h / 24)} /><small>d</small><CountUp to={Math.floor(h % 24)} /><small>h</small></div>
            <p>{nx.title}<br />{DAY_LONG[nd.getDay()]} {nd.getDate()} {MON3[nd.getMonth()]} · {fmtTime(nx.s)}</p>
            <a className="cd-go" href={nx.url} target="_blank" rel="noopener">Register</a>
          </div>
        </> : <Copy b="Next contest." s={noContests} />}
      </Tile>
      <Tile area="mini" g="g-paper">
        <Copy b={`${MONTHS[first.getMonth()]}${first.getFullYear() !== today.getFullYear() ? ' ' + first.getFullYear() : ''}.`} />
        <div className="mmnav"><button aria-label="Previous month" onClick={() => setUI({ mmOff: mmOff - 1 })}><Left /></button><button aria-label="Next month" onClick={() => setUI({ mmOff: mmOff + 1 })}><Right /></button></div>
        <div className="mm">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <span key={'dn' + i} className="dn">{x}</span>)}
          {Array.from({ length: 42 }, (_, i) => {
            const dd = addDays(start, i), inWk = dd >= ws && dd <= we, isToday = +dd === +today;
            const cls = [dd.getMonth() !== first.getMonth() && 'out', inWk && 'wk', inWk && dd.getDay() === 1 && 'first', inWk && dd.getDay() === 0 && 'last', isToday && 'today'].filter(Boolean).join(' ');
            return <button key={i} className={cls} aria-label={`Week of ${dd.getDate()} ${MONTHS[dd.getMonth()]}`} onClick={() => goWeek(Math.floor((dayIdx(dd) - weekStart(T)) / 7))}>{isToday ? <i>{dd.getDate()}</i> : dd.getDate()}</button>;
          })}
        </div>
      </Tile>
      <Tile area="rout" g="g-cream">
        <Copy b="Routines." s={d.routines.length ? 'No time, so dots.' : 'Add one with “Repeat every week” and no time.'} />
        <div className="rmini">{d.routines.map(r => (
          <button key={r.id} style={{ ['--cs' as string]: calColor(r.cal) }} title={`Edit ${r.title}`} onClick={e => openPop(e.currentTarget, <RoutineCard key={r.id} id={r.id} D={null} />)}>
            <b>{r.title}</b><small>{daySummary(routineDaysForKey(r, monthKey(ws))).replace('Every day', 'Daily')}</small>
          </button>
        ))}</div>
      </Tile>
      <Tile area="evs" g="g-green">
        <Copy b={wk === 0 ? 'This week.' : 'That week.'} s="Timed things on the calendar." />
        <div className="stat"><CountUp to={count} /></div>
      </Tile>
      <Tile area="upc" g="g-orange">
        <Copy b="Contests." s={coming.length > 1 ? 'Codeforces, CodeChef, LeetCode.' : noContests} />
        <div className="ulist">{coming.slice(1, 4).map(c => {
          const pf = PLATFORMS[c.plat], cd = dateOf(c.D);
          return (
            <button key={c.id} onClick={() => {
              // go to its week and open it there
              goWeek(Math.floor((c.D - weekStart(T)) / 7));
              setTimeout(() => { const el = contestEl(c.id); if (el) openPop(el, <ContestCard c={c} />); }, 380);
            }}><span className="plat" style={{ background: pf.bg, color: pf.fg }}>{c.plat}</span><span>{c.title}</span><small>{DAY_NAMES[cd.getDay()]} {cd.getDate()}</small></button>
          );
        })}</div>
      </Tile>
    </Bento>
  );
}
