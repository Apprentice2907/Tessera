// Tessera · Hours: today hour by hour, painted by category, and every earlier day of the month as one row.
// Click a category to paint with it, click an hour to paint it. Double-click a category to delete it; + adds one.
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { gsap } from 'gsap';
import { useData, update } from '../store/data';
import { monthSoFar, useClock } from '../store/clock';
import { setUI, toast, useUI, reducedMotion } from '../store/ui';
import { paintHour } from '../store/rules';
import { CAT_PALETTE, catOf, hoursOn } from '../lib/data';
import { DAY_NAMES, MONTHS, dateOf } from '../lib/dates';
import type { Cat } from '../lib/types';
import { Bento, Copy, Tile, EASE } from '../ui/motion';
import { CountUp } from '../ui/CountUp';
import { Strip, Ticks } from '../ui/Strip';
import { Del, Tick } from '../ui/icons';

const freePalette = (cats: Cat[]) => CAT_PALETTE.filter(p => !cats.some(c => c.solid === p.solid));

function StatTile({ c, area, g, tot, days, mon }: { c: Cat; area: string; g: string; tot: Record<string, number>; days: number; mon: string }) {
  const h = tot[c.id] || 0;
  return (
    <Tile area={area} g={g}>
      <Copy b={`${c.name}.`} s={`${mon} so far.`} />
      <div className="stat"><CountUp to={h} /><small>h</small></div>
      <div className="aside">{(h / days).toFixed(1)} h a day</div>
    </Tile>
  );
}

/** the month as a heat map: every finished day of the month, newest at the top, about 15 rows in view and the rest a
 *  scroll away. A day with nothing logged keeps its empty squares. The rows light up from the top when the page opens. */
function Heat({ past }: { past: number[] }) {
  const d = useData(s => s.d), ref = useRef<HTMLDivElement>(null);
  const [fadeT, setFadeT] = useState(false), [fadeB, setFadeB] = useState(false);
  const days = [...past].reverse();
  // soft edges say there is more above or below
  const fade = () => { const l = ref.current; if (!l) return; setFadeT(l.scrollTop > 2); setFadeB(l.scrollTop + l.clientHeight < l.scrollHeight - 2); };
  useLayoutEffect(fade);
  useLayoutEffect(() => {
    if (!ref.current || reducedMotion()) return;
    const ctx = gsap.context(() => { gsap.from('.heat-row', { opacity: 0, y: -4, duration: 0.35, ease: 'power2.out', stagger: 0.03, delay: 0.2, clearProps: 'transform,opacity' }); }, ref);
    return () => ctx.revert();
  }, []);
  return <>
    <div className="heat-h" aria-hidden="true"><span />{Array.from({ length: 24 }, (_, h) => <span key={h} className={h % 12 ? '' : 'k'}>{h % 6 ? '' : h === 0 ? '12 AM' : h === 12 ? '12 PM' : '6'}</span>)}</div>
    <div className={'heat' + (fadeT ? ' fade-t' : '') + (fadeB ? ' fade-b' : '')} ref={ref} onScroll={fade}>
      {days.map(D => {
        const day = dateOf(D);
        return (
          <div className="heat-row" key={D}>
            <b><span>{DAY_NAMES[day.getDay()]}</span>{day.getDate()}</b>
            {hoursOn(d, D).map((c, h) => { const k = catOf(d, c); return <i key={h} style={k ? { background: k.solid } : undefined} title={k ? k.name : ''} />; })}
          </div>
        );
      })}
    </div>
  </>;
}

export function Hours() {
  const d = useData(s => s.d), { T, today } = useClock(), { brush: brushId, newCat, catDel } = useUI();
  const brush = catOf(d, brushId) || d.cats[0]; // the brush was deleted, maybe in another window
  const cells = hoursOn(d, T), month = monthSoFar(T, today), past = month.slice(0, -1);
  const tot: Record<string, number> = {}; month.forEach(D => hoursOn(d, D).forEach(c => { if (c) tot[c] = (tot[c] || 0) + 1; }));
  const logged = cells.filter(Boolean).length, mon = MONTHS[today.getMonth()];
  // the three categories with the most hours this month (until there are any, the first three)
  const top = [...d.cats].sort((x, y) => (tot[y.id] || 0) - (tot[x.id] || 0)).slice(0, 3);
  const canAdd = freePalette(d.cats).length > 0 || !!newCat;
  const last = useRef<{ id: string; t: number } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [fadeT, setFadeT] = useState(false), [fadeB, setFadeB] = useState(false);
  // the list scrolls once it is full; soft edges show there is more above or below
  const fade = () => { const l = list.current; if (!l) return; setFadeT(l.scrollTop > 2); setFadeB(l.scrollTop + l.clientHeight < l.scrollHeight - 2); };
  useLayoutEffect(fade);
  // asking to delete: the × takes focus; a click anywhere else on the page lets it go
  useEffect(() => {
    if (!catDel) return;
    document.querySelector<HTMLElement>('.cdel')?.focus();
    const away = (e: PointerEvent) => { if (!(e.target as Element).closest('.crow')) setUI({ catDel: null }); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [catDel]);

  // one click paints with it; a second click on the same one (a double-click) offers to delete it
  const pickCat = (id: string) => {
    const now = Date.now(), again = last.current?.id === id && now - last.current.t < 400;
    last.current = { id, t: now };
    if (again) setUI({ catDel: id }); else setUI({ catDel: null, brush: id });
  };
  const delCat = (c: Cat) => {
    setUI({ catDel: null });
    if (d.cats.length === 1) return toast('Keep at least one category');
    update(dr => {
      dr.cats = dr.cats.filter(x => x.id !== c.id);
      Object.values(dr.hours).forEach(hs => hs.forEach((x, i) => { if (x === c.id) hs[i] = null; }));
    });
    if (brush.id === c.id) setUI({ brush: d.cats.find(x => x.id !== c.id)!.id });
    toast(`Deleted ${c.name}`);
  };

  return (
    <Bento className="p-hours">
      <Tile area="strip" g="g-white" className="wide">
        <Copy b="Today, hour by hour." s={`${logged} of 24 logged. Click an hour to paint it ${brush.name}.`} />
        <div className="hstrip">
          <Strip id="hstrip" cells={cells} cats={d.cats} onPick={h => update(dr => paintHour(dr, T, h, brush.id))} />
          <Ticks />
        </div>
      </Tile>
      <StatTile c={top[0]} area="sleep" g="g-green" tot={tot} days={month.length} mon={mon} />
      <Tile area="month" g="g-night" className="lead">
        <Copy b={`${mon} so far.`} s={past.length ? 'Every finished day, newest first.' : 'A new month. Each day shows up here as a row once it’s done.'} />
        <Heat past={past} />
      </Tile>
      <Tile area="chips" g="g-cream" className="tall cats">
        <Copy b="Categories." s="Pick one to paint." />
        <button className={'up cplus' + (newCat ? ' open' : '')} id="cat-add" aria-label={newCat ? 'Cancel new category' : 'New category'} aria-expanded={!!newCat}
          disabled={!canAdd} title={canAdd ? undefined : 'All colours are in use'}
          onPointerDown={e => e.preventDefault()} // keep focus in the form, so clicking × just closes it
          onClick={() => { setUI({ newCat: newCat ? null : { pi: 0 } }); if (list.current) list.current.scrollTop = 0; }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M8 3 V13 M3 8 H13" /></svg>
        </button>
        <motion.div layoutScroll className={'clist' + (fadeT ? ' fade-t' : '') + (fadeB ? ' fade-b' : '')} ref={list} onScroll={fade}>
          <AnimatePresence initial={false}>
            {newCat && freePalette(d.cats).length > 0 && <NewCat key="new" pi={newCat.pi} />}
            {d.cats.map(c => (
              <motion.div key={c.id} layout transition={{ duration: 0.3, ease: EASE }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className={'crow' + (catDel === c.id ? ' deleting' : '')}>
                <button className={'cat ' + (brush.id === c.id ? 'on' : '')} style={{ ['--cs' as string]: c.solid, ['--cf' as string]: c.fg || '#fff' }} aria-pressed={brush.id === c.id} title="Double-click to delete"
                  onClick={() => pickCat(c.id)} onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') setUI({ catDel: c.id }); }}>
                  <span>{c.name}</span><small>{tot[c.id] || 0}h</small><i className="tick" aria-hidden="true"><Tick /></i>
                </button>
                {catDel === c.id && <button className="cdel" style={{ color: c.solid }} aria-label={`Delete ${c.name}`} title={`Delete ${c.name}`}
                  onClick={() => delCat(c)} onKeyDown={e => { if (e.key === 'Escape') setUI({ catDel: null }); }}><Del /></button>}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </Tile>
      <StatTile c={top[1] || top[0]} area="code" g="g-orange" tot={tot} days={month.length} mon={mon} />
      <StatTile c={top[2] || top[0]} area="social" g="g-yellow" tot={tot} days={month.length} mon={mon} />
    </Bento>
  );
}

// ---------- add a category: a name and one of the colours not in use ----------
function NewCat({ pi }: { pi: number }) {
  const cats = useData(s => s.d.cats), pal = freePalette(cats), p = pal[pi] || pal[0];
  const form = useRef<HTMLFormElement>(null), name = useRef<HTMLInputElement>(null);
  useEffect(() => { name.current?.focus(); }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = (name.current?.value || '').trim().replace(/\s+/g, ' '); if (!v) return name.current?.focus();
    const same = cats.find(c => c.name.toLowerCase() === v.toLowerCase());
    if (same) { setUI({ newCat: null, brush: same.id }); return toast(`You already have ${same.name}`); }
    const c: Cat = { id: 'c' + Date.now(), name: v, solid: p.solid, fg: p.fg, custom: true };
    update(dr => { dr.cats.push(c); });
    setUI({ brush: c.id, newCat: null });
    setTimeout(() => { const l = document.querySelector('.clist'); if (l) l.scrollTop = l.scrollHeight; });
    toast(`Added ${v}. Click an hour to paint it.`);
  };
  return (
    <motion.form className="cnew" id="cat-form" autoComplete="off" ref={form} onSubmit={submit}
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }} transition={{ duration: 0.25, ease: EASE }}
      onKeyDown={e => { if (e.key === 'Escape') setUI({ newCat: null }); }}
      onBlur={() => setTimeout(() => { if (form.current && !form.current.contains(document.activeElement) && !(name.current?.value || '').trim()) setUI({ newCat: null }); }, 120)}>
      <div className="cn1"><i id="cat-dot" style={{ background: p.solid }} /><input id="cat-name" ref={name} maxLength={22} placeholder="Name, e.g. Reading" aria-label="Category name" /><button type="submit">Add</button></div>
      <div className="cn2" role="radiogroup" aria-label="Colour">
        {pal.map((q, i) => <button key={q.solid} type="button" className={'sw ' + (q === p ? 'on' : '')} style={{ ['--cs' as string]: q.solid }} role="radio" aria-checked={q === p} aria-label={q.name}
          onClick={() => { setUI({ newCat: { pi: i } }); name.current?.focus(); }} />)}
      </div>
    </motion.form>
  );
}
