// Tessera · an hour strip: a day's 24 hours as blocks, a run of the same category one block (Home and Hours), and the
// hours under it. A block shows its category's name only when the whole name fits; a narrower one is just its colour,
// with the name on hover. When the strip first shows, its blocks fill in from the left (a GSAP timeline).
import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import { gsap } from 'gsap';
import type { Cat, HourCells } from '../lib/types';
import { reducedMotion } from '../store/ui';

export function Strip({ cells, cats, id, onPick }: { cells: HourCells; cats: Cat[]; id?: string; onPick?: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const runs: { id: string | null; n: number; i: number }[] = [];
  for (let i = 0; i < 24;) { const c = cells[i]; let n = 1; while (c && cells[i + n] === c) n++; runs.push({ id: c, n, i }); i += n; }
  // a name that doesn't fit its block isn't shown cut off: it steps aside (checked again whenever the strip changes size)
  useLayoutEffect(() => {
    const strip = ref.current; if (!strip) return;
    const fit = () => strip.querySelectorAll<HTMLElement>('.hb-n').forEach(n => {
      const b = n.parentElement!, room = b.clientWidth - parseFloat(getComputedStyle(b).paddingLeft) - 6;
      n.classList.toggle('cut', n.scrollWidth > room);
    });
    fit();
    const ro = new ResizeObserver(fit); ro.observe(strip);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  });
  // only when it first shows: an hour painted later just appears
  useLayoutEffect(() => {
    if (!ref.current || reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.timeline().from('.hb.f', { scaleX: 0, transformOrigin: '0 50%', duration: 0.45, ease: 'power3.out', stagger: 0.035, delay: 0.25, clearProps: 'transform,transformOrigin' });
    }, ref);
    return () => ctx.revert();
  }, []);
  const pick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    onPick(Math.min(23, Math.max(0, Math.floor((e.clientX - r.left) / r.width * 24))));
  };
  return (
    <div className="strip" id={id} ref={ref} onClick={onPick ? pick : undefined}>
      {runs.map(({ id: c, n, i }) => {
        const k = c ? cats.find(x => x.id === c) : undefined;
        return k
          ? <div key={i} className="hb f" title={k.name} style={{ gridColumn: `span ${n}`, ['--cs' as string]: k.solid, ['--cf' as string]: k.fg || '#fff' }}>{n >= 2 && <span className="hb-n">{k.name}</span>}</div>
          : <div key={i} className="hb" style={{ gridColumn: `span ${n}` }} />;
      })}
    </div>
  );
}

/** every hour gets a number: 1–11 light, 12 AM and 12 PM dark and bold. When the hours are too narrow for all of them
 *  (a phone), the numbers keep an even step instead of running into each other: every hour if they fit, else every 2nd,
 *  3rd or 6th. 12 AM and 12 PM always stay; a number that would touch one of them steps aside. */
const STEPS = [1, 2, 3, 6];
export function Ticks() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const t = ref.current; if (!t) return;
    const fit = () => {
      const spans = [...t.children] as HTMLElement[];
      // where each number's text actually reaches (it can run past its own hour)
      const at = spans.map(s => { const r = document.createRange(); r.selectNodeContents(s); return r.getBoundingClientRect(); });
      const clear = (r: DOMRect, o: DOMRect) => r.left >= o.right + 4 || r.right <= o.left - 4;
      const ks = [0, 12].map(h => at[h]);
      let on = new Set<number>([0, 12]);
      for (const step of STEPS) {
        const pick = new Set<number>([0, 12]); let prev: DOMRect | null = null, ok = true;
        for (let h = 1; h < 24 && ok; h++) {
          if (h % 12 === 0 || h % step) continue;
          if (!ks.every(k => clear(at[h], k))) continue;   // next to 12 AM / 12 PM: it steps aside
          if (prev && !clear(at[h], prev)) ok = false;      // two numbers touch: try a wider step
          else { pick.add(h); prev = at[h]; }
        }
        if (ok) { on = pick; break; }
      }
      spans.forEach((s, h) => s.classList.toggle('off', !on.has(h)));
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(t);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, []);
  return <div className="ticks" ref={ref}>{Array.from({ length: 24 }, (_, h) => (h % 12 ? <span key={h}>{h % 12}</span> : <span key={h} className="k">{h ? '12 PM' : '12 AM'}</span>))}</div>;
}
