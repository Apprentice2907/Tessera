// Tessera · Ideas board — mouse, keyboard and clipboard: tools, move, resize, rotate, connectors, pen, shortcuts.
// attach() wires the canvas and the window while Ideas is open and returns the function that unwires them.
import { toast } from '../../store/ui';
import {
  WB, act, add, begin, bounds, box, canEdit, clone, commit, emit, expand, fit, live, presence, remove, save, select,
  setCam, setSel, setTool, snapshot, toWorld, uid, update, undo, redo, viewOnly, zoomAt, zoomMid, center,
} from './core';
import { PAL } from './draw';
import { addChild, addLink, importImages, openLink, pollVote } from './extras';
import { closePops, ctxMenu, lineLabel, linkInput, more, newComment, thread, toggleDrawer } from './pops';
import type { End, Obj, Tool } from './types';

/** what the pointer is doing; `editing` is the object whose text is being typed */
export const I = {
  cursor: null as { x: number; y: number } | null, inside: false, space: false, busy: false,
  editing: null as { id: string; t: HTMLElement; el: HTMLElement } | null,
};
/** drawn on top while you work: alignment guides, the lasso, a connector being drawn, a pen stroke, a drop target */
export const R = {
  guides: [] as { x1: number; y1: number; x2: number; y2: number }[],
  marq: null as { x: number; y: number; w: number; h: number } | null,
  temp: null as { a: End; b: End } | null,
  pen: null as { pts: [number, number][]; color: string; sw: number; hl: boolean } | null,
  target: null as string | null,
};
const overlay = () => emit('overlay');
/** each object's element on the canvas, by id (the objects register themselves) */
export const els = new Map<string, HTMLElement>();

let vp: HTMLElement | null = null, root: HTMLElement | null = null;
const hitId = (el: EventTarget | null) => ((el as Element | null)?.closest?.('.objs [data-id], .lines [data-id]') as HTMLElement | null)?.dataset.id;
const EDITABLE = ['note', 'text', 'shape', 'section'];
const MIN = 16;

// one drag = pointer moves until release (listens on the window so it never gets lost)
function drag(e: PointerEvent, move: (ev: PointerEvent) => void, up: (ev: PointerEvent) => void) {
  const pid = e.pointerId; I.busy = true; root?.classList.add('is-drag');
  const mv = (ev: PointerEvent) => { if (ev.pointerId !== pid) return; const p = toWorld(ev.clientX, ev.clientY); I.cursor = p; presence(p.x, p.y); move(ev); };
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    removeEventListener('pointermove', mv); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
    dragEnd = null;
    I.busy = false; root?.classList.remove('is-drag');
    up(ev); emit('sel');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', end); addEventListener('pointercancel', end);
  dragEnd = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); I.busy = false; root?.classList.remove('is-drag'); };
}
let dragEnd: (() => void) | null = null;
const far = (e: PointerEvent, ev: PointerEvent, d = 3) => Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) >= d;

// ---------- pointer down on the canvas ----------
function down(e: PointerEvent) {
  const tg = e.target as Element;
  if (tg.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')) return;
  if (I.editing) endEdit();
  closePops();
  const p = toWorld(e.clientX, e.clientY);
  if (e.button === 1 || (e.button === 0 && (I.space || WB.tool === 'hand'))) { e.preventDefault(); return pan(e); }
  if (e.button !== 0) return;
  const h = tg.closest<HTMLElement>('[data-h]'); if (h) return handleDrag(e, h.dataset.h!);
  const end = tg.closest<HTMLElement>('[data-end]'); if (end) return endDrag(e, end.dataset.end as 'a' | 'b');
  const id = hitId(tg), o = id ? WB.objs[id] : undefined;
  if (WB.tool === 'select' || !canEdit()) {
    if (id && o?.type === 'poll' && tg.closest('[data-opt]')) { select([id]); pollVote(id, +(tg.closest<HTMLElement>('[data-opt]')!.dataset.opt!)); return; }
    if (o?.type === 'link' && tg.closest('[data-open]')) { openLink(o.url); return; }
  }
  const T: Tool = canEdit() ? WB.tool : (WB.tool === 'comment' ? 'comment' : 'select');
  if (T === 'select') return selectDown(e, id, p);
  if (T === 'note' || T === 'text') return createAt(T, p);
  if (T === 'shape' || T === 'section') return drawBox(e, p, T);
  if (T === 'line') return connect(e, p, id);
  if (T === 'pen' || T === 'hl') return pen(e, p);
  if (T === 'stamp') return stamp(p);
  if (T === 'comment') { if (id && o?.type === 'comment') { select([id]); thread(id); return; } return newComment(p, e.clientX, e.clientY); }
  if (T === 'link') return linkInput(p, e.clientX, e.clientY);
}

function pan(e: PointerEvent) {
  const sx = e.clientX, sy = e.clientY, c = { ...WB.cam };
  vp?.classList.add('panning');
  drag(e, ev => setCam(c.x + ev.clientX - sx, c.y + ev.clientY - sy, c.z), () => vp?.classList.remove('panning'));
}

// ---------- select tool: click, shift-click, marquee, move ----------
function selectDown(e: PointerEvent, id: string | undefined, p: { x: number; y: number }) {
  let o = id ? WB.objs[id] : undefined;
  const tg = e.target as Element;
  // the body of a section is free space (so you can lasso the stickies in it); its title selects it
  if (id && o?.type === 'section' && !tg.closest('.stitle') && !WB.sel.has(id)) o = undefined;
  if (o?.type === 'line' && !tg.closest('.hit')) o = undefined;
  if (!o || !id) return marquee(e, p);
  if (e.shiftKey) {
    const s = new Set(WB.sel), grp = expand([id]), isOn = s.has(id);
    grp.forEach(g => isOn ? s.delete(g) : s.add(g)); setSel(s); return;
  }
  if (!WB.sel.has(id)) select([id]);
  if (o.type === 'comment' && !canEdit()) { thread(id); return; }
  if (!canEdit()) return;
  move(e, p, id);
}
function marquee(e: PointerEvent, p: { x: number; y: number }) {
  if (!e.shiftKey) setSel(new Set());
  const base = new Set(WB.sel);
  drag(e, ev => {
    const q = toWorld(ev.clientX, ev.clientY);
    const r = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) };
    R.marq = r;
    const hit = Object.values(WB.objs).filter(o => {
      const b = box(o);
      if (o.type === 'section') return b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h;
      return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
    }).map(o => o.id);
    WB.sel = new Set([...base, ...expand(hit)]);
    emit('sel'); overlay();
  }, () => { R.marq = null; setSel(WB.sel); overlay(); });
}
const inside = (b: { x: number; y: number; w: number; h: number }, s: Obj) => b.x >= s.x - 1 && b.y >= s.y - 1 && b.x + b.w <= s.x + s.w + 1 && b.y + b.h <= s.y + s.h + 1;
function move(e: PointerEvent, p0: { x: number; y: number }, clicked: string) {
  begin();
  let ids = [...WB.sel].filter(id => !WB.objs[id].locked);
  if (e.altKey) ids = paste(copy(false, ids), { offset: 0, inTx: true }); // Alt-drag leaves a copy behind
  const carry = new Set(ids);
  ids.forEach(id => { const s = WB.objs[id]; if (s?.type === 'section') Object.values(WB.objs).forEach(o => { if (o.id !== id && o.type !== 'line' && !o.locked && inside(box(o), s)) carry.add(o.id); }); });
  const start: Record<string, Obj> = {}; carry.forEach(id => { start[id] = WB.objs[id]; });
  const boxes = [...carry].map(id => WB.objs[id]).filter(o => o && o.type !== 'line');
  const bb = boxes.length ? bounds(boxes) : null;
  const others = Object.values(WB.objs).filter(o => !carry.has(o.id) && !['line', 'comment', 'ink'].includes(o.type));
  let moved = false;
  drag(e, ev => {
    if (!moved && !far(e, ev)) return;
    moved = true;
    const q = toWorld(ev.clientX, ev.clientY);
    let dx = q.x - p0.x, dy = q.y - p0.y;
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    R.guides = [];
    if (bb && WB.board!.meta.settings?.snap !== false && !(ev.ctrlKey || ev.metaKey)) {
      const s = snap({ x: bb.x + dx, y: bb.y + dy, w: bb.w, h: bb.h }, others); dx += s.dx; dy += s.dy; R.guides = s.guides;
    }
    carry.forEach(id => {
      const o = start[id]; if (!o) return;
      if (o.type === 'line') WB.objs[id] = { ...o, a: o.a!.id ? o.a : { x: o.a!.x! + dx, y: o.a!.y! + dy }, b: o.b!.id ? o.b : { x: o.b!.x! + dx, y: o.b!.y! + dy }, rev: o.rev + 1 };
      else WB.objs[id] = { ...o, x: o.x + dx, y: o.y + dy, rev: (o.rev || 0) + 1 };
    });
    live([...carry]);
  }, () => {
    R.guides = [];
    commit(e.altKey ? 'Duplicate' : 'Move');
    if (!moved && clicked && WB.objs[clicked]?.type === 'comment') thread(clicked);
    overlay();
  });
}
// alignment guides: snap edges and centres to other objects nearby
type Hit = { d: number; v: number; c: { x: number; y: number; w: number; h: number } };
function snap(b: { x: number; y: number; w: number; h: number }, others: Obj[]) {
  const t = 6 / WB.cam.z, xs = [b.x, b.x + b.w / 2, b.x + b.w], ys = [b.y, b.y + b.h / 2, b.y + b.h];
  let bx: Hit | null = null, by: Hit | null = null;
  others.forEach(o => {
    const c = box(o);
    [c.x, c.x + c.w / 2, c.x + c.w].forEach(v => xs.forEach(m => { const d = v - m; if (Math.abs(d) < t && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, v, c }; }));
    [c.y, c.y + c.h / 2, c.y + c.h].forEach(v => ys.forEach(m => { const d = v - m; if (Math.abs(d) < t && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, v, c }; }));
  });
  const X = bx as Hit | null, Y = by as Hit | null;
  const nx = b.x + (X ? X.d : 0), ny = b.y + (Y ? Y.d : 0), guides = [];
  if (X) guides.push({ x1: X.v, y1: Math.min(ny, X.c.y) - 12, x2: X.v, y2: Math.max(ny + b.h, X.c.y + X.c.h) + 12 });
  if (Y) guides.push({ x1: Math.min(nx, Y.c.x) - 12, y1: Y.v, x2: Math.max(nx + b.w, Y.c.x + Y.c.w) + 12, y2: Y.v });
  return { dx: X ? X.d : 0, dy: Y ? Y.d : 0, guides };
}

// ---------- resize and rotate ----------
const DIRS: Record<string, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };
function handleDrag(e: PointerEvent, h: string) {
  const sel = [...WB.sel].map(id => WB.objs[id]).filter(o => o && !o.locked);
  if (!sel.length || !canEdit()) return;
  begin();
  const p0 = toWorld(e.clientX, e.clientY);
  if (h === 'rot') {
    const o = sel[0], c = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
    drag(e, ev => {
      const q = toWorld(ev.clientX, ev.clientY);
      let a = Math.atan2(q.y - c.y, q.x - c.x) * 180 / Math.PI + 90;
      a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
      a = ((a % 360) + 540) % 360 - 180;
      WB.objs[o.id] = { ...o, r: a, rev: o.rev + 1 }; live([o.id]);
    }, () => commit('Rotate'));
    return;
  }
  const [dx, dy] = DIRS[h];
  if (sel.length === 1 && sel[0].type !== 'line') {
    const o = sel[0], a = (o.r || 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const keep = ['image', 'stamp'].includes(o.type);
    drag(e, ev => {
      const q = toWorld(ev.clientX, ev.clientY), wx = q.x - p0.x, wy = q.y - p0.y;
      const lx = wx * cos + wy * sin, ly = -wx * sin + wy * cos;   // the pointer move in the object's own axes
      let w = Math.max(MIN, o.w + dx * lx), hh = Math.max(MIN, o.h + dy * ly);
      const lock = keep !== ev.shiftKey;
      if (lock && dx && dy) { const k = Math.max(w / o.w, hh / o.h); w = o.w * k; hh = o.h * k; }
      else if (lock && keep) { if (dx) hh = o.h * w / o.w; else w = o.w * hh / o.h; }
      const gx = dx * (w - o.w) / 2, gy = dy * (hh - o.h) / 2;   // the opposite side stays put
      const cx = o.x + o.w / 2 + gx * cos - gy * sin, cy = o.y + o.h / 2 + gx * sin + gy * cos;
      WB.objs[o.id] = { ...o, x: cx - w / 2, y: cy - hh / 2, w, h: hh, rev: o.rev + 1 }; live([o.id]);
    }, () => commit('Resize'));
  } else {
    const b0 = bounds(sel), ax = dx > 0 ? b0.x : b0.x + b0.w, ay = dy > 0 ? b0.y : b0.y + b0.h;
    drag(e, ev => {
      const q = toWorld(ev.clientX, ev.clientY);
      const k = Math.max(.05, Math.max((dx > 0 ? q.x - ax : ax - q.x) / b0.w, (dy > 0 ? q.y - ay : ay - q.y) / b0.h));
      sel.forEach(o => {
        if (o.type === 'line') { const f = (v: End) => v.id ? v : { x: ax + (v.x! - ax) * k, y: ay + (v.y! - ay) * k }; WB.objs[o.id] = { ...o, a: f(o.a!), b: f(o.b!), rev: o.rev + 1 }; }
        else WB.objs[o.id] = { ...o, x: ax + (o.x - ax) * k, y: ay + (o.y - ay) * k, w: Math.max(4, o.w * k), h: Math.max(4, o.h * k), rev: o.rev + 1 };
      });
      live(sel.map(o => o.id));
    }, () => commit('Resize'));
  }
}

// ---------- connectors ----------
function targetAt(ev: PointerEvent, ...skip: (string | undefined | null)[]) {
  for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
    const id = (el.closest?.('.objs [data-id]') as HTMLElement | null)?.dataset.id;
    if (id && !skip.includes(id)) { const o = WB.objs[id]; if (o && !['comment', 'line', 'ink'].includes(o.type)) return id; }
  }
  return null;
}
function connect(e: PointerEvent, p: { x: number; y: number }, id: string | undefined) {
  const from = id && WB.objs[id] && !['comment', 'line', 'ink'].includes(WB.objs[id].type) ? id : null;
  const a: End = from ? { id: from } : { x: p.x, y: p.y };
  R.temp = { a, b: { x: p.x, y: p.y } }; overlay();
  drag(e, ev => {
    const q = toWorld(ev.clientX, ev.clientY), t = targetAt(ev, from);
    R.target = t; R.temp = { a, b: t ? { id: t } : { x: q.x, y: q.y } };
    overlay();
  }, ev => {
    const b = R.temp!.b; R.temp = null; R.target = null;
    if (b.id || far(e, ev, 10)) {
      let l: Obj | null = null; act('Add connector', () => { l = add({ type: 'line', a, b, style: WB.opts.line, arrow: WB.opts.arrow, sw: 2, color: '#1C1C1E' }); });
      if (l) select([(l as Obj).id]);
    }
    overlay();
  });
}
function endDrag(e: PointerEvent, which: 'a' | 'b') {
  const l = WB.objs[[...WB.sel][0]]; if (!l || l.type !== 'line' || !canEdit()) return;
  begin();
  const other = which === 'a' ? l.b!.id : l.a!.id;
  drag(e, ev => {
    const q = toWorld(ev.clientX, ev.clientY), t = targetAt(ev, other);
    R.target = t;
    WB.objs[l.id] = { ...l, [which]: t ? { id: t } : { x: q.x, y: q.y }, rev: l.rev + 1 }; live([l.id]);
  }, () => { R.target = null; commit('Reconnect'); overlay(); });
}

// ---------- creating things ----------
export function addSticky(p: { x: number; y: number }) {
  let o: Obj | null = null;
  act('Add sticky', () => { o = add({ type: 'note', x: p.x - 100, y: p.y - 100, w: 200, h: 200, text: '', color: WB.opts.note, fs: 'm' }); });
  if (!o) return;
  const id = (o as Obj).id;
  select([id]);
  setTimeout(() => edit(id), 0);
}
function createAt(type: 'note' | 'text', p: { x: number; y: number }) {
  let o: Obj | null = null;
  act(type === 'note' ? 'Add sticky' : 'Add text', () => {
    o = type === 'note'
      ? add({ type: 'note', x: p.x - 100, y: p.y - 100, w: 200, h: 200, text: '', color: WB.opts.note, fs: 'm' })
      : add({ type: 'text', x: p.x, y: p.y - 20, w: 280, h: 38, text: '', fs: 'l', color: '#1C1C1E' });
  });
  if (!o) return;
  const id = (o as Obj).id;
  select([id]); setTool('select');
  setTimeout(() => edit(id), 0);
}
function drawBox(e: PointerEvent, p: { x: number; y: number }, kind: 'shape' | 'section') {
  const base: Partial<Obj> & { type: Obj['type'] } = kind === 'section'
    ? { type: 'section', text: 'Section', color: PAL.section[Object.values(WB.objs).filter(s => s.type === 'section').length % 7] }
    : { type: 'shape', kind: WB.opts.shape, fill: WB.opts.fill, text: '', fs: 'm' };
  let o: Obj | null = null;
  begin();
  drag(e, ev => {
    if (!far(e, ev, 4)) return;
    const q = toWorld(ev.clientX, ev.clientY); let w = q.x - p.x, h = q.y - p.y;
    if (ev.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    const r = { x: Math.min(p.x, p.x + w), y: Math.min(p.y, p.y + h), w: Math.max(4, Math.abs(w)), h: Math.max(4, Math.abs(h)) };
    if (!o) o = add({ ...base, ...r }); else WB.objs[o.id] = { ...WB.objs[o.id], ...r, rev: WB.objs[o.id].rev + 1 };
    live([o.id]);
  }, () => {
    if (!o) { const [w, h] = kind === 'section' ? [640, 420] : [160, 160]; o = add({ ...base, x: p.x - w / 2, y: p.y - h / 2, w, h }); }
    else { const c = WB.objs[o.id]; if (c.w < 24 || c.h < 24) WB.objs[o.id] = { ...c, w: Math.max(c.w, 40), h: Math.max(c.h, 40) }; }
    commit(kind === 'section' ? 'Add section' : 'Add shape');
    select([o.id]); setTool('select');
  });
}
function pen(e: PointerEvent, p: { x: number; y: number }) {
  const hl = WB.tool === 'hl', pts: [number, number][] = [[p.x, p.y]];
  R.pen = { pts, color: hl ? WB.opts.hl : WB.opts.pen, sw: hl ? 18 : WB.opts.penW, hl };
  overlay();
  drag(e, ev => {
    const q = toWorld(ev.clientX, ev.clientY), l = pts[pts.length - 1];
    if (Math.hypot(q.x - l[0], q.y - l[1]) * WB.cam.z < 2) return;
    pts.push([q.x, q.y]); overlay();
  }, () => {
    const { color, sw } = R.pen!; R.pen = null;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const x = Math.min(...xs), y = Math.min(...ys), nw = Math.max(1, Math.max(...xs) - x), nh = Math.max(1, Math.max(...ys) - y);
    act(hl ? 'Highlight' : 'Draw', () => add({ type: 'ink', x, y, w: nw, h: nh, nw, nh, pts: pts.map(([a, b]) => [+(a - x).toFixed(1), +(b - y).toFixed(1)] as [number, number]), color, sw, hl }));
    overlay();
  });
}
function stamp(p: { x: number; y: number }) { act('Add stamp', () => add({ type: 'stamp', x: p.x - 28, y: p.y - 28, w: 56, h: 56, emoji: WB.opts.stamp })); }

// ---------- editing text in place ----------
// The object's text element becomes editable; React leaves its contents alone (see Txt in Canvas.tsx), so what you
// type is never redrawn under the caret. Every keystroke is shown to other tabs; the whole edit is one undo step.
export function edit(id: string) {
  const o = WB.objs[id]; if (!o || !EDITABLE.includes(o.type) || !canEdit() || o.locked) return;
  const el = els.get(id); if (!el) return;
  const t = el.querySelector<HTMLElement>(o.type === 'section' ? '.stitle' : '.txt'); if (!t) return;
  endEdit();
  el.classList.add('editing'); I.editing = { id, t, el };
  begin();
  try { t.contentEditable = 'plaintext-only'; } catch { t.contentEditable = 'true'; }
  if (t.contentEditable !== 'plaintext-only') t.contentEditable = 'true';
  t.focus();
  const r = document.createRange(); r.selectNodeContents(t); const s = getSelection()!; s.removeAllRanges(); s.addRange(r);
  t.oninput = () => {
    const cur = WB.objs[id]; if (!cur) return;
    const patch: Partial<Obj> = { text: t.innerText.replace(/\n$/, '') };
    if (cur.type === 'text') patch.h = Math.max(30, t.scrollHeight);
    WB.objs[id] = { ...cur, ...patch, rev: cur.rev + 1 }; live([id]);
  };
  t.onkeydown = ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) || (ev.key === 'Enter' && o.type === 'section')) { ev.preventDefault(); endEdit(); }
  };
  t.onblur = () => endEdit();
  emit('edit'); emit('sel');
}
export function endEdit() {
  const ed = I.editing; if (!ed) return; I.editing = null;
  ed.t.onblur = null; ed.t.oninput = null; ed.t.onkeydown = null; ed.t.contentEditable = 'false';
  ed.el.classList.remove('editing');
  const o = WB.objs[ed.id];
  if (o && o.type === 'text' && !(o.text || '').trim()) remove([ed.id]);
  commit('Edit text');
  emit('edit'); emit('change'); emit('sel');
}

// ---------- copy, paste, duplicate, delete, group, order ----------
export function copy(cut: boolean, ids = [...WB.sel]) {
  if (!ids.length) return null;
  const set = new Set(ids);
  Object.values(WB.objs).forEach(o => { if (o.type === 'line' && o.a?.id && o.b?.id && set.has(o.a.id) && set.has(o.b.id)) set.add(o.id); });
  const data = [...set].map(id => WB.objs[id]).filter(Boolean);
  WB.clip = data;
  if (cut) act('Cut', () => remove([...set]));
  return data;
}
export function paste(data: Obj[] | null = WB.clip, o: { offset?: number; at?: { x: number; y: number } | null; inTx?: boolean } = {}) {
  if (!data?.length) return [];
  const boxes = data.filter(x => x.type !== 'line'), map: Record<string, string> = {}, groups: Record<string, string> = {}, ids: string[] = [];
  let dx = o.offset ?? 24, dy = o.offset ?? 24;
  if (o.at && boxes.length) { const b = bounds(boxes); dx = o.at.x - (b.x + b.w / 2); dy = o.at.y - (b.y + b.h / 2); }
  const run = () => {
    boxes.forEach(x => { const n = add({ ...clone(x), id: undefined, z: undefined, x: x.x + dx, y: x.y + dy, g: x.g ? (groups[x.g] = groups[x.g] || uid('g')) : undefined }); map[x.id] = n.id; ids.push(n.id); });
    data.filter(x => x.type === 'line').forEach(l => {
      const f = (v: End): End | null => v.id ? (map[v.id] ? { id: map[v.id] } : null) : { x: v.x! + dx, y: v.y! + dy };
      const a = f(l.a!), b = f(l.b!); if (a && b) ids.push(add({ ...clone(l), id: undefined, z: undefined, a, b }).id);
    });
  };
  if (o.inTx) run(); else act('Paste', run);
  select(ids);
  return ids;
}
export const duplicate = () => { const d = copy(false); if (d) paste(d, { offset: 24 }); };
export const del = () => { const ids = [...WB.sel].filter(id => !WB.objs[id]?.locked); if (ids.length) act('Delete', () => remove(ids)); };
export const group = () => { if (WB.sel.size < 2) return; const g = uid('g'); act('Group', () => WB.sel.forEach(id => update(id, { g }))); };
export const ungroup = () => { act('Ungroup', () => WB.sel.forEach(id => { if (WB.objs[id].g) update(id, { g: undefined }); })); };
export const lock = () => { const on = ![...WB.sel].every(id => WB.objs[id].locked); act(on ? 'Lock' : 'Unlock', () => WB.sel.forEach(id => update(id, { locked: on || undefined }))); };
export function order(dir: 'front' | 'back' | 'up' | 'down') {
  const sel = [...WB.sel].map(id => WB.objs[id]).filter(Boolean); if (!sel.length) return;
  const zs = Object.values(WB.objs).map(o => o.z), top = Math.max(...zs), bot = Math.min(...zs);
  act('Arrange', () => sel.sort((a, b) => a.z - b.z).forEach((o, i) => {
    let z = o.z;
    if (dir === 'front') z = top + 1 + i; else if (dir === 'back') z = bot - sel.length + i;
    else { const others = zs.filter(v => dir === 'up' ? v > o.z : v < o.z).sort((a, b) => dir === 'up' ? a - b : b - a); if (others.length) z = others[0] + (dir === 'up' ? .5 : -.5); }
    update(o.id, { z });
  }));
}
export const nudge = (dx: number, dy: number) => act('Nudge', () => WB.sel.forEach(id => {
  const o = WB.objs[id]; if (o.locked) return;
  if (o.type === 'line') update(id, { a: o.a!.id ? o.a : { x: o.a!.x! + dx, y: o.a!.y! + dy }, b: o.b!.id ? o.b : { x: o.b!.x! + dx, y: o.b!.y! + dy } });
  else update(id, { x: o.x + dx, y: o.y + dy });
}));
export function align(how: string) {
  const sel = [...WB.sel].map(id => WB.objs[id]).filter(o => o && o.type !== 'line'); if (sel.length < 2) return;
  const b = bounds(sel);
  act('Align', () => {
    if (how === 'dh' || how === 'dv') {
      const k = how === 'dh' ? 'x' : 'y', s = how === 'dh' ? 'w' : 'h', list = [...sel].sort((a, c) => a[k] - c[k]);
      const gap = (b[s] - list.reduce((a, o) => a + o[s], 0)) / (list.length - 1); let at = b[k];
      list.forEach(o => { update(o.id, { [k]: at }); at += o[s] + gap; });
      return;
    }
    sel.forEach(o => update(o.id, ({
      l: { x: b.x }, c: { x: b.x + b.w / 2 - o.w / 2 }, r: { x: b.x + b.w - o.w },
      t: { y: b.y }, m: { y: b.y + b.h / 2 - o.h / 2 }, b: { y: b.y + b.h - o.h },
    } as Record<string, Partial<Obj>>)[how]));
  });
}
export const patch = (p: Partial<Obj>, types?: string[]) => act('Change style', () => WB.sel.forEach(id => { const o = WB.objs[id]; if (o && (!types || types.includes(o.type))) update(id, p); }));
export const saveVersion = () => { save(true); snapshot('Saved version'); };

// ---------- clipboard: works across tabs and pastes images, links and text ----------
const typing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (a.matches('input, textarea, select') || a.isContentEditable); };
const MARK = 'LIVEOS-BOARD:';
function onCopy(e: ClipboardEvent) { if (typing()) return; const d = copy(false); if (!d) return; e.clipboardData?.setData('text/plain', MARK + JSON.stringify(d)); e.preventDefault(); toast(`Copied ${d.length} item${d.length > 1 ? 's' : ''}`); }
function onCut(e: ClipboardEvent) { if (typing() || !canEdit()) return; const d = copy(true); if (!d) return; e.clipboardData?.setData('text/plain', MARK + JSON.stringify(d)); e.preventDefault(); }
function onPaste(e: ClipboardEvent) {
  if (typing()) return;
  if (!canEdit()) { viewOnly(); return; }
  const dt = e.clipboardData, files = [...(dt?.files || [])].filter(f => f.type.startsWith('image/'));
  const at = I.cursor && I.inside ? I.cursor : null;
  if (files.length) { e.preventDefault(); importImages(files, at); return; }
  const txt = (dt?.getData('text/plain') || '').trim();
  if (txt.startsWith(MARK)) { e.preventDefault(); try { paste(JSON.parse(txt.slice(MARK.length)), at ? { at } : {}); } catch { /* not ours */ } return; }
  if (!txt) { if (WB.clip) paste(WB.clip, at ? { at } : {}); return; }
  e.preventDefault();
  if (/^https?:\/\/\S+$/i.test(txt)) addLink(txt, at);
  else {
    const c = at || center(); let o: Obj | null = null;
    act('Paste text', () => { o = add({ type: 'note', x: c.x - 100, y: c.y - 100, w: 200, h: 200, text: txt.slice(0, 500), color: WB.opts.note, fs: txt.length > 60 ? 's' : 'm' }); });
    if (o) select([(o as Obj).id]);
  }
}

// ---------- wheel, hover, right-click, drop ----------
function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0022)));
  else { const m = e.deltaMode ? 30 : 1, sx = e.shiftKey && !e.deltaX; setCam(WB.cam.x - (sx ? e.deltaY : e.deltaX) * m, WB.cam.y - (sx ? 0 : e.deltaY) * m, WB.cam.z); }
}
function onHover(e: PointerEvent) { if (I.busy) return; const p = toWorld(e.clientX, e.clientY); I.cursor = p; I.inside = true; presence(p.x, p.y); }
const onLeave = () => { I.inside = false; };
function onMenu(e: MouseEvent) {
  e.preventDefault();
  const id = hitId(e.target);
  if (id && !WB.sel.has(id)) select([id]);
  ctxMenu(e.clientX, e.clientY, id || null, toWorld(e.clientX, e.clientY));
}
function onDblClick(e: MouseEvent) {
  const id = hitId(e.target), o = id ? WB.objs[id] : undefined;
  if (!id || !o || WB.tool !== 'select') return;
  if (o.type === 'link') return openLink(o.url);
  if (o.type === 'line') { if (canEdit()) lineLabel(id, e.clientX, e.clientY); return; }
  if (o.type === 'poll' || o.type === 'image' || o.type === 'stamp') return more(null, e.clientX + 12, e.clientY + 12);
  if (o.type === 'section' && !(e.target as Element).closest('.stitle')) return;
  edit(id);
}
const onDragOver = (e: DragEvent) => e.preventDefault();
function onDrop(e: DragEvent) {
  e.preventDefault();
  const p = toWorld(e.clientX, e.clientY);
  if (e.dataTransfer?.files.length) importImages(e.dataTransfer.files, p);
  else { const u = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || ''; if (/^https?:/i.test(u)) addLink(u, p); }
}

// ---------- keyboard ----------
// Keys 1–7 go to the app's pages; the app's own shortcut does that (App.tsx), as it does on every page.
const TOOL_KEYS: Record<string, Tool> = { v: 'select', h: 'hand', n: 'note', t: 'text', s: 'shape', l: 'line', p: 'pen', m: 'hl', f: 'section', e: 'stamp', c: 'comment', k: 'link' };
function onKey(e: KeyboardEvent) {
  if (typing() || (e.target as Element | null)?.closest?.('[data-float]')) return;
  if (!WB.board) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (e.key === ' ') { e.preventDefault(); if (!I.space) { I.space = true; vp?.classList.add('grab'); } return; }
  if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); if (canEdit()) duplicate(); return; }
  if (mod && k === 'a') { e.preventDefault(); select(Object.keys(WB.objs)); return; }
  if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) ungroup(); else group(); return; }
  if (mod && k === 'l') { e.preventDefault(); lock(); return; }
  if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomMid(1.25); return; }
  if (mod && k === '-') { e.preventDefault(); zoomMid(1 / 1.25); return; }
  if (mod && k === '0') { e.preventDefault(); zoomMid(1 / WB.cam.z); return; }
  if (mod && k === 's') { e.preventDefault(); saveVersion(); toast('Saved a version'); return; }
  if (mod && k === ']') { e.preventDefault(); order('front'); return; }
  if (mod && k === '[') { e.preventDefault(); order('back'); return; }
  if (mod || e.altKey) return;
  if (e.shiftKey && e.code === 'Digit1') { fit(); return; }
  if (e.shiftKey && e.code === 'Digit2') { if (WB.sel.size) fit([...WB.sel], 2); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (WB.sel.size) { e.preventDefault(); del(); } return; }
  if (e.key === 'Escape') { closePops(); if (WB.tool !== 'select') setTool('select'); else setSel(new Set()); return; }
  if (e.key === 'Enter' && WB.sel.size === 1) { e.preventDefault(); edit([...WB.sel][0]); return; }
  if (e.key === 'Tab' && WB.sel.size === 1) { e.preventDefault(); if (canEdit()) addChild([...WB.sel][0]); return; }
  if (e.key.startsWith('Arrow') && WB.sel.size) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0); return; }
  if (e.key === ']') { order('up'); return; }
  if (e.key === '[') { order('down'); return; }
  if (k === 'b') { toggleDrawer(); return; }
  if (TOOL_KEYS[k] && !e.shiftKey) setTool(TOOL_KEYS[k]);
}
const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') { I.space = false; vp?.classList.remove('grab'); } };
const onBlur = () => { I.space = false; vp?.classList.remove('grab'); };
// a click anywhere but the floating parts closes the open card and the tool's options
const FLOATING = '.bpop, .fly, .tools, .bar, .ctx, .mback, .drawer';
const onAnyDown = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.(FLOATING)) closePops(); };

/** wire the canvas (vp), the page (root) and the window; returns the unwiring */
export function attach(canvas: HTMLElement, page: HTMLElement) {
  vp = canvas; root = page;
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointermove', onHover);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('contextmenu', onMenu);
  canvas.addEventListener('dragover', onDragOver);
  canvas.addEventListener('drop', onDrop);
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCut);
  document.addEventListener('paste', onPaste);
  document.addEventListener('pointerdown', onAnyDown, true);
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  return () => {
    endEdit();
    dragEnd?.(); dragEnd = null;
    Object.assign(R, { guides: [], marq: null, temp: null, pen: null, target: null });
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('dblclick', onDblClick);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('pointermove', onHover);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('contextmenu', onMenu);
    canvas.removeEventListener('dragover', onDragOver);
    canvas.removeEventListener('drop', onDrop);
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('cut', onCut);
    document.removeEventListener('paste', onPaste);
    document.removeEventListener('pointerdown', onAnyDown, true);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', onBlur);
    I.space = false; I.busy = false; I.cursor = null; I.inside = false;
    vp = null; root = null;
  };
}
