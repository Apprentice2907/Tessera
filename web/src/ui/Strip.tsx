// Tessera · an hour strip: a day's 24 hours as blocks, a run of the same category one block with its name (Home and Hours),
// and the hours under it. When the strip first shows, its blocks fill in from the left (a GSAP timeline).
import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import { gsap } from 'gsap';
import type { Cat, HourCells } from '../lib/types';
import { reducedMotion } from '../store/ui';

export function Strip({ cells, cats, id, onPick }: { cells: HourCells; cats: Cat[]; id?: string; onPick?: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const runs: { id: string | null; n: number; i: number }[] = [];
  for (let i = 0; i < 24;) { const c = cells[i]; let n = 1; while (c && cells[i + n] === c) n++; runs.push({ id: c, n, i }); i += n; }
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
          ? <div key={i} className="hb f" style={{ gridColumn: `span ${n}`, ['--cs' as string]: k.solid, ['--cf' as string]: k.fg || '#fff' }}>{n >= 2 ? k.name : ''}</div>
          : <div key={i} className="hb" style={{ gridColumn: `span ${n}` }} />;
      })}
    </div>
  );
}

/** every hour gets a number: 1–11 light, 12 AM and 12 PM dark and bold; when an hour is too narrow for "12 AM", the "1" after it steps aside */
export function Ticks() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const t = ref.current; if (!t) return;
    const fit = () => {
      t.classList.remove('tight');
      const k = t.querySelector('.k'), next = k?.nextElementSibling; if (!k || !next) return;
      const r = document.createRange(); r.selectNodeContents(k);
      if (r.getBoundingClientRect().right > next.getBoundingClientRect().left - 4) t.classList.add('tight');
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(t);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, []);
  return <div className="ticks" ref={ref}>{Array.from({ length: 24 }, (_, h) => (h % 12 ? <span key={h}>{h % 12}</span> : <span key={h} className="k">{h ? '12 PM' : '12 AM'}</span>))}</div>;
}
