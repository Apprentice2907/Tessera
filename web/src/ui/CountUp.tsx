// Tessera · a big number that counts up to its value when it first shows, and rolls to a new value when it changes.
// The idea is React Bits' Count Up; this one is written on GSAP. It owns its text, so React never redraws it mid-count.
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { reducedMotion } from '../store/ui';

export function CountUp({ to, decimals = 0, duration = 0.9, delay = 0.18 }: { to: number; decimals?: number; duration?: number; delay?: number }) {
  const el = useRef<HTMLSpanElement>(null), cur = useRef<number | null>(null);
  useLayoutEffect(() => {
    const node = el.current; if (!node) return;
    const fmt = (v: number) => v.toFixed(decimals);
    const first = cur.current == null, from = cur.current ?? 0;
    if (reducedMotion() || from === to || !Number.isFinite(to)) { node.textContent = fmt(to); cur.current = to; return; }
    node.textContent = fmt(from);
    const o = { v: from };
    const tw = gsap.to(o, {
      v: to, duration: first ? duration : 0.5, delay: first ? delay : 0, ease: 'power3.out',
      onUpdate: () => { cur.current = o.v; node.textContent = fmt(decimals ? o.v : Math.round(o.v)); },
      onComplete: () => { cur.current = to; node.textContent = fmt(to); },
    });
    return () => { tw.kill(); };
  }, [to, decimals, duration, delay]);
  return <span ref={el} />;
}
