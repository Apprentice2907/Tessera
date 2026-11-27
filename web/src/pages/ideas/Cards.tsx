// Tessera · Ideas board — the cards that open over the canvas: the options card (for a selection, or for the board
// with its versions), the menus, comment threads, the link and label forms, the dialogs, and the boards drawer.
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from '../../store/ui';
import {
  WB, act, canEdit, clamp, createBoard, deleteBoard, duplicateBoard, emit, fit, folders, getBoard, index, moveBoard,
  openBoard, renameBoard, restoreVersion, role, selObjs, setFolders, setMeta, setTool, select, update, useWB, versions, zoomMid, PEOPLE,
} from './core';
import { PAL, SHAPES, SHAPE_NAME, STAMPS, stampOf } from './draw';
import { TEMPLATES, addChild, addLink, comments, exportBoard, insertTemplate, openLink, pollHeight } from './extras';
import { align, copy, del, duplicate, group, lock, order, paste, saveVersion, ungroup, addSticky } from './input';
import { applySet } from './Chrome';
import {
  UI, ask, boardOptions, closeModal, closePops, confirmBox, folderPop, newComment, thread, toggleDrawer, type PopSpec,
} from './pops';
import { AL, APP, ICON, Ic, ShapeIcon, StampArt } from './Icons';
import type { Obj, ObjType } from './types';

const css = (o: Record<string, string | number | undefined>) => o as CSSProperties;
export const timeAgo = (t: number) => { const s = (Date.now() - t) / 1000; return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
const TYPE_NAME: Record<ObjType, string> = { note: 'Sticky note', text: 'Text', shape: 'Shape', line: 'Connector', ink: 'Drawing', image: 'Image', link: 'Link', section: 'Section', stamp: 'Stamp', comment: 'Comment', poll: 'Poll' };
const ALIGN: Record<string, string> = { l: 'Align left', c: 'Align centre', r: 'Align right', t: 'Align top', m: 'Align middle', b: 'Align bottom', dh: 'Space evenly across', dv: 'Space evenly down' };
const Avatar = ({ name, sm }: { name: string; sm?: boolean }) => <span className={'av' + (sm ? ' sm' : '')} style={css({ '--c': PEOPLE[name] || '#8E8E93' })} title={name}>{(name || '?')[0]}</span>;

/** an input that saves when you leave it (or press Enter), and shows the saved value again when that changes */
function Field({ value, onSave, ...rest }: { value: string | number; onSave: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'>) {
  return (
    <input key={String(value)} defaultValue={value} {...rest}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key !== 'Escape') e.stopPropagation(); }}
      onBlur={e => { if (e.currentTarget.value !== String(value)) onSave(e.currentTarget.value); }} />
  );
}

// ---------- a card: placed by its anchor or a point, kept on screen; Esc closes it ----------
function Pop({ spec, cls, children }: { spec: PopSpec; cls: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const p = ref.current; if (!p) return;
    const w = p.offsetWidth, h = p.offsetHeight; let l = spec.x ?? 0, t = spec.y ?? 0;
    if (spec.anchor) {
      const r = spec.anchor.getBoundingClientRect();
      if (spec.place === 'above') { l = r.left; t = r.top - h - 10; }
      else { l = spec.place === 'below-right' ? r.right - w : r.left + r.width / 2 - w / 2; t = r.bottom + 8; }
    }
    p.style.left = clamp(l, 8, innerWidth - w - 8) + 'px'; p.style.top = clamp(t, 8, innerHeight - h - 8) + 'px';
  }, [spec.n]); // placed once, when it opens
  return <div ref={ref} className={'bpop ' + cls} data-float="" role="dialog" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); closePops(); } }}>{children}</div>;
}

// ---------- the options card ----------
const Sec = ({ t, children }: { t?: string; children: ReactNode }) => <div className="psec">{t && <div className="pt">{t}</div>}{children}</div>;
function Sws({ k, list, types, cur }: { k: keyof Obj; list: string[]; types: string; cur?: string }) {
  return <div className="sws">{list.map(c => <button key={c} className={'swt' + (c === cur ? ' on' : '') + (c === 'transparent' ? ' none' : '')} style={css({ '--c': c })} aria-label={c === 'transparent' ? 'No fill' : c} onClick={() => applySet(k, c, types.split(','))} />)}</div>;
}
function Seg({ k, opts, types, cur }: { k: keyof Obj; opts: [string | number, ReactNode][]; types: string; cur: string | number }) {
  return <div className="seg">{opts.map(([v, n]) => <button key={String(v)} className={String(cur) === String(v) ? 'on' : ''} onClick={() => applySet(k, v, types.split(','))}>{n}</button>)}</div>;
}
const Toggle = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => <button className={'tog' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={onClick}><i />{children}</button>;
const edit = (o: Obj, k: keyof Obj, v: unknown, label = 'Edit ' + k) => act(label, () => update(o.id, { [k]: v }));

function BoardCard() {
  useWB('board', 'meta', 'change', 'versions');
  const b = WB.board; if (!b) return null;
  const st = b.meta.settings || {}, counts: Partial<Record<ObjType, number>> = {}, vs = versions(), owner = canEdit();
  Object.values(WB.objs).forEach(o => { counts[o.type] = (counts[o.type] || 0) + 1; });
  const set = (p: object) => setMeta({ settings: { ...st, ...p } });
  const restore = async (i: number) => {
    const v = vs[i]; if (!v) return;
    if (await confirmBox(`Restore “${v.label}” from ${timeAgo(v.t)}?`, 'Restore', false, 'The board goes back to how it was then. You can undo this.')) { restoreVersion(i); toast('Version restored'); }
  };
  return <>
    <div className="phead"><b>{b.name}</b><small>{Object.keys(WB.objs).length} objects</small></div>
    {owner && <Sec t="Background"><div className="bgs">{([['paper', '#F2F1ED'], ['white', '#FFFFFF'], ['warm', '#F6EFE3'], ['dark', '#1F1F23']] as const).map(([k, c]) => <button key={k} className={(st.bg || 'paper') === k ? 'on' : ''} data-v={k} style={css({ '--c': c })} onClick={() => set({ bg: k })}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div></Sec>}
    {owner && <Sec t="Canvas"><Toggle on={st.grid !== false} onClick={() => set({ grid: st.grid === false })}>Dot grid</Toggle><Toggle on={st.snap !== false} onClick={() => set({ snap: st.snap === false })}>Snap to other objects</Toggle></Sec>}
    <Sec t="On this board"><div className="counts">{Object.entries(counts).map(([k, n]) => { const t = TYPE_NAME[k as ObjType]; return <span key={k}>{n} {t.toLowerCase()}{n! > 1 && !/s$/.test(t) ? 's' : ''}</span>; })}{!Object.keys(counts).length && <span>Nothing yet</span>}</div></Sec>
    <Sec t="Versions">
      <p className="pnote">Kept in this browser: one every couple of minutes while you work, and one whenever you press Ctrl S.</p>
      {owner && <button className="pbt" onClick={() => { saveVersion(); toast('Version saved'); }}>Save a version now</button>}
      <div className="vers">{vs.map((v, i) => (
        <div key={v.t + ':' + i} className="vrow">
          <span><b>{v.label}</b><small>{timeAgo(v.t)} · {v.count} object{v.count === 1 ? '' : 's'}{v.by && v.by !== WB.me.name ? ' · ' + v.by : ''}</small></span>
          {owner && <button className="pbt" onClick={() => restore(i)}>Restore</button>}
        </div>
      ))}{!vs.length && <p className="pnote">None yet. The first is saved when you change something.</p>}</div>
    </Sec>
    <Sec t="Shortcuts"><div className="keys">{[['V', 'Select'], ['H / Space', 'Pan'], ['N', 'Sticky'], ['T', 'Text'], ['S', 'Shape'], ['L', 'Connector'], ['P / M', 'Pen / highlighter'], ['F', 'Section'], ['E', 'Stamp'], ['C', 'Comment'], ['K', 'Link'], ['B', 'Boards'], ['Tab', 'Mind-map branch'], ['Ctrl D', 'Duplicate'], ['Ctrl G', 'Group'], ['Ctrl S', 'Save a version'], ['Shift 1', 'Fit board'], ['1–7', 'Pages']].map(([k, n]) => <span key={k}><kbd>{k}</kbd>{n}</span>)}</div></Sec>
  </>;
}

function SelCard() {
  useWB('sel', 'change', 'meta', 'board');
  const sel = selObjs();
  if (!sel.length) return null;
  const o = sel[0], one = sel.length === 1, type = new Set(sel.map(x => x.type)).size === 1 ? o.type : null;
  const head = <div className="phead"><b>{one ? TYPE_NAME[o.type] : sel.length + ' objects'}</b>{one && o.by && <small>added by {o.by}</small>}</div>;
  if (!canEdit()) return <>{head}<p className="pnote">You can view and comment on this board.</p></>;
  const out: ReactNode[] = [];
  if (type === 'note') out.push(<Sec key="c" t="Colour"><Sws k="color" list={PAL.note} types="note" cur={o.color} /></Sec>);
  if (type === 'shape') out.push(
    <Sec key="k" t="Shape"><div className="kinds">{SHAPES.map(k => <button key={k} className={k === o.kind ? 'on' : ''} title={SHAPE_NAME[k]} aria-label={SHAPE_NAME[k]} onClick={() => applySet('kind', k, ['shape'])}><ShapeIcon k={k} /></button>)}</div></Sec>,
    <Sec key="f" t="Fill"><Sws k="fill" list={PAL.fill} types="shape" cur={o.fill} /></Sec>,
    <Sec key="b" t="Border"><Seg k="sw" opts={[[0, 'None'], [2, 'Thin'], [4, 'Thick']]} types="shape" cur={o.sw || 0} />{!!o.sw && <Sws k="stroke" list={PAL.ink} types="shape" cur={o.stroke} />}</Sec>);
  if (type === 'text') out.push(<Sec key="c" t="Colour"><Sws k="color" list={PAL.ink} types="text" cur={o.color || '#1C1C1E'} /></Sec>);
  if (type === 'section') out.push(...(one ? [<Sec key="t" t="Title"><Field value={o.text || ''} aria-label="Title" onSave={v => edit(o, 'text', v)} /></Sec>] : []), <Sec key="c" t="Colour"><Sws k="color" list={PAL.section} types="section" cur={o.color} /></Sec>);
  if (type === 'ink') out.push(<Sec key="c" t="Colour"><Sws k="color" list={o.hl ? PAL.hl : PAL.ink} types="ink" cur={o.color} /></Sec>,
    <Sec key="w" t="Width"><Seg k="sw" opts={o.hl ? [[12, 'Thin'], [18, 'Medium'], [28, 'Wide']] : [[2, 'Fine'], [3, 'Normal'], [6, 'Bold'], [10, 'Marker']]} types="ink" cur={o.sw || 3} /></Sec>);
  if (type === 'line') {
    out.push(<Sec key="s" t="Style"><Seg k="style" opts={[['curve', 'Curved'], ['straight', 'Straight'], ['elbow', 'Elbow']]} types="line" cur={o.style || 'curve'} /></Sec>,
      <Sec key="a" t="Arrows"><Seg k="arrow" opts={[['none', 'None'], ['end', 'End'], ['both', 'Both']]} types="line" cur={o.arrow || 'none'} /></Sec>,
      <Sec key="c" t="Colour"><Sws k="color" list={PAL.ink} types="line" cur={o.color} /></Sec>,
      <Sec key="w" t="Width"><Seg k="sw" opts={[[1, 'Thin'], [2, 'Normal'], [4, 'Thick']]} types="line" cur={o.sw || 2} /></Sec>,
      <Sec key="d"><Toggle on={!!o.dash} onClick={() => applySet('dash', null, ['line'], { toggle: true })}>Dashed</Toggle></Sec>);
    if (one) out.push(<Sec key="l" t="Label"><Field value={o.text || ''} placeholder="Yes, No, then…" aria-label="Label" onSave={v => edit(o, 'text', v)} /></Sec>);
  }
  if (type === 'stamp') out.push(<Sec key="st" t="Stamp"><div className="stamps">{STAMPS.map(s => <button key={s} className={stampOf(s).key === stampOf(o.emoji).key ? 'on' : ''} title={stampOf(s).name} aria-label={stampOf(s).name} onClick={() => applySet('emoji', s, ['stamp'])}><StampArt k={s} s={26} /></button>)}</div></Sec>);
  if (type === 'link' && one) out.push(<Sec key="ln" t="Link">
    <Field value={o.url || ''} aria-label="Address" onSave={v => edit(o, 'url', v)} />
    <Field value={o.title || ''} aria-label="Title" onSave={v => edit(o, 'title', v)} />
    <button className="pbt" onClick={() => openLink(o.url)}><Ic d={ICON.open} s={15} />Open link</button>
  </Sec>);
  if (type === 'image' && one) out.push(<Sec key="im" t="Image"><p className="pnote">{Math.round(o.w)} × {Math.round(o.h)}. Corners keep the shape; hold Shift to stretch.</p></Sec>);
  if (type === 'poll' && one) {
    const opts = o.opts || [];
    out.push(<Sec key="q" t="Question"><Field value={o.q || ''} aria-label="Question" onSave={v => edit(o, 'q', v)} /></Sec>,
      <Sec key="o" t="Options">
        {opts.map((p, i) => <div key={i} className="optrow">
          <Field value={p.t} aria-label={`Option ${i + 1}`} onSave={v => act('Edit option', () => update(o.id, { opts: opts.map((q, j) => j === i ? { ...q, t: v } : q) }))} />
          <span>{Object.keys(p.v || {}).length}</span>
          {opts.length > 2 && <button title="Remove option" aria-label="Remove option" onClick={() => act('Remove option', () => update(o.id, { opts: opts.filter((_, j) => j !== i), h: pollHeight(opts.length - 1) }))}><Ic d={ICON.x} s={14} /></button>}
        </div>)}
        <div className="pbrow">
          {opts.length < 6 && <button className="pbt" onClick={() => act('Add option', () => update(o.id, { opts: [...opts, { t: 'Option ' + String.fromCharCode(65 + opts.length), v: {} }], h: pollHeight(opts.length + 1) }))}>Add an option</button>}
          <button className="pbt" onClick={() => act('Reset poll', () => update(o.id, { opts: opts.map(p => ({ ...p, v: {} })) }))}>Reset votes</button>
        </div>
      </Sec>);
  }
  if (type === 'comment' && one) out.push(<Sec key="th"><button className="pbt" onClick={() => thread(o.id)}>Open thread</button></Sec>);
  if (sel.some(x => ['note', 'text', 'shape'].includes(x.type))) {
    const al = o.align || (o.type === 'text' ? 'left' : 'center'), tt = ['note', 'text', 'shape'];
    out.push(<Sec key="tx" t="Text">
      <Seg k="fs" opts={[['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]} types="note,text,shape" cur={o.fs || 'm'} />
      <div className="seg">
        {([['left', 'l'], ['center', 'c'], ['right', 'r']] as const).map(([v, k]) => <button key={v} className={al === v ? 'on' : ''} title={'Text ' + v} aria-label={'Text ' + v} onClick={() => applySet('align', v, tt)}><Ic d={AL[k]} s={16} /></button>)}
        <button className={o.bold ? 'on' : ''} title="Bold" aria-label="Bold" onClick={() => applySet('bold', null, ['text', 'shape'], { toggle: true })}><b>B</b></button>
      </div>
    </Sec>);
  }
  if (one && o.type !== 'line') out.push(<Sec key="pos" t="Position"><div className="xywh">{([['x', 'X'], ['y', 'Y'], ['w', 'W'], ['h', 'H'], ['r', '°']] as const).map(([k, n]) => (
    <label key={k}><span>{n}</span><Field type="number" value={Math.round((o[k] as number) || 0)} disabled={o.locked}
      onSave={v => { const x = +v; if (!isFinite(x) || v === '') return; act('Edit ' + k.toUpperCase(), () => update(o.id, { [k]: k === 'w' || k === 'h' ? Math.max(4, x) : x })); }} /></label>
  ))}</div></Sec>);
  if (sel.filter(x => x.type !== 'line').length > 1) out.push(<Sec key="al" t="Align"><div className="algn">{Object.keys(ALIGN).map(a => <button key={a} title={ALIGN[a]} aria-label={ALIGN[a]} onClick={() => align(a)}><Ic d={AL[a]} s={17} /></button>)}</div></Sec>);
  out.push(<Sec key="ar" t="Arrange"><div className="acts">
    <button onClick={() => order('front')}>To front</button><button onClick={() => order('up')}>Forward</button><button onClick={() => order('down')}>Backward</button><button onClick={() => order('back')}>To back</button>
    {sel.length > 1 && <button onClick={group}>Group</button>}{sel.some(x => x.g) && <button onClick={ungroup}>Ungroup</button>}
    <button onClick={lock}>{sel.every(x => x.locked) ? 'Unlock' : 'Lock'}</button><button onClick={duplicate}>Duplicate</button><button className="red" onClick={del}>Delete</button>
  </div></Sec>);
  return <>{head}{out}</>;
}
function PropsCard({ spec }: { spec: PopSpec }) {
  useWB('sel');
  const gone = !spec.board && !WB.sel.size;
  useEffect(() => { if (gone) closePops(); });
  if (gone) return null;
  return <Pop spec={spec} cls="props"><div className="pbody">{spec.board ? <BoardCard /> : <SelCard />}</div></Pop>;
}

// ---------- menus ----------
function NavMenu({ spec }: { spec: PopSpec }) {
  return <Pop spec={spec} cls="navpop"><div className="navm">{APP.map(([k, n, d], i) => (
    <button key={k} className={k === 'ideas' ? 'on' : ''} aria-current={k === 'ideas' ? 'page' : undefined} onClick={() => { closePops(); if (k !== 'ideas') UI.go(k); }}><Ic d={d} /><span>{n}</span><kbd>{i + 1}</kbd></button>
  ))}</div></Pop>;
}
function ZoomMenu({ spec }: { spec: PopSpec }) {
  const grid = WB.board?.meta.settings?.grid !== false;
  const run = (f: () => void) => () => { closePops(); f(); };
  return <Pop spec={spec} cls=""><div className="menu">
    {([[.25, '25%'], [.5, '50%'], [1, '100%'], [2, '200%']] as const).map(([z, n]) => <button key={z} onClick={run(() => zoomMid(z / WB.cam.z))}>{n}</button>)}
    <hr />
    <button onClick={run(() => fit())}>Fit board<kbd>Shift 1</kbd></button>
    <button disabled={!WB.sel.size} onClick={run(() => fit([...WB.sel], 2))}>Fit selection<kbd>Shift 2</kbd></button>
    <hr />
    <button onClick={run(() => { const st = WB.board?.meta.settings || {}; setMeta({ settings: { ...st, grid: st.grid === false } }); })}>Dot grid<kbd>{grid ? 'On' : 'Off'}</kbd></button>
  </div></Pop>;
}
function ExportCard({ spec }: { spec: PopSpec }) {
  useWB('ui', 'sel');
  const set = (p: Partial<typeof UI>) => { Object.assign(UI, p); emit('ui'); };
  return <Pop spec={spec} cls="exp">
    <div className="ph">Export</div>
    <div className="seg full">{(['png', 'svg', 'pdf'] as const).map(f => <button key={f} className={UI.fmt === f ? 'on' : ''} onClick={() => set({ fmt: f })}>{f.toUpperCase()}</button>)}</div>
    <div className="seg full">{([['board', 'Whole board'], ['sel', 'Selection']] as const).map(([k, n]) => <button key={k} className={UI.scope === k ? 'on' : ''} disabled={k === 'sel' && !WB.sel.size} onClick={() => set({ scope: k })}>{n}</button>)}</div>
    <p className="pnote">PNG and PDF at 2× for sharp text. Comments are left out.</p>
    <button className="btn dark wide" onClick={() => { closePops(); exportBoard(UI.fmt, UI.scope === 'sel' && WB.sel.size > 0); }}>Export {UI.fmt.toUpperCase()}</button>
  </Pop>;
}
function FolderMenu({ spec }: { spec: PopSpec }) {
  const id = spec.id!, cur = (id === WB.board?.id ? WB.board : getBoard(id))?.folder;
  const pick = async (f: string | null) => {
    closePops();
    if (f === null) { f = await ask('New folder', '', 'Create', 'e.g. KamiLabs'); if (!f) return; if (!folders().includes(f)) setFolders([...folders(), f]); }
    moveBoard(id, f); toast(`Moved to ${f}`);
  };
  return <Pop spec={spec} cls=""><div className="ph">Move to folder</div><div className="menu">
    {folders().map(f => <button key={f} onClick={() => pick(f)}><Ic d={ICON.folder} s={16} />{f}{f === cur && <span className="mck"><Ic d={ICON.check} s={15} /></span>}</button>)}
    <hr /><button onClick={() => pick(null)}><Ic d={ICON.plus} s={16} />New folder…</button>
  </div></Pop>;
}
type Item = [key: string, label: string, keys: string] | 0 | false | undefined;
function CtxMenu({ spec }: { spec: PopSpec }) {
  const o = spec.id ? WB.objs[spec.id] : undefined, edit = canEdit(), sel = selObjs(), at = spec.at!;
  const items: Item[] = o ? [
    edit && ['dup', 'Duplicate', 'Ctrl D'], ['copy', 'Copy', 'Ctrl C'], edit && ['paste', 'Paste here', 'Ctrl V'], 0,
    edit && ['front', 'Bring to front', 'Ctrl ]'], edit && ['back', 'Send to back', 'Ctrl ['],
    edit && sel.length > 1 && ['group', 'Group', 'Ctrl G'], edit && sel.some(s => s.g) && ['ungroup', 'Ungroup', 'Ctrl Shift G'],
    edit && ['lock', sel.every(s => s.locked) ? 'Unlock' : 'Lock', 'Ctrl L'],
    edit && sel.length === 1 && ['note', 'text', 'shape'].includes(o.type) && ['branch', 'Add branch', 'Tab'],
    ['comment', 'Comment here', ''], 0, edit && ['del', 'Delete', 'Del'],
  ] : [edit && ['paste', 'Paste here', 'Ctrl V'], edit && ['note', 'Add sticky here', ''], ['comment', 'Comment here', ''], ['all', 'Select all', 'Ctrl A'], 0, ['fit', 'Fit board', 'Shift 1'], ['opts', 'Board options', '']];
  const list = items.filter((it, i, arr) => it || (i > 0 && arr[i - 1] && i < arr.length - 1));
  const run = (m: string) => {
    closePops();
    if (m === 'dup') duplicate(); else if (m === 'copy') { copy(false); toast('Copied'); } else if (m === 'paste') paste(WB.clip, { at });
    else if (m === 'front') order('front'); else if (m === 'back') order('back'); else if (m === 'group') group(); else if (m === 'ungroup') ungroup();
    else if (m === 'lock') lock(); else if (m === 'branch' && o) addChild(o.id); else if (m === 'del') del();
    else if (m === 'comment') newComment(at, spec.x!, spec.y!); else if (m === 'all') select(Object.keys(WB.objs)); else if (m === 'fit') fit();
    else if (m === 'note') addSticky(at);
    else if (m === 'opts') boardOptions(spec.x!, spec.y!);
  };
  return <Pop spec={spec} cls="cmenu"><div className="menu">{list.map((it, i) => !it ? <hr key={'h' + i} /> : (
    <button key={it[0]} className={it[0] === 'del' ? 'red' : ''} disabled={it[0] === 'paste' && !WB.clip} onClick={() => run(it[0])}>{it[1]}{it[2] && <kbd>{it[2]}</kbd>}</button>
  ))}</div></Pop>;
}

// ---------- comments ----------
function Thread({ spec }: { spec: PopSpec }) {
  useWB('change');
  const o = spec.id ? WB.objs[spec.id] : undefined, inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!o) closePops(); });
  useEffect(() => { setTimeout(() => inp.current?.focus(), 20); }, [spec.n]);
  if (!o) return null;
  const t = o.thread || [], canDel = t[0]?.by === WB.me.name || role() === 'owner';
  return <Pop spec={spec} cls="thread">
    <div className="th-head"><b>Comment</b>
      <button className="ib s" title={o.resolved ? 'Reopen' : 'Resolve'} aria-label={o.resolved ? 'Reopen' : 'Resolve'} onClick={() => { comments.resolve(o.id); closePops(); }}><Ic d={ICON.check} s={16} /></button>
      {canDel && <button className="ib s" title="Delete thread" aria-label="Delete thread" onClick={() => { comments.remove(o.id); closePops(); }}><Ic d={ICON.trash} s={16} /></button>}
      <button className="ib s" aria-label="Close" onClick={closePops}><Ic d={ICON.x} s={16} /></button>
    </div>
    {o.resolved && <div className="th-res">Resolved</div>}
    <div className="th-list">{t.map((m, i) => <div key={i} className="msg"><Avatar name={m.by} sm /><div><b>{m.by}</b><small>{timeAgo(m.at)}</small><p>{m.text}</p></div></div>)}</div>
    <form className="th-form" onSubmit={e => { e.preventDefault(); const v = inp.current!.value.trim(); if (!v) return; comments.reply(o.id, v); inp.current!.value = ''; inp.current!.focus(); }}>
      <input ref={inp} placeholder="Reply…" aria-label="Reply" autoComplete="off" /><button className="ib s dark" aria-label="Send"><Ic d={ICON.send} s={16} /></button>
    </form>
  </Pop>;
}
function NewComment({ spec }: { spec: PopSpec }) {
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inp.current?.focus(), 20); }, [spec.n]);
  return <Pop spec={spec} cls="thread newc">
    <form className="th-form new" onSubmit={e => {
      e.preventDefault(); const v = inp.current!.value.trim(); if (!v) return;
      const o = comments.create(spec.at!.x, spec.at!.y, v); closePops(); setTool('select');
      if (o) { select([o.id]); thread(o.id); }
    }}>
      <Avatar name={WB.me.name} sm /><input ref={inp} placeholder="Add a comment…" aria-label="Comment" autoComplete="off" /><button className="ib s dark" aria-label="Post"><Ic d={ICON.send} s={16} /></button>
    </form>
  </Pop>;
}
function OneLineForm({ spec, title, value = '', placeholder, ok, onDone }: { spec: PopSpec; title: string; value?: string; placeholder: string; ok: string; onDone: (v: string) => void }) {
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => { inp.current?.focus(); inp.current?.select(); }, 20); }, [spec.n]);
  return <Pop spec={spec} cls="linkp">
    <form className="lform" onSubmit={e => { e.preventDefault(); onDone(inp.current!.value); }}>
      <div className="ph">{title}</div><input ref={inp} defaultValue={value} placeholder={placeholder} aria-label={title} autoComplete="off" /><button className="btn dark">{ok}</button>
    </form>
  </Pop>;
}

/** whichever card is open */
export function Pops() {
  useWB('ui');
  const s = UI.pop; if (!s) return null;
  if (s.kind === 'props') return <PropsCard key={s.n} spec={s} />;
  if (s.kind === 'nav') return <NavMenu key={s.n} spec={s} />;
  if (s.kind === 'zoom') return <ZoomMenu key={s.n} spec={s} />;
  if (s.kind === 'export') return <ExportCard key={s.n} spec={s} />;
  if (s.kind === 'folder') return <FolderMenu key={s.n} spec={s} />;
  if (s.kind === 'cmenu') return <CtxMenu key={s.n} spec={s} />;
  if (s.kind === 'thread') return <Thread key={s.n} spec={s} />;
  if (s.kind === 'newc') return <NewComment key={s.n} spec={s} />;
  if (s.kind === 'link') return <OneLineForm key={s.n} spec={s} title="Add a link" placeholder="Paste a link: YouTube, Figma, any site" ok="Add"
    onDone={v => { if (!v.trim()) return; closePops(); addLink(v, s.at); setTool('select'); }} />;
  if (s.kind === 'label') { const l = WB.objs[s.id!]; if (!l) return null; return <OneLineForm key={s.n} spec={s} title="Label" value={l.text || ''} placeholder="Yes, No, then…" ok="Save"
    onDone={v => { closePops(); act('Label connector', () => update(l.id, { text: v.trim() })); }} />; }
  return null;
}

// ---------- dialogs: confirm, a name, templates ----------
const TPL_ART: Record<string, string> = {
  brainstorm: '<rect x="6" y="8" width="88" height="54" rx="8" fill="#FFF7DD" stroke="#00000012"/>' + [0, 1, 2, 3].map(i => `<rect x="${12 + i * 20}" y="20" width="16" height="16" rx="3" fill="${['#FFE380', '#FFC27A', '#FFB3D1', '#CFC2FF'][i]}"/><rect x="${12 + i * 20}" y="40" width="16" height="16" rx="3" fill="${['#A9D8FF', '#A8EBBB', '#FFE380', '#FFC27A'][i]}"/>`).join(''),
  mindmap: '<path d="M50 35 C64 35 62 16 76 16 M50 35 C64 35 64 35 76 35 M50 35 C64 35 62 54 76 54 M50 35 C36 35 36 35 24 35" stroke="#1C1C1E" stroke-width="1.4" fill="none"/><rect x="36" y="27" width="28" height="16" rx="6" fill="#7B61FF"/><rect x="74" y="10" width="20" height="12" rx="3" fill="#A9D8FF"/><rect x="74" y="29" width="20" height="12" rx="3" fill="#A8EBBB"/><rect x="74" y="48" width="20" height="12" rx="3" fill="#FFC27A"/><rect x="6" y="29" width="20" height="12" rx="3" fill="#FFB3D1"/>',
  flowchart: '<ellipse cx="14" cy="35" rx="10" ry="6" fill="#A8EBBB"/><rect x="32" y="28" width="20" height="14" rx="3" fill="#A9D8FF"/><path d="M68 25 L78 35 L68 45 L58 35 Z" fill="#FFE380"/><ellipse cx="91" cy="35" rx="7" ry="5" fill="#A8EBBB"/><path d="M24 35H32M52 35H58M78 35H84" stroke="#1C1C1E" stroke-width="1.4"/>',
  retro: ['#EAF9EE', '#FFF0E3', '#F4F1FF'].map((c, i) => `<rect x="${6 + i * 30}" y="8" width="27" height="54" rx="5" fill="${c}" stroke="#00000012"/><rect x="${10 + i * 30}" y="20" width="12" height="12" rx="2" fill="${['#A8EBBB', '#FFC27A', '#CFC2FF'][i]}"/>`).join(''),
  kanban: ['#F2F2F4', '#EAF5FF', '#EAF9EE'].map((c, i) => `<rect x="${6 + i * 30}" y="8" width="27" height="54" rx="5" fill="${c}" stroke="#00000012"/><rect x="${9 + i * 30}" y="18" width="21" height="10" rx="2" fill="${['#FFE380', '#A9D8FF', '#A8EBBB'][i]}"/>${i === 0 ? '<rect x="9" y="31" width="21" height="10" rx="2" fill="#FFE380"/>' : ''}`).join(''),
  weekly: [0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${5 + i * 13}" y="10" width="11" height="50" rx="3" fill="${PAL.section[i]}" stroke="#00000012"/><rect x="${6 + i * 13}" y="18" width="9" height="9" rx="2" fill="${PAL.note[i % 6]}"/>`).join(''),
};
function ModalBody() {
  const m = UI.modal!, inp = useRef<HTMLInputElement>(null), okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setTimeout(() => { if (inp.current) { inp.current.focus(); inp.current.select(); } else okRef.current?.focus(); }, 30); }, [m.n]);
  const finish = (v: boolean | string | null) => {
    closeModal();
    if (m.kind === 'confirm') m.done(!!v); else if (m.kind === 'ask') m.done(typeof v === 'string' ? v.trim() || null : null);
  };
  if (m.kind === 'templates') return <>
    <div className="mh"><h3>Templates</h3><button className="ib" aria-label="Close" onClick={closeModal}><Ic d={ICON.x} /></button></div>
    <p className="msub">Dropped in the middle of your view, ready to edit. Undo takes it away again.</p>
    <div className="tpls">{Object.entries(TEMPLATES).map(([k, t]) => (
      <button key={k} className="tpl" style={css({ '--t': t.tint })} onClick={() => { closeModal(); insertTemplate(k); }}>
        <svg viewBox="0 0 100 70" aria-hidden="true" dangerouslySetInnerHTML={{ __html: TPL_ART[k] || '' }} /><b>{t.name}</b><small>{t.sub}</small>
      </button>
    ))}</div>
  </>;
  if (m.kind === 'confirm') return <>
    <h3>{m.title}</h3>{m.sub && <p className="msub">{m.sub}</p>}
    <div className="mfoot"><button className="btn" onClick={() => finish(false)}>Cancel</button><button ref={okRef} className={'btn ' + (m.danger ? 'red' : 'dark')} onClick={() => finish(true)}>{m.ok}</button></div>
  </>;
  return <>
    <h3>{m.title}</h3>
    <form className="mform" onSubmit={e => { e.preventDefault(); finish(inp.current!.value); }}>
      <input ref={inp} defaultValue={m.value} placeholder={m.placeholder} aria-label={m.title} />
      <div className="mfoot"><button type="button" className="btn" onClick={() => finish(null)}>Cancel</button><button className="btn dark">{m.ok}</button></div>
    </form>
  </>;
}
export function Modal() {
  useWB('ui');
  const m = UI.modal;
  const dismiss = () => { const cur = UI.modal; closeModal(); if (cur?.kind === 'confirm') cur.done(false); else if (cur?.kind === 'ask') cur.done(null); };
  return (
    <AnimatePresence>
      {m && <motion.div key={m.n} className="mback" data-float="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }}
        onPointerDown={e => { if (e.target === e.currentTarget) dismiss(); }}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); dismiss(); } }}>
        <motion.div className={'modal ' + (m.kind === 'templates' ? 'wide' : 'small')} role="dialog" aria-modal="true"
          initial={{ opacity: 0, y: 6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: .98 }} transition={{ duration: .18, ease: [0.25, 0.8, 0.25, 1] }}>
          <ModalBody />
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  );
}

// ---------- the boards drawer: folders, new, rename, duplicate, move, delete ----------
const swatchOf = (id: string) => PAL.note[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 6];
function DrawerBody() {
  useWB('index', 'board', 'ui');
  const idx = index(), fs = folders(), q = UI.dq.toLowerCase(), cur = WB.board?.id;
  const groups = fs.map(f => [f, idx.filter(b => (fs.includes(b.folder) ? b.folder : fs[0]) === f && b.name.toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated)] as const);
  const newBoard = async () => { const n = await ask('New board', 'Untitled board', 'Create'); if (!n) return; const nb = createBoard(n, WB.board?.folder || folders()[0]); openBoard(nb.id); toast('Board created'); };
  const newFolder = async () => { const n = await ask('New folder', '', 'Create', 'e.g. KamiLabs'); if (n && !folders().includes(n)) setFolders([...folders(), n]); };
  const renameFolder = async (old: string) => {
    const n = await ask('Rename folder', old, 'Rename'); if (!n || n === old) return;
    setFolders(folders().map(f => f === old ? n : f));
    index().filter(x => x.folder === old).forEach(x => moveBoard(x.id, n));
  };
  const deleteFolder = async (f: string) => {
    const rest = folders().filter(x => x !== f), inside = index().filter(x => x.folder === f);
    if (!await confirmBox(`Delete the folder “${f}”?`, 'Delete folder', true, inside.length ? `Its ${inside.length} board${inside.length > 1 ? 's move' : ' moves'} to ${rest[0]}.` : '')) return;
    inside.forEach(x => moveBoard(x.id, rest[0])); setFolders(rest);
  };
  const rename = async (id: string, name: string) => { const n = await ask('Rename board', name, 'Rename'); if (n) renameBoard(id, n); };
  const dup = (id: string) => { const nb = duplicateBoard(id); if (nb) toast(`Made “${nb.name}”`); };
  const remove = async (id: string, name: string) => {
    const full = id === WB.board?.id ? WB.board : getBoard(id), owner = (full?.meta.members || []).find(m => m.role === 'owner')?.name;
    if (owner && owner !== WB.me.name) { toast('Only the owner can delete this board'); return; }
    if (await confirmBox(`Delete “${name}”?`, 'Delete board', true, 'This removes the board and its versions from this browser. It can’t be undone.')) { deleteBoard(id); toast('Board deleted'); }
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return <>
    <div className="dh"><b>Boards</b><button className="ib" aria-label="Close" onClick={toggleDrawer}><Ic d={ICON.x} /></button></div>
    <div className="dtools">
      <input className="dsearch" placeholder="Search boards" value={UI.dq} aria-label="Search boards" onChange={e => { UI.dq = e.target.value; emit('ui'); }} />
      <button className="btn dark sm" onClick={newBoard}><Ic d={ICON.plus} s={15} />Board</button>
      <button className="btn sm" onClick={newFolder}><Ic d={ICON.folder} s={15} />Folder</button>
    </div>
    <div className="dlist">{groups.map(([f, list]) => (
      <div key={f} className="dfold">
        <div className="fh"><Ic d={ICON.folder} s={15} /><span className="fn">{f}</span><small>{list.length}</small>
          <button className="ib s" title="Rename folder" aria-label={`Rename folder ${f}`} onClick={() => renameFolder(f)}><Ic d={ICON.edit} s={14} /></button>
          {fs.length > 1 && <button className="ib s" title="Delete folder" aria-label={`Delete folder ${f}`} onClick={() => deleteFolder(f)}><Ic d={ICON.x} s={14} /></button>}
        </div>
        {list.map(b => (
          <div key={b.id} className={'drow' + (b.id === cur ? ' on' : '')} role="button" tabIndex={0} aria-current={b.id === cur ? 'true' : undefined}
            onClick={() => { if (b.id !== WB.board?.id) openBoard(b.id); }} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) e.currentTarget.click(); }}>
            <span className="dsw" style={css({ '--c': swatchOf(b.id) })} />
            <span className="dn"><b>{b.name}</b><small>{b.count} objects · {timeAgo(b.updated)}</small></span>
            <span className="dact" onClick={stop}>
              <button className="ib s" title="Rename" aria-label="Rename" onClick={() => rename(b.id, b.name)}><Ic d={ICON.edit} s={14} /></button>
              <button className="ib s" title="Duplicate" aria-label="Duplicate" onClick={() => dup(b.id)}><Ic d={ICON.dup} s={14} /></button>
              <button className="ib s" title="Move to folder" aria-label="Move to folder" onClick={e => folderPop(e.currentTarget, b.id)}><Ic d={ICON.folder} s={14} /></button>
              <button className="ib s" title="Delete" aria-label="Delete" onClick={() => remove(b.id, b.name)}><Ic d={ICON.trash} s={14} /></button>
            </span>
          </div>
        ))}
        {!list.length && <p className="dempty">No boards here</p>}
      </div>
    ))}</div>
  </>;
}
export function Drawer() {
  useWB('ui');
  return (
    <AnimatePresence>
      {UI.drawer && <motion.aside key="drawer" className="drawer" aria-label="Boards"
        initial={{ x: -14, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -14, opacity: 0 }} transition={{ duration: .18, ease: [0.25, 0.8, 0.25, 1] }}
        onKeyDown={e => { if (e.key === 'Escape') toggleDrawer(); e.stopPropagation(); }}>
        <DrawerBody />
      </motion.aside>}
    </AnimatePresence>
  );
}
