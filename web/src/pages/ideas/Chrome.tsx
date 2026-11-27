// Tessera · Ideas board — the bars around the canvas: the board's name and folder (top left), undo, zoom and export
// (top right), the tools along the bottom with their options above them, and the small bar over a selection.
import { useLayoutEffect, useRef } from 'react';
import { WB, canEdit, clamp, emit, fit, redo, renameBoard, role, selObjs, setTool, undo, useWB, zoomMid, bounds, toScreen } from './core';
import { PAL, SHAPES, SHAPE_NAME, STAMPS, stampOf } from './draw';
import { I, del, duplicate, group, patch, ungroup } from './input';
import { openLink } from './extras';
import { UI, exportPop, folderPop, more, navMenu, setFly, templates, toggleDrawer, zoomPop } from './pops';
import { APP, ICON, Ic, ShapeIcon, StampArt } from './Icons';
import { toast } from '../../store/ui';
import type { Obj, Opts, Tool } from './types';

// ---------- top left: boards, the board's name and folder, saved or not ----------
function Name() {
  const b = WB.board!, owner = role() !== 'viewer', ref = useRef<HTMLInputElement>(null);
  const fitW = () => { const n = ref.current; if (n) n.style.width = Math.min(280, Math.max(60, n.value.length * 9.6 + 16)) + 'px'; };
  useLayoutEffect(fitW);
  return (
    <input key={b.id + b.name} ref={ref} defaultValue={b.name} aria-label="Board name" spellCheck={false} readOnly={!owner} onInput={fitW}
      onKeyDown={e => { const n = e.currentTarget; if (e.key === 'Enter') n.blur(); if (e.key === 'Escape') { n.value = WB.board!.name; n.blur(); } }}
      onBlur={e => { const n = e.currentTarget, v = n.value.trim(); if (v && v !== WB.board!.name) { renameBoard(WB.board!.id, v); toast('Renamed'); } else { n.value = WB.board!.name; fitW(); } }} />
  );
}
function Status() {
  useWB('status');
  return <span className={'status ' + WB.status}><i />{WB.status === 'saving' ? 'Saving…' : WB.status === 'error' ? 'Not saved' : 'Saved'}</span>;
}
export function BarL() {
  useWB('board', 'meta');
  const b = WB.board; if (!b) return null;
  const owner = role() !== 'viewer';
  return (
    <header className="bar bar-l">
      <button className="ib" title="All boards (B)" aria-label="All boards" onClick={toggleDrawer}><Ic d={ICON.boards} /></button><span className="sep" />
      <div className="bname">
        <Name />
        <button className="fold" title="Folder" disabled={!owner} onClick={e => folderPop(e.currentTarget, b.id)}><Ic d={ICON.folder} s={15} />{b.folder}</button>
      </div>
      <Status />{!owner && <span className="vo">View only</span>}
    </header>
  );
}

// ---------- top right: undo, redo, zoom, export ----------
function ZoomLabel() {
  useWB('cam');
  return <button className="zv" title="Zoom options" onClick={e => zoomPop(e.currentTarget)}>{Math.round(WB.cam.z * 100)}%</button>;
}
export function BarR() {
  useWB('history', 'board', 'meta');
  const edit = canEdit(), last = WB.undoStack[WB.undoStack.length - 1];
  return (
    <header className="bar bar-r">
      <button className="ib" title={last ? `Undo ${last.label} (Ctrl+Z)` : 'Nothing to undo'} aria-label="Undo" disabled={!last || !edit} onClick={undo}><Ic d={ICON.undo} /></button>
      <button className="ib" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!WB.redoStack.length || !edit} onClick={redo}><Ic d={ICON.redo} /></button><span className="sep" />
      <div className="zoom">
        <button className="ib zo" title="Zoom out (Ctrl −)" aria-label="Zoom out" onClick={() => zoomMid(1 / 1.25)}><Ic d={ICON.minus} /></button>
        <ZoomLabel />
        <button className="ib zo" title="Zoom in (Ctrl +)" aria-label="Zoom in" onClick={() => zoomMid(1.25)}><Ic d={ICON.plus} /></button>
        <button className="ib" title="Fit to screen (Shift+1)" aria-label="Fit to screen" onClick={() => fit()}><Ic d={ICON.fit} /></button>
      </div><span className="sep" />
      <button className="btn dark" onClick={e => exportPop(e.currentTarget)}><Ic d={ICON.export} s={18} /><span>Export</span></button>
    </header>
  );
}

// ---------- the tools along the bottom ----------
type ToolRow = [Tool | 'upload' | 'templates', string, string] | 0;
const TOOLS: ToolRow[] = [['select', 'Select', 'V'], ['hand', 'Hand', 'H'], 0, ['note', 'Sticky note', 'N'], ['text', 'Text', 'T'], ['shape', 'Shapes', 'S'], ['line', 'Connector', 'L'], 0, ['pen', 'Pen', 'P'], ['hl', 'Highlighter', 'M'], 0, ['section', 'Section', 'F'], ['stamp', 'Stamp', 'E'], ['comment', 'Comment', 'C'], ['link', 'Link or embed', 'K'], 0, ['upload', 'Upload image', ''], ['templates', 'Templates', '']];
const HAS_OPTIONS = new Set(['note', 'shape', 'line', 'pen', 'hl', 'stamp']);
export function Tools({ onUpload }: { onUpload: () => void }) {
  useWB('tool', 'meta', 'board', 'ui');
  const edit = canEdit();
  let list = TOOLS.filter(t => !t || edit || ['select', 'hand', 'comment'].includes(t[0]));
  list = list.filter((t, i) => t || (i > 0 && list[i - 1] && i < list.length - 1));
  const pick = (t: Tool | 'upload' | 'templates') => {
    if (t === 'upload') { onUpload(); return; }
    if (t === 'templates') { templates(); return; }
    const wasOpen = UI.fly === t;
    setTool(t);
    setFly(wasOpen || !HAS_OPTIONS.has(t) || WB.tool !== t ? null : t);
  };
  return (
    <nav className="tools" aria-label="Tools">
      <button className="navb" title="Go to another page (1–7)" aria-label="Pages" onClick={e => navMenu(e.currentTarget)}>
        <Ic d={APP[4][2]} /><Ic d={ICON.up} s={12} />
      </button><span className="tsep" />
      {list.map((t, i) => !t ? <span key={'s' + i} className="tsep" /> : (
        <button key={t[0]} className={'tb' + (WB.tool === t[0] ? ' on' : '')} data-tool={t[0]} title={t[1] + (t[2] ? ` (${t[2]})` : '')} aria-label={t[1]} aria-pressed={WB.tool === t[0]} onClick={() => pick(t[0])}>
          {t[0] === 'note' ? <span className="nico" style={{ ['--c' as string]: WB.opts.note }} /> : <Ic d={ICON[t[0] as keyof typeof ICON]} />}
          {HAS_OPTIONS.has(t[0]) && <i className="more" />}
        </button>
      ))}
    </nav>
  );
}

// ---------- a tool's options, above the toolbar ----------
const setOpt = <K extends keyof Opts>(k: K, v: Opts[K]) => { WB.opts[k] = v; emit('tool'); emit('ui'); };
function Swatches<K extends keyof Opts>({ k, list }: { k: K; list: string[] }) {
  return <div className="sws">{list.map(c => <button key={c} className={'swt' + (c === WB.opts[k] ? ' on' : '') + (c === 'transparent' ? ' none' : '')} style={{ ['--c' as string]: c }} aria-label={c === 'transparent' ? 'No fill' : c} onClick={() => setOpt(k, c as Opts[K])} />)}</div>;
}
function Seg<K extends keyof Opts>({ k, opts }: { k: K; opts: [Opts[K], React.ReactNode][] }) {
  return <div className="seg">{opts.map(([v, n]) => <button key={String(v)} className={WB.opts[k] === v ? 'on' : ''} onClick={() => setOpt(k, v)}>{n}</button>)}</div>;
}
export function Flyout() {
  useWB('ui', 'tool');
  const ref = useRef<HTMLDivElement>(null), t = UI.fly;
  useLayoutEffect(() => {
    const f = ref.current; if (!f || !t) return;
    const btn = document.querySelector(`.wbd .tools [data-tool="${t}"]`), bar = document.querySelector('.wbd .tools');
    if (!btn || !bar) return;
    const r = btn.getBoundingClientRect(), b = bar.getBoundingClientRect();
    f.style.left = clamp(r.left + r.width / 2 - f.offsetWidth / 2, 12, innerWidth - f.offsetWidth - 12) + 'px';
    f.style.top = b.top - f.offsetHeight - 10 + 'px';
  });
  if (!t) return null;
  let body: React.ReactNode = null;
  if (t === 'note') body = <><div className="ft">Sticky colour</div><Swatches k="note" list={PAL.note} /></>;
  else if (t === 'shape') body = <>
    <div className="ft">Shape</div>
    <div className="kinds">{SHAPES.map(k => <button key={k} className={k === WB.opts.shape ? 'on' : ''} title={SHAPE_NAME[k]} aria-label={SHAPE_NAME[k]} onClick={() => setOpt('shape', k)}><ShapeIcon k={k} /></button>)}</div>
    <div className="ft">Fill</div><Swatches k="fill" list={PAL.fill} />
  </>;
  else if (t === 'line') body = <>
    <div className="ft">Line</div><Seg k="line" opts={[['curve', 'Curved'], ['straight', 'Straight'], ['elbow', 'Elbow']]} />
    <div className="ft">Arrow</div><Seg k="arrow" opts={[['none', 'None'], ['end', 'End'], ['both', 'Both']]} />
  </>;
  else if (t === 'pen') body = <>
    <div className="ft">Pen colour</div><Swatches k="pen" list={PAL.ink} />
    <div className="ft">Size</div><Seg k="penW" opts={[2, 3, 6, 10].map(n => [n, <i key={n} className="dot" style={{ width: n + 2, height: n + 2 }} />])} />
  </>;
  else if (t === 'hl') body = <><div className="ft">Highlighter</div><Swatches k="hl" list={PAL.hl} /></>;
  else if (t === 'stamp') body = <>
    <div className="ft">Stamp <span>click the board to place it</span></div>
    <div className="stamps">{STAMPS.map(s => <button key={s} className={s === WB.opts.stamp ? 'on' : ''} title={stampOf(s).name} aria-label={stampOf(s).name} onClick={() => setOpt('stamp', s)}><StampArt k={s} s={26} /></button>)}</div>
  </>;
  return <div className="fly" ref={ref}>{body}</div>;
}

// ---------- the bar above what is selected ----------
/** set k to v on the selected objects of these types; a toggle turns k on unless every one has it already */
export function applySet(k: keyof Obj, v: unknown, types?: string[], opts: { toggle?: boolean } = {}) {
  if (opts.toggle) { const on = !selObjs().filter(o => !types || types.includes(o.type)).every(o => o[k]); patch({ [k]: on || undefined }, types); return; }
  const p: Partial<Obj> = { [k]: v };
  if (k === 'sw' && (v as number) > 0 && types?.includes('shape') && !selObjs().every(o => o.stroke)) p.stroke = '#1C1C1E';
  patch(p, types);
}
const CYCLE: Record<string, string[]> = { fs: ['s', 'm', 'l', 'xl'], kind: SHAPES, style: ['curve', 'straight', 'elbow'], arrow: ['end', 'both', 'none'] };
function cycle(o: Obj, k: 'fs' | 'kind' | 'style' | 'arrow') {
  const list = CYCLE[k], cur = (o[k] as string) || (k === 'fs' ? 'm' : list[0]);
  patch({ [k]: list[(list.indexOf(cur) + 1) % list.length] }, [o.type]);
}
function Dots({ k, list, types, cur }: { k: keyof Obj; list: string[]; types: string; cur?: string }) {
  return <>{list.map(v => <button key={v} className={'cdot' + (v === cur ? ' on' : '') + (v === 'transparent' ? ' none' : '')} style={{ ['--c' as string]: v }} aria-label={v === 'transparent' ? 'No fill' : v} onClick={() => applySet(k, v, types.split(','))} />)}</>;
}
export function CtxBar() {
  useWB('sel', 'change', 'cam', 'tool', 'edit', 'meta', 'board');
  const ref = useRef<HTMLDivElement>(null), sel = selObjs();
  const hidden = !sel.length || !canEdit() || !!I.editing || WB.tool !== 'select' || (sel.length === 1 && sel[0].type === 'comment');
  useLayoutEffect(() => {
    const c = ref.current; if (!c || hidden) return;
    const s = selObjs(); if (!s.length) return;
    const b = bounds(s), a = toScreen(b.x, b.y), z = WB.cam.z, w = c.offsetWidth, o = s[0];
    let top = a.y - c.offsetHeight - (s.length === 1 && !['section', 'line', 'poll'].includes(o.type) ? 44 : 14);
    if (top < 70) top = a.y + b.h * z + 16;
    const edge = innerWidth < 600 ? 8 : 70;   // a phone has no room to keep clear of the left edge
    c.style.left = Math.max(8, Math.min(Math.max(edge, a.x + b.w * z / 2 - w / 2), innerWidth - w - 8)) + 'px';
    c.style.top = clamp(top, 70, innerHeight - 60) + 'px';
  });
  if (hidden) return null;
  const o = sel[0], type = new Set(sel.map(x => x.type)).size === 1 ? o.type : null;
  const parts: React.ReactNode[] = [];
  const sep = (k: string) => <span key={k} className="csep" />;
  if (type === 'note') parts.push(<Dots key="d" k="color" list={PAL.note.slice(0, 7)} types="note" cur={o.color} />, sep('s1'), <button key="fs" className="cb" title="Text size" onClick={() => cycle(o, 'fs')}>Aa <small>{(o.fs || 'm').toUpperCase()}</small></button>);
  else if (type === 'shape') parts.push(<button key="k" className="cb" title="Change shape" onClick={() => cycle(o, 'kind')}><ShapeIcon k={o.kind} /></button>, sep('s1'), <Dots key="d" k="fill" list={PAL.fill.slice(0, 7)} types="shape" cur={o.fill} />);
  else if (type === 'text') parts.push(<Dots key="d" k="color" list={PAL.ink.slice(0, 6)} types="text" cur={o.color || '#1C1C1E'} />, sep('s1'),
    <button key="b" className={'cb' + (o.bold ? ' on' : '')} aria-label="Bold" onClick={() => applySet('bold', null, ['text'], { toggle: true })}><b>B</b></button>,
    <button key="fs" className="cb" title="Text size" onClick={() => cycle(o, 'fs')}>Aa <small>{(o.fs || 'l').toUpperCase()}</small></button>);
  else if (type === 'line') parts.push(
    <button key="st" className="cb" title="Line style" onClick={() => cycle(o, 'style')}>{({ curve: 'Curved', straight: 'Straight', elbow: 'Elbow' } as Record<string, string>)[o.style || 'curve']}</button>,
    <button key="ar" className="cb" title="Arrows" aria-label="Arrows" onClick={() => cycle(o, 'arrow')}><Ic d={o.arrow === 'end' ? ICON.arrowEnd : o.arrow === 'both' ? ICON.arrowBoth : ICON.arrowNone} s={18} /></button>,
    sep('s1'), <Dots key="d" k="color" list={PAL.ink.slice(0, 6)} types="line" cur={o.color} />);
  else if (type === 'ink') parts.push(<Dots key="d" k="color" list={(o.hl ? PAL.hl : PAL.ink).slice(0, 6)} types="ink" cur={o.color} />);
  else if (type === 'section') parts.push(<Dots key="d" k="color" list={PAL.section} types="section" cur={o.color} />);
  else if (type === 'link') parts.push(<button key="op" className="cb" onClick={() => openLink(o.url)}><Ic d={ICON.open} s={16} /> Open</button>);
  else if (type === 'stamp') parts.push(...STAMPS.slice(0, 6).map(s => <button key={s} className={'cb em' + (s === o.emoji ? ' on' : '')} title={stampOf(s).name} aria-label={stampOf(s).name} onClick={() => applySet('emoji', s, ['stamp'])}><StampArt k={s} s={20} /></button>));
  if (sel.length > 1) parts.push(sel.some(x => x.g) ? <button key="ug" className="cb" onClick={ungroup}>Ungroup</button> : <button key="g" className="cb" onClick={group}>Group</button>);
  if (parts.length) parts.push(sep('s2'));
  parts.push(
    <button key="dup" className="cb" title="Duplicate (Ctrl+D)" aria-label="Duplicate" onClick={duplicate}><Ic d={ICON.dup} s={17} /></button>,
    <button key="del" className="cb" title="Delete" aria-label="Delete" onClick={del}><Ic d={ICON.trash} s={17} /></button>,
    <button key="more" className="cb" title="More options" aria-label="More options" onClick={e => more(e.currentTarget)}><Ic d={ICON.more} s={17} /></button>,
  );
  return <div className="ctx" ref={ref}>{parts}</div>;
}
