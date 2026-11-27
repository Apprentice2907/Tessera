// Tessera · Board — drawing: objects as DOM in a zoomed world, connectors in one SVG, handles and cursors on top.
'use strict';

WB.PAL = {
  note: ['#FFE380', '#FFC27A', '#FFB3D1', '#CFC2FF', '#A9D8FF', '#A8EBBB', '#FFFFFF', '#2A2A2E'],
  fill: ['#A9D8FF', '#CFC2FF', '#A8EBBB', '#FFE380', '#FFC27A', '#FFB3D1', '#FFFFFF', '#1C1C1E', 'transparent'],
  ink: ['#1C1C1E', '#7B61FF', '#1F7BFF', '#22A55B', '#FF8A00', '#FF4F96', '#E5484D', '#FFFFFF'],
  hl: ['#FFE14D', '#7CF29A', '#7CD4FF', '#FF9CCB', '#C7A6FF'],
  section: ['#F4F1FF', '#EAF5FF', '#EAF9EE', '#FFF7DD', '#FFF0E3', '#FFEFF5', '#F2F2F4'],
  stamps: ['👍', '❤️', '🔥', '⭐', '✅', '❌', '❓', '🎉', '💡', '👀'],
};
WB.SHAPES = ['rect', 'round', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'parallelogram'];
const dark = hex => { if (!hex || hex === 'transparent' || hex[0] !== '#') return false; const n = parseInt(hex.slice(1), 16); return ((n >> 16 & 255) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) < 140; };
WB.textOn = bg => dark(bg) ? '#FFFFFF' : '#1C1C1E';
WB.shapePath = (kind, w, h) => {
  const P = pts => 'M' + pts.map(([x, y]) => `${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`).join(' L') + ' Z';
  if (kind === 'triangle') return P([[.5, 0], [1, 1], [0, 1]]);
  if (kind === 'diamond') return P([[.5, 0], [1, .5], [.5, 1], [0, .5]]);
  if (kind === 'hexagon') return P([[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]]);
  if (kind === 'parallelogram') return P([[.2, 0], [1, 0], [.8, 1], [0, 1]]);
  if (kind === 'star') { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .22 : .5; pts.push([.5 + Math.cos(a) * r, .53 + Math.sin(a) * r]); } return P(pts); }
  return '';
};
WB.inkPath = pts => {
  if (!pts.length) return '';
  if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]} L${(pts[1] || pts[0])[0] + .01} ${(pts[1] || pts[0])[1]}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0]} ${pts[i][1]} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  const l = pts[pts.length - 1]; return d + ` L${l[0]} ${l[1]}`;
};
const domain = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const isVideo = u => /youtube\.com|youtu\.be|vimeo\.com/.test(u || '');

function objHTML(o) {
  const t = esc(o.text || '');
  switch (o.type) {
    case 'note': return `<div class="note" style="--c:${o.color};color:${WB.textOn(o.color)}"><div class="txt fs-${o.fs || 'm'}" style="text-align:${o.align || 'center'}">${t}</div><span class="who">${esc(o.by || '')}</span></div>`;
    case 'text': return `<div class="txt fs-${o.fs || 'm'}${o.bold ? ' b' : ''}" style="color:${o.color || '#1C1C1E'};text-align:${o.align || 'left'}">${t}</div>`;
    case 'shape': {
      const fill = o.fill || '#A9D8FF', svgKind = !['rect', 'round', 'ellipse'].includes(o.kind);
      const body = svgKind
        ? `<svg class="shp" width="100%" height="100%" viewBox="0 0 ${o.w} ${o.h}" overflow="visible"><path d="${WB.shapePath(o.kind, o.w, o.h)}" fill="${fill}" stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 0}" stroke-linejoin="round"/></svg>`
        : `<div class="shp k-${o.kind}" style="background:${fill};${o.sw ? `border:${o.sw}px solid ${o.stroke}` : ''}"></div>`;
      return `${body}<div class="txt fs-${o.fs || 'm'}${o.bold ? ' b' : ''}" style="color:${o.color || WB.textOn(fill === 'transparent' ? '#fff' : fill)};text-align:${o.align || 'center'}">${t}</div>`;
    }
    case 'image': return `<img src="${o.src}" alt="${esc(o.alt || '')}" draggable="false">`;
    case 'link': return `<div class="lnk${isVideo(o.url) ? ' vid' : ''}"><div class="lthumb">${isVideo(o.url) ? '<i class="play"></i>' : `<b>${esc(domain(o.url)[0] || '?').toUpperCase()}</b>`}</div><div class="lmeta"><b>${esc(o.title || domain(o.url))}</b><small>${esc(domain(o.url))}</small></div><span class="lopen" data-open title="Open link">↗</span></div>`;
    case 'section': return `<div class="sec" style="--sc:${o.color || '#F4F1FF'}"><div class="stitle">${t || 'Section'}</div></div>`;
    case 'stamp': return `<div class="stamp">${o.emoji}</div>`;
    case 'comment': { const first = (o.thread || [])[0]; const col = WB.PEOPLE[first?.by] || '#8E8E93'; return `<div class="pin${o.resolved ? ' done' : ''}" style="--pc:${col}"><b>${esc((first?.by || '?')[0])}</b>${(o.thread || []).length > 1 ? `<em>${o.thread.length}</em>` : ''}</div>`; }
    case 'ink': return `<svg class="ink" width="100%" height="100%" viewBox="0 0 ${o.nw} ${o.nh}" preserveAspectRatio="none" overflow="visible"><path class="hit" d="${WB.inkPath(o.pts)}" stroke-width="${o.sw + 12}"/><path class="${o.hl ? 'hl' : ''}" d="${WB.inkPath(o.pts)}" stroke="${o.color}" stroke-width="${o.sw}"/></svg>`;
    case 'poll': {
      const total = o.opts.reduce((a, p) => a + Object.keys(p.v || {}).length, 0);
      return `<div class="poll"><div class="pq">${esc(o.q)}</div>${o.opts.map((p, i) => { const n = Object.keys(p.v || {}).length, pct = total ? Math.round(n / total * 100) : 0; return `<button class="popt${p.v?.[WB.me.name] ? ' on' : ''}" data-opt="${i}"><span class="pbar" style="width:${pct}%"></span><span class="ptx">${esc(p.t)}</span><em>${n}</em></button>`; }).join('')}<small>${total} vote${total === 1 ? '' : 's'} · click to vote</small></div>`;
    }
  }
  return '';
}

const SKIP = new Set(['x', 'y', 'r', 'z', 'rev', 'at', 'g']);
function needsRedraw(a, b) {
  if (!a || a.type !== b.type) return true;
  const svgShape = b.type === 'shape' && !['rect', 'round', 'ellipse'].includes(b.kind);
  for (const k in b) if (!SKIP.has(k) && !((k === 'w' || k === 'h') && !svgShape) && a[k] !== b[k]) return true;
  for (const k in a) if (!(k in b)) return true;
  return false;
}
function place(el, o) {
  const s = el.style;
  s.left = o.x + 'px'; s.top = o.y + 'px'; s.width = o.w + 'px'; s.height = o.h + 'px';
  s.transform = o.r ? `rotate(${o.r}deg)` : '';
  s.zIndex = o.type === 'section' ? o.z : o.type === 'comment' ? 900000 + o.z : 100000 + o.z;
}

const R = WB.R = { els: new Map(), guides: [], marq: null, temp: null, pen: null, target: null };
R.sync = force => {
  const host = $('#objs'), seen = new Set();
  for (const id in WB.objs) {
    const o = WB.objs[id]; if (o.type === 'line') continue;
    seen.add(id);
    let el = R.els.get(id);
    if (!el) { el = document.createElement('div'); el.dataset.id = id; host.appendChild(el); R.els.set(id, el); }
    if (el._o !== o || force) {
      if (!el.classList.contains('editing') && (force || needsRedraw(el._o, o))) {
        el.className = `o t-${o.type}${o.kind ? ' k-' + o.kind : ''}${o.locked ? ' locked' : ''}${o.type === 'comment' && o.resolved ? ' resolved' : ''}`;
        el.innerHTML = objHTML(o);
      }
      place(el, o); el._o = o;
    }
  }
  R.els.forEach((el, id) => { if (!seen.has(id)) { el.remove(); R.els.delete(id); } });
  R.lines(); R.overlay();
};

// ---------- connectors ----------
const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
R.geom = l => {
  const { p1, p2 } = WB.lineEnds(l);
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const n1 = norm(p1.nx, p1.ny), n2 = norm(p2.nx, p2.ny);
  let d, t1, t2, mid;
  if (l.style === 'straight') { d = `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`; t1 = p2; t2 = p1; mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; }
  else if (l.style === 'elbow') {
    if (Math.abs(n1.x) >= Math.abs(n1.y)) { const mx = (p1.x + p2.x) / 2; d = `M${p1.x} ${p1.y} H${mx} V${p2.y} H${p2.x}`; t1 = { x: mx, y: p1.y }; t2 = { x: mx, y: p2.y }; mid = { x: mx, y: (p1.y + p2.y) / 2 }; }
    else { const my = (p1.y + p2.y) / 2; d = `M${p1.x} ${p1.y} V${my} H${p2.x} V${p2.y}`; t1 = { x: p1.x, y: my }; t2 = { x: p2.x, y: my }; mid = { x: (p1.x + p2.x) / 2, y: my }; }
  } else {
    const k = clamp(dist * .4, 24, 220);
    const c1 = { x: p1.x + n1.x * k, y: p1.y + n1.y * k }, c2 = { x: p2.x + n2.x * k, y: p2.y + n2.y * k };
    d = `M${p1.x} ${p1.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`; t1 = c1; t2 = c2;
    mid = { x: .125 * p1.x + .375 * c1.x + .375 * c2.x + .125 * p2.x, y: .125 * p1.y + .375 * c1.y + .375 * c2.y + .125 * p2.y };
  }
  return { d, p1, p2, t1, t2, mid };
};
const head = (tip, from, sw, color) => {
  const u = norm(tip.x - from.x, tip.y - from.y), s = 7 + sw * 1.7;
  const bx = tip.x - u.x * s, by = tip.y - u.y * s, px = -u.y * s * .55, py = u.x * s * .55;
  return `<path d="M${tip.x} ${tip.y} L${bx + px} ${by + py} L${bx - px} ${by - py} Z" fill="${color}" stroke="${color}" stroke-width="${sw * .6}" stroke-linejoin="round"/>`;
};
R.lineSVG = (l, sel) => {
  const g = R.geom(l), c = l.color || '#1C1C1E', sw = l.sw || 2;
  return `<g data-id="${l.id}" class="ln${sel ? ' on' : ''}">
    ${sel ? `<path d="${g.d}" class="glow" stroke-width="${sw + 8}"/>` : ''}
    <path d="${g.d}" class="hit"/>
    <path d="${g.d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${l.dash ? ' stroke-dasharray="8 7"' : ''}/>
    ${l.arrow === 'end' || l.arrow === 'both' ? head(g.p2, g.t2, sw, c) : ''}${l.arrow === 'both' ? head(g.p1, g.t1, sw, c) : ''}
    ${l.text ? `<text x="${g.mid.x}" y="${g.mid.y}" class="llab">${esc(l.text)}</text>` : ''}
  </g>`;
};
R.lines = () => {
  const list = Object.values(WB.objs).filter(o => o.type === 'line').sort((a, b) => a.z - b.z);
  let h = list.map(l => R.lineSVG(l, WB.sel.has(l.id))).join('');
  if (R.temp) h += `<g class="ln temp">${R.lineSVG({ id: 'temp', a: R.temp.a, b: R.temp.b, style: WB.opts.line, arrow: WB.opts.arrow, sw: 2, color: '#7B61FF' }).replace(/^<g[^>]*>|<\/g>$/g, '')}</g>`;
  $('#lines').innerHTML = h;
};

// ---------- handles, guides, marquee ----------
const scr = (x, y) => WB.toScreen(x, y);
function boxScreen(o) {
  const z = WB.cam.z, c = scr(o.x + o.w / 2, o.y + o.h / 2);
  return { cx: c.x, cy: c.y, w: o.w * z, h: o.h * z, r: o.r || 0 };
}
function rotPt(b, lx, ly) { const a = b.r * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { x: b.cx + lx * c - ly * s, y: b.cy + lx * s + ly * c }; }
const HANDLES = [['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0]];
R.overlay = () => {
  const ov = $('#overlay'); let h = '';
  const sel = [...WB.sel].map(id => WB.objs[id]).filter(Boolean);
  const edit = WB.canEdit();
  if (sel.length === 1 && sel[0].type === 'line') {
    const g = R.geom(sel[0]), a = scr(g.p1.x, g.p1.y), b = scr(g.p2.x, g.p2.y);
    if (edit) h += `<i class="hend" data-end="a" style="left:${a.x}px;top:${a.y}px"></i><i class="hend" data-end="b" style="left:${b.x}px;top:${b.y}px"></i>`;
  } else if (sel.length === 1) {
    const o = sel[0], b = boxScreen(o);
    h += `<div class="sbox" style="left:${b.cx - b.w / 2}px;top:${b.cy - b.h / 2}px;width:${b.w}px;height:${b.h}px;transform:rotate(${b.r}deg)"></div>`;
    if (edit && !o.locked && o.type !== 'comment') {
      const hs = o.type === 'stamp' || o.type === 'poll' ? HANDLES.filter(([k]) => k.length === 2) : HANDLES;
      hs.forEach(([k, dx, dy]) => { const p = rotPt(b, dx * b.w / 2, dy * b.h / 2); h += `<i class="hd h-${k}" data-h="${k}" style="left:${p.x}px;top:${p.y}px;transform:translate(-50%,-50%) rotate(${b.r}deg)"></i>`; });
      if (!['section', 'comment', 'poll'].includes(o.type)) { const p = rotPt(b, 0, -b.h / 2 - 24); h += `<i class="hrot" data-h="rot" style="left:${p.x}px;top:${p.y}px" title="Rotate"></i>`; }
    }
    if (o.locked) h += `<span class="slock" style="left:${b.cx}px;top:${b.cy - b.h / 2 - 12}px">Locked</span>`;
  } else if (sel.length > 1) {
    const bb = WB.bounds(sel), a = scr(bb.x, bb.y), z = WB.cam.z;
    h += `<div class="sbox multi" style="left:${a.x}px;top:${a.y}px;width:${bb.w * z}px;height:${bb.h * z}px"></div>`;
    if (edit) [['nw', 0, 0], ['ne', 1, 0], ['se', 1, 1], ['sw', 0, 1]].forEach(([k, fx, fy]) => { h += `<i class="hd h-${k}" data-h="${k}" style="left:${a.x + bb.w * z * fx}px;top:${a.y + bb.h * z * fy}px;transform:translate(-50%,-50%)"></i>`; });
  }
  if (R.target) { const o = WB.objs[R.target]; if (o) { const b = WB.box(o), a = scr(b.x, b.y), z = WB.cam.z; h += `<div class="tgt" style="left:${a.x - 4}px;top:${a.y - 4}px;width:${b.w * z + 8}px;height:${b.h * z + 8}px"></div>`; } }
  R.guides.forEach(g => { const a = scr(g.x1, g.y1), b = scr(g.x2, g.y2); h += `<div class="guide" style="left:${Math.min(a.x, b.x)}px;top:${Math.min(a.y, b.y)}px;width:${Math.abs(b.x - a.x) || 1}px;height:${Math.abs(b.y - a.y) || 1}px"></div>`; });
  if (R.marq) { const a = scr(R.marq.x, R.marq.y), z = WB.cam.z; h += `<div class="marq" style="left:${a.x}px;top:${a.y}px;width:${R.marq.w * z}px;height:${R.marq.h * z}px"></div>`; }
  if (R.pen) { const pts = R.pen.pts.map(([x, y]) => { const p = scr(x, y); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' '); h += `<svg class="penlive" width="100%" height="100%"><polyline points="${pts}" stroke="${R.pen.color}" stroke-width="${R.pen.sw * WB.cam.z}" ${R.pen.hl ? 'stroke-opacity=".45"' : ''}/></svg>`; }
  ov.innerHTML = h;
};

// ---------- cursors of other people ----------
R.cursors = () => {}; // other tabs stay in sync, but their cursors are not shown

// ---------- camera, grid and background ----------
R.cam = () => {
  const { x, y, z } = WB.cam, vp = $('#vp');
  $('#world').style.transform = `translate(${x}px, ${y}px) scale(${z})`;
  const st = WB.board?.meta.settings || {};
  let step = 24 * z; while (step < 12) step *= 4;
  vp.style.backgroundSize = `${step}px ${step}px`;
  vp.style.backgroundPosition = `${x}px ${y}px`;
  vp.dataset.bg = st.bg || 'paper';
  vp.classList.toggle('nogrid', st.grid === false);
  R.overlay(); R.cursors();
};

// ---------- reactions floating up from someone's cursor ----------
R.burst = (emoji, x, y, name, color) => {
  const s = scr(x, y), fx = $('#fx');
  for (let i = 0; i < 5; i++) {
    const e = document.createElement('span'); e.className = 'burst'; e.textContent = emoji;
    e.style.left = s.x + (Math.random() * 60 - 30) + 'px'; e.style.top = s.y + 'px';
    e.style.animationDelay = i * 90 + 'ms'; e.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
    fx.appendChild(e); setTimeout(() => e.remove(), 2200);
  }
  if (name) { const t = document.createElement('span'); t.className = 'burst-name'; t.textContent = name; t.style.left = s.x + 'px'; t.style.top = s.y + 18 + 'px'; t.style.background = color; fx.appendChild(t); setTimeout(() => t.remove(), 1600); }
};

WB.on('change', () => R.sync());
WB.on('sel', () => { R.lines(); R.overlay(); });
WB.on('cam', R.cam);
WB.on('peers', () => { R.cursors(); R.overlay(); });
WB.on('meta', () => { R.sync(true); R.cam(); });
WB.on('board', () => { $('#objs').innerHTML = ''; R.els.clear(); R.sync(true); R.cam(); });
WB.on('react', m => R.burst(m.emoji, m.x, m.y, m.u.name, m.u.color));
