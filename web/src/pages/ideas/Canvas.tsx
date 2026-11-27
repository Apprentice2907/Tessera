// Tessera · Ideas board — the canvas: objects as elements in a zoomed world, connectors in one SVG, and handles,
// guides and the lasso on top in screen space. Each object redraws only when it changes (objects are never edited in
// place, so a new object means a change); connectors redraw with anything, since they follow what they join.
import { memo, useCallback, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { PEOPLE, WB, bounds, box, canEdit, toScreen, useWB } from './core';
import { domain, geom, headPath, inkPath, isVideo, shapePath, svgKind, textOn } from './draw';
import { I, R, els } from './input';
import { Ic, ICON, StampArt } from './Icons';
import type { End, Obj } from './types';

const css = (o: Record<string, string | number | undefined>) => o as CSSProperties;

/** text inside an object. React never writes its contents while you type in it (edit() in input.ts makes it
 *  editable); once the edit ends it shows the saved text again. */
function Txt({ text, ph = '', className, style }: { text?: string; ph?: string; className: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el || el.isContentEditable) return;
    const want = text || ph;
    if (el.textContent !== want) el.textContent = want;
  });
  return <div ref={ref} className={className} style={style} />;
}

function Body({ o, me }: { o: Obj; me: string }) {
  const fs = `fs-${o.fs || 'm'}`;
  switch (o.type) {
    case 'note': return (
      <div className="note" style={css({ '--c': o.color, color: textOn(o.color) })}>
        <Txt className={`txt ${fs}`} style={{ textAlign: o.align || 'center' }} text={o.text} />
        <span className="who">{o.by || ''}</span>
      </div>
    );
    case 'text': return <Txt className={`txt ${fs}${o.bold ? ' b' : ''}`} style={{ color: o.color || '#1C1C1E', textAlign: o.align || 'left' }} text={o.text} />;
    case 'shape': {
      const fill = o.fill || '#A9D8FF';
      return <>
        {svgKind(o.kind)
          ? <svg className="shp" width="100%" height="100%" viewBox={`0 0 ${o.w} ${o.h}`} overflow="visible"><path d={shapePath(o.kind, o.w, o.h)} fill={fill} stroke={o.stroke || 'none'} strokeWidth={o.sw || 0} strokeLinejoin="round" /></svg>
          : <div className={`shp k-${o.kind}`} style={{ background: fill, border: o.sw ? `${o.sw}px solid ${o.stroke}` : undefined }} />}
        <Txt className={`txt ${fs}${o.bold ? ' b' : ''}`} style={{ color: o.color || textOn(fill === 'transparent' ? '#fff' : fill), textAlign: o.align || 'center' }} text={o.text} />
      </>;
    }
    case 'image': return <img src={o.src} alt={o.alt || ''} draggable={false} />;
    case 'link': {
      const vid = isVideo(o.url), host = domain(o.url);
      return (
        <div className={'lnk' + (vid ? ' vid' : '')}>
          <div className="lthumb">{vid ? <i className="play" /> : <b>{(host[0] || '?').toUpperCase()}</b>}</div>
          <div className="lmeta"><b>{o.title || host}</b><small>{host}</small></div>
          <span className="lopen" data-open="" title="Open link"><Ic d={ICON.open} s={14} /></span>
        </div>
      );
    }
    case 'section': return <div className="sec" style={css({ '--sc': o.color || '#F4F1FF' })}><Txt className="stitle" text={o.text} ph="Section" /></div>;
    case 'stamp': return <div className="stamp"><StampArt k={o.emoji} s="88%" /></div>;
    case 'comment': {
      const t = o.thread || [], first = t[0];
      return <div className={'cpin' + (o.resolved ? ' done' : '')} style={css({ '--pc': PEOPLE[first?.by] || '#8E8E93' })}><b>{(first?.by || '?')[0]}</b>{t.length > 1 && <em>{t.length}</em>}</div>;
    }
    case 'ink': return (
      <svg className="ink" width="100%" height="100%" viewBox={`0 0 ${o.nw} ${o.nh}`} preserveAspectRatio="none" overflow="visible">
        <path className="hit" d={inkPath(o.pts)} strokeWidth={(o.sw || 3) + 12} />
        <path className={o.hl ? 'hl' : ''} d={inkPath(o.pts)} stroke={o.color} strokeWidth={o.sw} />
      </svg>
    );
    case 'poll': {
      const opts = o.opts || [], total = opts.reduce((a, p) => a + Object.keys(p.v || {}).length, 0);
      return (
        <div className="poll">
          <div className="pq">{o.q}</div>
          {opts.map((p, i) => { const n = Object.keys(p.v || {}).length, pct = total ? Math.round(n / total * 100) : 0; return <button key={i} className={'popt' + (p.v?.[me] ? ' on' : '')} data-opt={i}><span className="pbar" style={{ width: pct + '%' }} /><span className="ptx">{p.t}</span><em>{n}</em></button>; })}
          <small>{total} vote{total === 1 ? '' : 's'} · click to vote</small>
        </div>
      );
    }
  }
  return null;
}

// z goes in steps of a half (Forward / Backward put an object between two others), so it is doubled for CSS
const zIndex = (o: Obj) => Math.round((o.type === 'section' ? 0 : o.type === 'comment' ? 450000 : 50000) * 2 + (o.z || 0) * 2);
const ObjView = memo(function ObjView({ o, editing, me }: { o: Obj; editing: boolean; me: string }) {
  const ref = useCallback((el: HTMLDivElement | null) => { if (el) els.set(o.id, el); else if (els.get(o.id) && !els.get(o.id)!.isConnected) els.delete(o.id); }, [o.id]);
  const cls = `o t-${o.type}${o.kind ? ' k-' + o.kind : ''}${o.locked ? ' locked' : ''}${o.type === 'comment' && o.resolved ? ' resolved' : ''}${editing ? ' editing' : ''}`;
  return (
    <div ref={ref} data-id={o.id} className={cls} style={{ left: o.x, top: o.y, width: o.w, height: o.h, transform: o.r ? `rotate(${o.r}deg)` : undefined, zIndex: zIndex(o) }}>
      <Body o={o} me={me} />
    </div>
  );
});

const Objects = memo(function Objects() {
  useWB('change', 'board', 'edit');
  const editing = I.editing?.id, me = WB.me.name, list: ReactNode[] = [];
  for (const id in WB.objs) { const o = WB.objs[id]; if (o.type !== 'line') list.push(<ObjView key={id} o={o} editing={editing === id} me={me} />); }
  return <div className="objs">{list}</div>;
});

// ---------- connectors ----------
function LineBody({ l, sel }: { l: { a?: End; b?: End; style?: string; arrow?: string; sw?: number; color?: string; dash?: boolean; text?: string }; sel?: boolean }) {
  const g = geom(l), c = l.color || '#1C1C1E', sw = l.sw || 2;
  return <>
    {sel && <path d={g.d} className="glow" strokeWidth={sw + 8} />}
    <path d={g.d} className="hit" />
    <path d={g.d} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={l.dash ? '8 7' : undefined} />
    {(l.arrow === 'end' || l.arrow === 'both') && <path d={headPath(g.p2, g.t2, sw)} fill={c} stroke={c} strokeWidth={sw * .6} strokeLinejoin="round" />}
    {l.arrow === 'both' && <path d={headPath(g.p1, g.t1, sw)} fill={c} stroke={c} strokeWidth={sw * .6} strokeLinejoin="round" />}
    {l.text && <text x={g.mid.x} y={g.mid.y} className="llab">{l.text}</text>}
  </>;
}
const Lines = memo(function Lines() {
  useWB('change', 'sel', 'overlay', 'board');
  const list = Object.values(WB.objs).filter(o => o.type === 'line').sort((a, b) => a.z - b.z);
  return (
    <svg className="lines" width="1" height="1" overflow="visible" aria-hidden="true">
      {list.map(l => <g key={l.id} data-id={l.id} className={'ln' + (WB.sel.has(l.id) ? ' on' : '')}><LineBody l={l} sel={WB.sel.has(l.id)} /></g>)}
      {R.temp && <g className="ln temp"><LineBody l={{ a: R.temp.a, b: R.temp.b, style: WB.opts.line, arrow: WB.opts.arrow, sw: 2, color: '#7B61FF' }} /></g>}
    </svg>
  );
});

// ---------- handles, guides, lasso, the live pen stroke ----------
const HANDLES: [string, number, number][] = [['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0]];
const Overlay = memo(function Overlay() {
  useWB('sel', 'change', 'cam', 'overlay', 'board', 'meta');
  const out: ReactNode[] = [], z = WB.cam.z;
  const sel = [...WB.sel].map(id => WB.objs[id]).filter(Boolean), edit = canEdit();
  if (sel.length === 1 && sel[0].type === 'line') {
    const g = geom(sel[0]), a = toScreen(g.p1.x, g.p1.y), b = toScreen(g.p2.x, g.p2.y);
    if (edit) out.push(<i key="ea" className="hend" data-end="a" style={{ left: a.x, top: a.y }} />, <i key="eb" className="hend" data-end="b" style={{ left: b.x, top: b.y }} />);
  } else if (sel.length === 1) {
    const o = sel[0], c = toScreen(o.x + o.w / 2, o.y + o.h / 2), b = { cx: c.x, cy: c.y, w: o.w * z, h: o.h * z, r: o.r || 0 };
    const rot = (lx: number, ly: number) => { const a = b.r * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return { x: b.cx + lx * cs - ly * sn, y: b.cy + lx * sn + ly * cs }; };
    out.push(<div key="sb" className="sbox" style={{ left: b.cx - b.w / 2, top: b.cy - b.h / 2, width: b.w, height: b.h, transform: `rotate(${b.r}deg)` }} />);
    if (edit && !o.locked && o.type !== 'comment') {
      const hs = o.type === 'stamp' || o.type === 'poll' ? HANDLES.filter(([k]) => k.length === 2) : HANDLES;
      hs.forEach(([k, dx, dy]) => { const p = rot(dx * b.w / 2, dy * b.h / 2); out.push(<i key={k} className={`hd h-${k}`} data-h={k} style={{ left: p.x, top: p.y, transform: `translate(-50%,-50%) rotate(${b.r}deg)` }} />); });
      if (!['section', 'comment', 'poll'].includes(o.type)) { const p = rot(0, -b.h / 2 - 24); out.push(<i key="rot" className="hrot" data-h="rot" style={{ left: p.x, top: p.y }} title="Rotate" />); }
    }
    if (o.locked) out.push(<span key="lk" className="slock" style={{ left: b.cx, top: b.cy - b.h / 2 - 12 }}>Locked</span>);
  } else if (sel.length > 1) {
    const bb = bounds(sel), a = toScreen(bb.x, bb.y);
    out.push(<div key="sb" className="sbox multi" style={{ left: a.x, top: a.y, width: bb.w * z, height: bb.h * z }} />);
    if (edit) ([['nw', 0, 0], ['ne', 1, 0], ['se', 1, 1], ['sw', 0, 1]] as [string, number, number][]).forEach(([k, fx, fy]) => out.push(<i key={k} className={`hd h-${k}`} data-h={k} style={{ left: a.x + bb.w * z * fx, top: a.y + bb.h * z * fy, transform: 'translate(-50%,-50%)' }} />));
  }
  const t = R.target ? WB.objs[R.target] : undefined;
  if (t) { const b = box(t), a = toScreen(b.x, b.y); out.push(<div key="tgt" className="tgt" style={{ left: a.x - 4, top: a.y - 4, width: b.w * z + 8, height: b.h * z + 8 }} />); }
  R.guides.forEach((g, i) => { const a = toScreen(g.x1, g.y1), b = toScreen(g.x2, g.y2); out.push(<div key={'g' + i} className="guide" style={{ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(b.x - a.x) || 1, height: Math.abs(b.y - a.y) || 1 }} />); });
  if (R.marq) { const a = toScreen(R.marq.x, R.marq.y); out.push(<div key="mq" className="marq" style={{ left: a.x, top: a.y, width: R.marq.w * z, height: R.marq.h * z }} />); }
  if (R.pen) {
    const pts = R.pen.pts.map(([x, y]) => { const p = toScreen(x, y); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');
    out.push(<svg key="pen" className="penlive" width="100%" height="100%"><polyline points={pts} stroke={R.pen.color} strokeWidth={R.pen.sw * z} strokeOpacity={R.pen.hl ? .45 : undefined} /></svg>);
  }
  return <div className="overlay">{out}</div>;
});

// ---------- the camera: the world moves and scales, the dot grid moves with it ----------
function World({ children }: { children: ReactNode }) {
  useWB('cam');
  const { x, y, z } = WB.cam;
  return <div className="world" style={{ transform: `translate(${x}px, ${y}px) scale(${z})` }}>{children}</div>;
}
/** the canvas. Its class stays "vp" (the pointer code adds grab and panning to it), so what changes is in data-* */
export function Canvas({ ref }: { ref: Ref<HTMLDivElement> }) {
  useWB('cam', 'meta', 'board', 'tool');
  const { x, y, z } = WB.cam, st = WB.board?.meta.settings || {};
  let step = 24 * z; while (step < 12) step *= 4;
  return (
    <div className="vp" ref={ref} tabIndex={-1} aria-label="Whiteboard canvas" data-tool={WB.tool} data-bg={st.bg || 'paper'} data-nogrid={st.grid === false ? '' : undefined}
      style={{ backgroundSize: `${step}px ${step}px`, backgroundPosition: `${x}px ${y}px` }}>
      <World><Objects /><Lines /></World>
      <Overlay />
    </div>
  );
}
