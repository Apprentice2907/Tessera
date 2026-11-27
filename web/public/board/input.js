// Tessera · Board — mouse, keyboard and clipboard: tools, move, resize, rotate, connectors, pen, shortcuts.
'use strict';

const I = WB.I = { cursor: null, space: false, editing: null, busy: false };
const vp = $('#vp');
const hitId = el => el?.closest?.('#objs [data-id], #lines [data-id]')?.dataset.id;
const EDITABLE = ['note', 'text', 'shape', 'section'];
const MIN = 16;

WB.setTool = t => {
  if (!WB.canEdit() && !['select', 'hand', 'comment'].includes(t)) { WB.emit('toast', 'You can view this board. Ask the owner for edit access.'); t = 'select'; }
  WB.tool = t; vp.dataset.tool = t; WB.emit('tool');
};

// one drag = pointer moves until release (listens on the window so it never gets lost)
function drag(e, move, up) {
  const pid = e.pointerId; I.busy = true; document.body.classList.add('dragging');
  const mv = ev => { if (ev.pointerId !== pid) return; const p = WB.toWorld(ev.clientX, ev.clientY); I.cursor = p; WB.presence(p.x, p.y); move(ev); };
  const end = ev => {
    if (ev.pointerId !== pid) return;
    removeEventListener('pointermove', mv); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
    I.busy = false; document.body.classList.remove('dragging');
    up(ev); WB.emit('sel');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', end); addEventListener('pointercancel', end);
}
const far = (e, ev, d = 3) => Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) >= d;

// ---------- pointer down on the canvas ----------
vp.addEventListener('pointerdown', e => {
  if (e.target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')) return;
  if (I.editing) I.endEdit();
  WB.UI?.closePops();
  const p = WB.toWorld(e.clientX, e.clientY);
  if (e.button === 1 || (e.button === 0 && (I.space || WB.tool === 'hand'))) { e.preventDefault(); return pan(e); }
  if (e.button !== 0) return;
  const h = e.target.closest('[data-h]'); if (h) return handleDrag(e, h.dataset.h);
  const end = e.target.closest('[data-end]'); if (end) return endDrag(e, end.dataset.end);
  const id = hitId(e.target), o = id && WB.objs[id];
  if (WB.tool === 'select' || !WB.canEdit()) {
    if (o?.type === 'poll' && e.target.closest('[data-opt]')) { WB.select([id]); WB.pollVote(id, +e.target.closest('[data-opt]').dataset.opt); return; }
    if (o?.type === 'link' && e.target.closest('[data-open]')) { window.open(o.url, '_blank', 'noopener'); return; }
  }
  const T = WB.canEdit() ? WB.tool : (WB.tool === 'comment' ? 'comment' : 'select');
  if (T === 'select') return selectDown(e, id, p);
  if (T === 'note' || T === 'text') return createAt(T, p);
  if (T === 'shape' || T === 'section') return drawBox(e, p, T);
  if (T === 'line') return connect(e, p, id);
  if (T === 'pen' || T === 'hl') return pen(e, p);
  if (T === 'stamp') return stamp(p);
  if (T === 'comment') { if (o?.type === 'comment') { WB.select([id]); WB.UI.thread(id); return; } return WB.UI.newComment(p, e.clientX, e.clientY); }
  if (T === 'link') return WB.UI.linkInput(p, e.clientX, e.clientY);
});

function pan(e) {
  const sx = e.clientX, sy = e.clientY, c = { ...WB.cam };
  vp.classList.add('panning');
  drag(e, ev => WB.setCam(c.x + ev.clientX - sx, c.y + ev.clientY - sy, c.z), () => vp.classList.remove('panning'));
}

// ---------- select tool: click, shift-click, marquee, move ----------
function selectDown(e, id, p) {
  let o = id && WB.objs[id];
  // the body of a section is free space (so you can lasso the stickies in it); its title selects it
  if (o?.type === 'section' && !e.target.closest('.stitle') && !WB.sel.has(id)) o = null;
  if (o?.type === 'line' && !e.target.closest('.hit')) o = null;
  if (!o) return marquee(e, p);
  if (e.shiftKey) {
    const s = new Set(WB.sel), grp = WB.expand([id]), on = s.has(id);
    grp.forEach(g => on ? s.delete(g) : s.add(g)); WB.setSel(s); return;
  }
  if (!WB.sel.has(id)) WB.select([id]);
  if (o.type === 'comment' && !WB.canEdit()) { WB.UI.thread(id); return; }
  if (!WB.canEdit()) return;
  move(e, p, id);
}
function marquee(e, p) {
  if (!e.shiftKey) WB.setSel(new Set());
  const base = new Set(WB.sel);
  drag(e, ev => {
    const q = WB.toWorld(ev.clientX, ev.clientY);
    const r = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) };
    WB.R.marq = r;
    const hit = Object.values(WB.objs).filter(o => {
      const b = WB.box(o);
      if (o.type === 'section') return b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h;
      return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
    }).map(o => o.id);
    WB.sel = new Set([...base, ...WB.expand(hit)]);
    WB.R.lines(); WB.R.overlay();
  }, () => { WB.R.marq = null; WB.setSel(WB.sel); });
}
const inside = (b, s) => b.x >= s.x - 1 && b.y >= s.y - 1 && b.x + b.w <= s.x + s.w + 1 && b.y + b.h <= s.y + s.h + 1;
function move(e, p0, clicked) {
  WB.begin();
  let ids = [...WB.sel].filter(id => !WB.objs[id].locked);
  if (e.altKey) { ids = I.paste(I.copy(false, ids), { offset: 0, inTx: true }); } // Alt-drag leaves a copy behind
  const carry = new Set(ids);
  ids.forEach(id => { const s = WB.objs[id]; if (s?.type === 'section') Object.values(WB.objs).forEach(o => { if (o.id !== id && o.type !== 'line' && !o.locked && inside(WB.box(o), s)) carry.add(o.id); }); });
  const start = {}; carry.forEach(id => { start[id] = WB.objs[id]; });
  const boxes = [...carry].map(id => WB.objs[id]).filter(o => o && o.type !== 'line');
  const bb = boxes.length ? WB.bounds(boxes) : null;
  const others = Object.values(WB.objs).filter(o => !carry.has(o.id) && !['line', 'comment', 'ink'].includes(o.type));
  let moved = false;
  drag(e, ev => {
    if (!moved && !far(e, ev)) return;
    moved = true;
    const q = WB.toWorld(ev.clientX, ev.clientY);
    let dx = q.x - p0.x, dy = q.y - p0.y;
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    WB.R.guides = [];
    if (bb && WB.board.meta.settings.snap !== false && !(ev.ctrlKey || ev.metaKey)) {
      const s = snap({ x: bb.x + dx, y: bb.y + dy, w: bb.w, h: bb.h }, others); dx += s.dx; dy += s.dy; WB.R.guides = s.guides;
    }
    carry.forEach(id => {
      const o = start[id]; if (!o) return;
      if (o.type === 'line') { WB.objs[id] = { ...o, a: o.a.id ? o.a : { x: o.a.x + dx, y: o.a.y + dy }, b: o.b.id ? o.b : { x: o.b.x + dx, y: o.b.y + dy }, rev: o.rev + 1 }; }
      else WB.objs[id] = { ...o, x: o.x + dx, y: o.y + dy, rev: (o.rev || 0) + 1 };
    });
    WB.live([...carry]);
  }, () => {
    WB.R.guides = [];
    WB.commit(e.altKey ? 'Duplicate' : 'Move');
    if (!moved && clicked && WB.objs[clicked]?.type === 'comment') WB.UI.thread(clicked);
    WB.R.overlay();
  });
}
// alignment guides: snap edges and centres to other objects nearby
function snap(b, others) {
  const t = 6 / WB.cam.z, xs = [b.x, b.x + b.w / 2, b.x + b.w], ys = [b.y, b.y + b.h / 2, b.y + b.h];
  let bx = null, by = null;
  others.forEach(o => {
    const c = WB.box(o);
    [c.x, c.x + c.w / 2, c.x + c.w].forEach(v => xs.forEach(m => { const d = v - m; if (Math.abs(d) < t && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, v, c }; }));
    [c.y, c.y + c.h / 2, c.y + c.h].forEach(v => ys.forEach(m => { const d = v - m; if (Math.abs(d) < t && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, v, c }; }));
  });
  const nx = b.x + (bx ? bx.d : 0), ny = b.y + (by ? by.d : 0), guides = [];
  if (bx) guides.push({ x1: bx.v, y1: Math.min(ny, bx.c.y) - 12, x2: bx.v, y2: Math.max(ny + b.h, bx.c.y + bx.c.h) + 12 });
  if (by) guides.push({ x1: Math.min(nx, by.c.x) - 12, y1: by.v, x2: Math.max(nx + b.w, by.c.x + by.c.w) + 12, y2: by.v });
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guides };
}

// ---------- resize and rotate ----------
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };
function handleDrag(e, h) {
  const sel = [...WB.sel].map(id => WB.objs[id]).filter(o => o && !o.locked);
  if (!sel.length || !WB.canEdit()) return;
  WB.begin();
  const p0 = WB.toWorld(e.clientX, e.clientY);
  if (h === 'rot') {
    const o = sel[0], c = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
    drag(e, ev => {
      const q = WB.toWorld(ev.clientX, ev.clientY);
      let a = Math.atan2(q.y - c.y, q.x - c.x) * 180 / Math.PI + 90;
      a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
      a = ((a % 360) + 540) % 360 - 180;
      WB.objs[o.id] = { ...o, r: a, rev: o.rev + 1 }; WB.live([o.id]);
    }, () => WB.commit('Rotate'));
    return;
  }
  const [dx, dy] = DIRS[h];
  if (sel.length === 1 && sel[0].type !== 'line') {
    const o = sel[0], a = (o.r || 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const keep = ['image', 'stamp'].includes(o.type);
    drag(e, ev => {
      const q = WB.toWorld(ev.clientX, ev.clientY), wx = q.x - p0.x, wy = q.y - p0.y;
      const lx = wx * cos + wy * sin, ly = -wx * sin + wy * cos;   // the pointer move in the object's own axes
      let w = Math.max(MIN, o.w + dx * lx), hh = Math.max(MIN, o.h + dy * ly);
      const lock = keep !== ev.shiftKey;
      if (lock && dx && dy) { const k = Math.max(w / o.w, hh / o.h); w = o.w * k; hh = o.h * k; }
      else if (lock && keep) { if (dx) hh = o.h * w / o.w; else w = o.w * hh / o.h; }
      const gx = dx * (w - o.w) / 2, gy = dy * (hh - o.h) / 2;   // the opposite side stays put
      const cx = o.x + o.w / 2 + gx * cos - gy * sin, cy = o.y + o.h / 2 + gx * sin + gy * cos;
      WB.objs[o.id] = { ...o, x: cx - w / 2, y: cy - hh / 2, w, h: hh, rev: o.rev + 1 }; WB.live([o.id]);
    }, () => WB.commit('Resize'));
  } else {
    const b0 = WB.bounds(sel), ax = dx > 0 ? b0.x : b0.x + b0.w, ay = dy > 0 ? b0.y : b0.y + b0.h;
    drag(e, ev => {
      const q = WB.toWorld(ev.clientX, ev.clientY);
      const k = Math.max(.05, Math.max((dx > 0 ? q.x - ax : ax - q.x) / b0.w, (dy > 0 ? q.y - ay : ay - q.y) / b0.h));
      sel.forEach(o => {
        if (o.type === 'line') { const f = v => v.id ? v : { x: ax + (v.x - ax) * k, y: ay + (v.y - ay) * k }; WB.objs[o.id] = { ...o, a: f(o.a), b: f(o.b), rev: o.rev + 1 }; }
        else WB.objs[o.id] = { ...o, x: ax + (o.x - ax) * k, y: ay + (o.y - ay) * k, w: Math.max(4, o.w * k), h: Math.max(4, o.h * k), rev: o.rev + 1 };
      });
      WB.live(sel.map(o => o.id));
    }, () => WB.commit('Resize'));
  }
}

// ---------- connectors ----------
function targetAt(ev, ...skip) {
  for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
    const id = el.closest?.('#objs [data-id]')?.dataset.id;
    if (id && !skip.includes(id)) { const o = WB.objs[id]; if (o && !['comment', 'line', 'ink'].includes(o.type)) return id; }
  }
  return null;
}
function connect(e, p, id) {
  const from = id && WB.objs[id] && !['comment', 'line', 'ink'].includes(WB.objs[id].type) ? id : null;
  const a = from ? { id: from } : { x: p.x, y: p.y };
  WB.R.temp = { a, b: { x: p.x, y: p.y } };
  drag(e, ev => {
    const q = WB.toWorld(ev.clientX, ev.clientY), t = targetAt(ev, from);
    WB.R.target = t; WB.R.temp = { a, b: t ? { id: t } : { x: q.x, y: q.y } };
    WB.R.lines(); WB.R.overlay();
  }, ev => {
    const b = WB.R.temp.b; WB.R.temp = null; WB.R.target = null;
    if (b.id || far(e, ev, 10)) {
      let l; WB.act('Add connector', () => { l = WB.add({ type: 'line', a, b, style: WB.opts.line, arrow: WB.opts.arrow, sw: 2, color: '#1C1C1E' }); });
      WB.select([l.id]);
    }
    WB.R.lines(); WB.R.overlay();
  });
}
function endDrag(e, which) {
  const l = WB.objs[[...WB.sel][0]]; if (!l || l.type !== 'line' || !WB.canEdit()) return;
  WB.begin();
  const other = which === 'a' ? l.b.id : l.a.id;
  drag(e, ev => {
    const q = WB.toWorld(ev.clientX, ev.clientY), t = targetAt(ev, other);
    WB.R.target = t;
    WB.objs[l.id] = { ...l, [which]: t ? { id: t } : { x: q.x, y: q.y }, rev: l.rev + 1 }; WB.live([l.id]);
  }, () => { WB.R.target = null; WB.commit('Reconnect'); });
}

// ---------- creating things ----------
function createAt(type, p) {
  let o;
  WB.act(type === 'note' ? 'Add sticky' : 'Add text', () => {
    o = type === 'note'
      ? WB.add({ type: 'note', x: p.x - 100, y: p.y - 100, w: 200, h: 200, text: '', color: WB.opts.note, fs: 'm' })
      : WB.add({ type: 'text', x: p.x, y: p.y - 20, w: 280, h: 38, text: '', fs: 'l', color: '#1C1C1E' });
  });
  WB.select([o.id]); WB.setTool('select');
  setTimeout(() => I.edit(o.id), 0);
}
function drawBox(e, p, kind) {
  const base = kind === 'section'
    ? { type: 'section', text: 'Section', color: WB.PAL.section[Object.values(WB.objs).filter(s => s.type === 'section').length % 7] }
    : { type: 'shape', kind: WB.opts.shape, fill: WB.opts.fill, text: '', fs: 'm' };
  let o = null;
  WB.begin();
  drag(e, ev => {
    if (!far(e, ev, 4)) return;
    const q = WB.toWorld(ev.clientX, ev.clientY); let w = q.x - p.x, h = q.y - p.y;
    if (ev.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    const r = { x: Math.min(p.x, p.x + w), y: Math.min(p.y, p.y + h), w: Math.max(4, Math.abs(w)), h: Math.max(4, Math.abs(h)) };
    if (!o) o = WB.add({ ...base, ...r }); else WB.objs[o.id] = { ...WB.objs[o.id], ...r, rev: WB.objs[o.id].rev + 1 };
    WB.live([o.id]);
  }, () => {
    if (!o) { const [w, h] = kind === 'section' ? [640, 420] : [160, 160]; o = WB.add({ ...base, x: p.x - w / 2, y: p.y - h / 2, w, h }); }
    else { const c = WB.objs[o.id]; if (c.w < 24 || c.h < 24) WB.objs[o.id] = { ...c, w: Math.max(c.w, 40), h: Math.max(c.h, 40) }; }
    WB.commit(kind === 'section' ? 'Add section' : 'Add shape');
    WB.select([o.id]); WB.setTool('select');
  });
}
function pen(e, p) {
  const hl = WB.tool === 'hl', pts = [[p.x, p.y]];
  WB.R.pen = { pts, color: hl ? WB.opts.hl : WB.opts.pen, sw: hl ? 18 : WB.opts.penW, hl };
  drag(e, ev => {
    const q = WB.toWorld(ev.clientX, ev.clientY), l = pts[pts.length - 1];
    if (Math.hypot(q.x - l[0], q.y - l[1]) * WB.cam.z < 2) return;
    pts.push([q.x, q.y]); WB.R.overlay();
  }, () => {
    const { color, sw } = WB.R.pen; WB.R.pen = null;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const x = Math.min(...xs), y = Math.min(...ys), nw = Math.max(1, Math.max(...xs) - x), nh = Math.max(1, Math.max(...ys) - y);
    WB.act(hl ? 'Highlight' : 'Draw', () => WB.add({ type: 'ink', x, y, w: nw, h: nh, nw, nh, pts: pts.map(([a, b]) => [+(a - x).toFixed(1), +(b - y).toFixed(1)]), color, sw, hl }));
    WB.R.overlay();
  });
}
function stamp(p) { WB.act('Add stamp', () => WB.add({ type: 'stamp', x: p.x - 28, y: p.y - 28, w: 56, h: 56, emoji: WB.opts.stamp })); }

// ---------- editing text in place ----------
I.edit = id => {
  const o = WB.objs[id]; if (!o || !EDITABLE.includes(o.type) || !WB.canEdit() || o.locked) return;
  const el = WB.R.els.get(id); if (!el) return;
  const t = el.querySelector(o.type === 'section' ? '.stitle' : '.txt'); if (!t) return;
  I.endEdit();
  el.classList.add('editing'); I.editing = { id, t, el };
  WB.begin();
  try { t.contentEditable = 'plaintext-only'; } catch { t.contentEditable = 'true'; }
  if (t.contentEditable !== 'plaintext-only') t.contentEditable = 'true';
  t.focus();
  const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  t.oninput = () => {
    const cur = WB.objs[id]; if (!cur) return;
    const patch = { text: t.innerText.replace(/\n$/, '') };
    if (cur.type === 'text') patch.h = Math.max(30, t.scrollHeight);
    WB.objs[id] = { ...cur, ...patch, rev: cur.rev + 1 }; WB.live([id]);
  };
  t.onkeydown = ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) || (ev.key === 'Enter' && o.type === 'section')) { ev.preventDefault(); I.endEdit(); }
  };
  t.onblur = () => I.endEdit();
  WB.emit('sel');
};
I.endEdit = () => {
  const ed = I.editing; if (!ed) return; I.editing = null;
  ed.t.onblur = null; ed.t.oninput = null; ed.t.onkeydown = null; ed.t.contentEditable = 'false';
  ed.el.classList.remove('editing');
  const o = WB.objs[ed.id];
  if (o && o.type === 'text' && !o.text.trim()) WB.remove([ed.id]);
  WB.commit('Edit text');
  WB.R.sync(true); WB.emit('sel');
};
vp.addEventListener('dblclick', e => {
  const id = hitId(e.target), o = id && WB.objs[id];
  if (!o || WB.tool !== 'select') return;
  if (o.type === 'link') return window.open(o.url, '_blank', 'noopener');
  if (o.type === 'line') return WB.UI.lineLabel(id, e.clientX, e.clientY);
  if (o.type === 'poll' || o.type === 'image' || o.type === 'stamp') return WB.UI.more(null, e.clientX + 12, e.clientY + 12);
  if (o.type === 'section' && !e.target.closest('.stitle')) return;
  I.edit(id);
});

// ---------- copy, paste, duplicate, delete, group, order ----------
I.copy = (cut, ids = [...WB.sel]) => {
  if (!ids.length) return null;
  const set = new Set(ids);
  Object.values(WB.objs).forEach(o => { if (o.type === 'line' && set.has(o.a?.id) && set.has(o.b?.id)) set.add(o.id); });
  const data = [...set].map(id => WB.objs[id]).filter(Boolean);
  WB.clip = data;
  if (cut) WB.act('Cut', () => WB.remove([...set]));
  return data;
};
I.paste = (data = WB.clip, o = {}) => {
  if (!data?.length) return [];
  const boxes = data.filter(x => x.type !== 'line'), map = {}, groups = {}, ids = [];
  let dx = o.offset ?? 24, dy = o.offset ?? 24;
  if (o.at && boxes.length) { const b = WB.bounds(boxes); dx = o.at.x - (b.x + b.w / 2); dy = o.at.y - (b.y + b.h / 2); }
  const run = () => {
    boxes.forEach(x => { const n = WB.add({ ...clone(x), id: undefined, z: undefined, x: x.x + dx, y: x.y + dy, g: x.g ? (groups[x.g] = groups[x.g] || uid('g')) : undefined }); map[x.id] = n.id; ids.push(n.id); });
    data.filter(x => x.type === 'line').forEach(l => {
      const f = v => v.id ? (map[v.id] ? { id: map[v.id] } : null) : { x: v.x + dx, y: v.y + dy };
      const a = f(l.a), b = f(l.b); if (a && b) ids.push(WB.add({ ...clone(l), id: undefined, z: undefined, a, b }).id);
    });
  };
  if (o.inTx) run(); else WB.act('Paste', run);
  WB.select(ids);
  return ids;
};
I.duplicate = () => { const d = I.copy(false); if (d) I.paste(d, { offset: 24 }); };
I.del = () => { const ids = [...WB.sel].filter(id => !WB.objs[id]?.locked); if (ids.length) WB.act('Delete', () => WB.remove(ids)); };
I.group = () => { if (WB.sel.size < 2) return; const g = uid('g'); WB.act('Group', () => WB.sel.forEach(id => WB.update(id, { g }))); };
I.ungroup = () => { WB.act('Ungroup', () => WB.sel.forEach(id => { if (WB.objs[id].g) WB.update(id, { g: undefined }); })); };
I.lock = () => { const on = ![...WB.sel].every(id => WB.objs[id].locked); WB.act(on ? 'Lock' : 'Unlock', () => WB.sel.forEach(id => WB.update(id, { locked: on || undefined }))); };
I.order = dir => {
  const sel = [...WB.sel].map(id => WB.objs[id]).filter(Boolean); if (!sel.length) return;
  const zs = Object.values(WB.objs).map(o => o.z), top = Math.max(...zs), bot = Math.min(...zs);
  WB.act('Arrange', () => sel.sort((a, b) => a.z - b.z).forEach((o, i) => {
    let z = o.z;
    if (dir === 'front') z = top + 1 + i; else if (dir === 'back') z = bot - sel.length + i;
    else { const others = zs.filter(v => dir === 'up' ? v > o.z : v < o.z).sort((a, b) => dir === 'up' ? a - b : b - a); if (others.length) z = others[0] + (dir === 'up' ? .5 : -.5); }
    WB.update(o.id, { z });
  }));
};
I.nudge = (dx, dy) => WB.act('Nudge', () => WB.sel.forEach(id => {
  const o = WB.objs[id]; if (o.locked) return;
  if (o.type === 'line') WB.update(id, { a: o.a.id ? o.a : { x: o.a.x + dx, y: o.a.y + dy }, b: o.b.id ? o.b : { x: o.b.x + dx, y: o.b.y + dy } });
  else WB.update(id, { x: o.x + dx, y: o.y + dy });
}));
I.align = how => {
  const sel = [...WB.sel].map(id => WB.objs[id]).filter(o => o && o.type !== 'line'); if (sel.length < 2) return;
  const b = WB.bounds(sel);
  WB.act('Align', () => {
    if (how === 'dh' || how === 'dv') {
      const k = how === 'dh' ? 'x' : 'y', s = how === 'dh' ? 'w' : 'h', list = [...sel].sort((a, c) => a[k] - c[k]);
      const gap = (b[s] - list.reduce((a, o) => a + o[s], 0)) / (list.length - 1); let at = b[k];
      list.forEach(o => { WB.update(o.id, { [k]: at }); at += o[s] + gap; });
      return;
    }
    sel.forEach(o => WB.update(o.id, {
      l: { x: b.x }, c: { x: b.x + b.w / 2 - o.w / 2 }, r: { x: b.x + b.w - o.w },
      t: { y: b.y }, m: { y: b.y + b.h / 2 - o.h / 2 }, b: { y: b.y + b.h - o.h },
    }[how]));
  });
};
I.patch = (patch, types) => WB.act('Change style', () => WB.sel.forEach(id => { const o = WB.objs[id]; if (o && (!types || types.includes(o.type))) WB.update(id, patch); }));

// ---------- clipboard: works across tabs and pastes images, links and text ----------
const typing = () => { const a = document.activeElement; return a && (a.matches('input, textarea, select') || a.isContentEditable); };
document.addEventListener('copy', e => { if (typing()) return; const d = I.copy(false); if (!d) return; e.clipboardData.setData('text/plain', 'LIVEOS-BOARD:' + JSON.stringify(d)); e.preventDefault(); WB.emit('toast', `Copied ${d.length} item${d.length > 1 ? 's' : ''}`); });
document.addEventListener('cut', e => { if (typing() || !WB.canEdit()) return; const d = I.copy(true); if (!d) return; e.clipboardData.setData('text/plain', 'LIVEOS-BOARD:' + JSON.stringify(d)); e.preventDefault(); });
document.addEventListener('paste', e => {
  if (typing()) return;
  if (!WB.canEdit()) { WB.emit('toast', 'You can view this board. Ask the owner for edit access.'); return; }
  const dt = e.clipboardData, files = [...(dt?.files || [])].filter(f => f.type.startsWith('image/'));
  const at = I.cursor && I.inside ? I.cursor : null;
  if (files.length) { e.preventDefault(); WB.importImages(files, at); return; }
  const txt = (dt?.getData('text/plain') || '').trim();
  if (txt.startsWith('LIVEOS-BOARD:')) { e.preventDefault(); try { I.paste(JSON.parse(txt.slice(13)), at ? { at } : {}); } catch { /* not ours */ } return; }
  if (!txt) { if (WB.clip) I.paste(WB.clip, at ? { at } : {}); return; }
  e.preventDefault();
  if (/^https?:\/\/\S+$/i.test(txt)) WB.addLink(txt, at);
  else { const c = at || WB.center(); let o; WB.act('Paste text', () => { o = WB.add({ type: 'note', x: c.x - 100, y: c.y - 100, w: 200, h: 200, text: txt.slice(0, 500), color: WB.opts.note, fs: txt.length > 60 ? 's' : 'm' }); }); WB.select([o.id]); }
});

// ---------- wheel, hover, right-click, drop ----------
vp.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) WB.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0022)));
  else { const m = e.deltaMode ? 30 : 1, sx = e.shiftKey && !e.deltaX; WB.setCam(WB.cam.x - (sx ? e.deltaY : e.deltaX) * m, WB.cam.y - (sx ? 0 : e.deltaY) * m, WB.cam.z); }
}, { passive: false });
vp.addEventListener('pointermove', e => { if (I.busy) return; const p = WB.toWorld(e.clientX, e.clientY); I.cursor = p; I.inside = true; WB.presence(p.x, p.y); });
vp.addEventListener('pointerleave', () => { I.inside = false; });
vp.addEventListener('contextmenu', e => {
  e.preventDefault();
  const id = hitId(e.target);
  if (id && !WB.sel.has(id)) WB.select([id]);
  WB.UI.ctxMenu(e.clientX, e.clientY, id, WB.toWorld(e.clientX, e.clientY));
});
vp.addEventListener('dragover', e => e.preventDefault());
vp.addEventListener('drop', e => {
  e.preventDefault();
  const p = WB.toWorld(e.clientX, e.clientY);
  if (e.dataTransfer.files.length) WB.importImages(e.dataTransfer.files, p);
  else { const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'); if (/^https?:/i.test(u)) WB.addLink(u, p); }
});

// ---------- keyboard ----------
WB.REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👏'];
const TOOL_KEYS = { v: 'select', h: 'hand', n: 'note', t: 'text', s: 'shape', l: 'line', p: 'pen', m: 'hl', f: 'section', e: 'stamp', c: 'comment', k: 'link' };
const zoomMid = f => { const v = WB.view(); WB.zoomAt(v.x + v.w / 2, v.y + v.h / 2, f); };
WB.zoomMid = zoomMid;
addEventListener('keydown', e => {
  if (typing() || e.target.closest?.('.pops')) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (e.key === ' ') { e.preventDefault(); if (!I.space) { I.space = true; vp.classList.add('grab'); } return; }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? WB.redo() : WB.undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); WB.redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); if (WB.canEdit()) I.duplicate(); return; }
  if (mod && k === 'a') { e.preventDefault(); WB.select(Object.keys(WB.objs)); return; }
  if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? I.ungroup() : I.group(); return; }
  if (mod && k === 'l') { e.preventDefault(); I.lock(); return; }
  if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomMid(1.25); return; }
  if (mod && k === '-') { e.preventDefault(); zoomMid(1 / 1.25); return; }
  if (mod && k === '0') { e.preventDefault(); zoomMid(1 / WB.cam.z); return; }
  if (mod && k === 's') { e.preventDefault(); WB.save(true); WB.snapshot('Saved version'); WB.emit('toast', 'Saved a version'); return; }
  if (mod && k === ']') { e.preventDefault(); I.order('front'); return; }
  if (mod && k === '[') { e.preventDefault(); I.order('back'); return; }
  if (mod || e.altKey) return;
  if (e.shiftKey && e.code === 'Digit1') { WB.fit(); return; }
  if (e.shiftKey && e.code === 'Digit2') { if (WB.sel.size) WB.fit([...WB.sel], 2); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (WB.sel.size) { e.preventDefault(); I.del(); } return; }
  if (e.key === 'Escape') { WB.UI?.closePops(); if (WB.tool !== 'select') WB.setTool('select'); else WB.setSel(new Set()); return; }
  if (e.key === 'Enter' && WB.sel.size === 1) { e.preventDefault(); I.edit([...WB.sel][0]); return; }
  if (e.key === 'Tab' && WB.sel.size === 1) { e.preventDefault(); if (WB.canEdit()) WB.addChild([...WB.sel][0]); return; }
  if (e.key.startsWith('Arrow') && WB.sel.size) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; I.nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0); return; }
  if (e.key === ']') { I.order('up'); return; }
  if (e.key === '[') { I.order('down'); return; }
  if (/^[1-7]$/.test(e.key) && !e.shiftKey) { WB.UI.go(+e.key - 1); return; }
  if (k === 'b') { WB.UI.toggleDrawer(); return; }
  if (TOOL_KEYS[k] && !e.shiftKey) WB.setTool(TOOL_KEYS[k]);
});
addEventListener('keyup', e => { if (e.key === ' ') { I.space = false; vp.classList.remove('grab'); } });
addEventListener('blur', () => { I.space = false; vp.classList.remove('grab'); });
