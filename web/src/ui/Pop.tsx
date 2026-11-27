// Tessera · the card that opens beside what you clicked (Calendar, folders, your data), and the toast.
// openPop(anchor, <Body />) from anywhere; Esc or a click outside closes it. It places itself to the right of the
// anchor, or the left, or under it, and moves again whenever its content changes size.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { closePop, usePop, useToast } from '../store/ui';
import { XIcon } from './icons';

export function PopHost() {
  const { anchor, body, below, key } = usePop();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const p = ref.current; if (!anchor || !p) return;
    const place = () => {
      const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight, gap = 10;
      let x = r.right + gap, y = r.top;
      if (x + w > innerWidth - 12) x = r.left - gap - w;
      if (below) { x = Math.max(12, Math.min(innerWidth - w - 12, r.right - w)); y = r.bottom + gap; }
      else if (x < 12) { x = Math.max(12, Math.min(innerWidth - w - 12, r.left)); y = r.bottom + gap; }
      p.style.left = x + 'px'; p.style.top = Math.max(12, Math.min(innerHeight - h - 12, y)) + 'px';
    };
    place();
    const ro = new ResizeObserver(place); ro.observe(p);
    const out = (e: PointerEvent) => { if (!p.contains(e.target as Node)) closePop(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } };
    const t = setTimeout(() => document.addEventListener('pointerdown', out, true));
    document.addEventListener('keydown', esc, true);
    addEventListener('resize', place);
    return () => { clearTimeout(t); ro.disconnect(); document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', esc, true); removeEventListener('resize', place); };
  }, [anchor, below, key]);
  if (!anchor) return null;
  return createPortal(<div className="pop" id="pop" ref={ref} role="dialog" data-float="" key={key}>{body}</div>, document.body);
}

/** the small label and × at the top of a card */
export const PopTop = ({ label }: { label: string }) => (
  <div className="ptop"><span>{label}</span><button type="button" className="px" onClick={closePop} aria-label="Close"><XIcon /></button></div>
);

/** a short message above the page switcher */
export function Toast() {
  const { msg, n } = useToast(), [show, setShow] = useState(false);
  useEffect(() => {
    if (!n) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1900);
    return () => clearTimeout(t);
  }, [n]);
  return <div className={'toast' + (show ? ' show' : '')} id="toast" role="status">{msg}</div>;
}
