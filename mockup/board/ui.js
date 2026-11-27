// Tessera · Board — interface: top bars, tool rail, properties panel, context bar, menus, sharing, boards drawer.
'use strict';

const UI = WB.UI = { per: 3, dq: '', fmt: 'png', scope: 'board', showResolved: false };
const EMBED = new URLSearchParams(location.search).has('embed'); // shown inside the bento Ideas page
document.body.classList.toggle('embed', EMBED);
const ic = (d, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  select: '<path d="M5 3 L16 9 L10.6 10.6 L9 16 Z"/>',
  hand: '<path d="M7 10V5a1.3 1.3 0 0 1 2.6 0v4.5M9.6 9V3.8a1.3 1.3 0 0 1 2.6 0V9M12.2 9.5V5.5a1.3 1.3 0 0 1 2.6 0V12a5 5 0 0 1-5 5h-.6a5 5 0 0 1-4-2l-2.3-3.2a1.3 1.3 0 0 1 2-1.6L7 11"/>',
  text: '<path d="M4 5h12M10 5v11M7.5 16h5"/>',
  shape: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="13.5" cy="13.5" r="3.8"/>',
  line: '<path d="M4 16 C4 9 9 5 16 5"/><path d="M12.5 2.5 16 5l-3 3"/>',
  pen: '<path d="M13.5 3.5l3 3L7 16H4v-3z"/><path d="M11.5 5.5l3 3"/>',
  hl: '<path d="M12 3l5 5-6.5 6.5-5-5z"/><path d="M5.5 9.5 3 15h3l2-2"/><path d="M3 18h14"/>',
  section: '<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h6V4"/>',
  stamp: '<circle cx="10" cy="5.5" r="2.7"/><path d="M8.6 8.2 8 11.5h4l-.6-3.3M4 11.5h12V14H4zM5.5 17h9"/>',
  comment: '<path d="M10 3.5a6.5 6.5 0 1 1-5.6 9.8L3 17l3.6-1.2A6.5 6.5 0 0 1 10 3.5z"/>',
  link: '<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/>',
  upload: '<path d="M10 13V3.5M6 7l4-4 4 4"/><path d="M3.5 13v2.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V13"/>',
  templates: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/>',
  undo: '<path d="M7 5 3.5 8.5 7 12"/><path d="M3.5 8.5H12a4.5 4.5 0 0 1 0 9H9"/>',
  redo: '<path d="M13 5l3.5 3.5L13 12"/><path d="M16.5 8.5H8a4.5 4.5 0 0 0 0 9h3"/>',
  boards: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12"/>',
  back: '<path d="M12 4 6 10l6 6"/>',
  bolt: '<path d="M11 2 4 11h5l-1 7 7-9h-5z"/>',
  minus: '<path d="M5 10h10"/>', plus: '<path d="M10 5v10M5 10h10"/>', fit: '<path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4"/>',
  panel: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M12 4v12"/>',
  dup: '<rect x="7" y="7" width="9" height="9" rx="2"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/>',
  trash: '<path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6"/>',
  more: '<circle cx="5" cy="10" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/>',
  x: '<path d="M5 5l10 10M15 5 5 15"/>', check: '<path d="M4.5 10.5 8 14l7.5-8"/>', send: '<path d="M3.5 10 16.5 4l-4 13-3-5.5z"/>',
  timer: '<circle cx="10" cy="11" r="6"/><path d="M10 8v3l2 1.5M8 2.5h4"/>',
  vote: '<path d="M3.5 10h13v7h-13z"/><path d="M7 10V4h6v6M9 7h2"/>',
  poll: '<path d="M4 16V9M10 16V4M16 16v-5"/>', bulb: '<path d="M7.5 14h5M8.5 17h3M10 3a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9z"/>',
  export: '<path d="M10 3v10M6 9l4 4 4-4"/><path d="M3.5 14v1.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V14"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.5 2h6A1.5 1.5 0 0 1 17 8.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"/>',
  edit: '<path d="M12.5 4.5l3 3L8 15H5v-3z"/>', open: '<path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8"/>',
  al: { l: '<path d="M3 3v14M6 6h9M6 12h6"/>', c: '<path d="M10 3v14M5 6h10M7 12h6"/>', r: '<path d="M17 3v14M5 6h9M8 12h6"/>', t: '<path d="M3 3h14M6 6v9M12 6v6"/>', m: '<path d="M3 10h14M6 5v10M12 7v6"/>', b: '<path d="M3 17h14M6 5v9M12 8v6"/>', dh: '<path d="M3 3v14M17 3v14M8 7v6M12 7v6"/>', dv: '<path d="M3 3h14M3 17h14M7 8h6M7 12h6"/>' },
};
const SHAPE_ICON = k => {
  const p = { rect: '<rect x="3" y="4" width="14" height="12"/>', round: '<rect x="3" y="4" width="14" height="12" rx="4"/>', ellipse: '<ellipse cx="10" cy="10" rx="7" ry="6"/>' }[k];
  return ic(p || `<path d="${WB.shapePath(k, 14, 13)}" transform="translate(3 3.5)"/>`);
};
const TYPE_NAME = { note: 'Sticky note', text: 'Text', shape: 'Shape', line: 'Connector', ink: 'Drawing', image: 'Image', link: 'Link', section: 'Section', stamp: 'Stamp', comment: 'Comment', poll: 'Poll' };
const ALIGN = { l: 'Align left', c: 'Align centre', r: 'Align right', t: 'Align top', m: 'Align middle', b: 'Align bottom', dh: 'Space evenly across', dv: 'Space evenly down' };
const timeAgo = t => { const s = (Date.now() - t) / 1000; return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
const selObjs = () => [...WB.sel].map(id => WB.objs[id]).filter(Boolean);
const swatchOf = id => WB.PAL.note[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 6];
const avatar = (name, cls = '') => `<span class="av ${cls}" style="--c:${WB.PEOPLE[name] || '#8E8E93'}" title="${esc(name)}">${esc((name || '?')[0])}</span>`;

// ---------- toast ----------
let toastT = 0;
WB.on('toast', msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); });

// ---------- popovers and dialogs ----------
UI.closePops = () => { $$('#pops .pop').forEach(p => p.remove()); $('#flyout').hidden = true; UI.openKey = null; };
UI.pop = (html, { x, y, anchor, cls = '', place = 'below', key } = {}) => {
  const again = key && UI.openKey === key;
  UI.closePops();
  if (again) return null;
  const p = document.createElement('div'); p.className = 'pop ' + cls; p.innerHTML = html; $('#pops').appendChild(p);
  UI.openKey = key || null;
  const w = p.offsetWidth, h = p.offsetHeight; let l = x, t = y;
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    if (place === 'right') { l = r.right + 10; t = r.top - 8; }
    else { l = place === 'below-right' ? r.right - w : r.left + r.width / 2 - w / 2; t = r.bottom + 8; }
  }
  p.style.left = clamp(l, 8, innerWidth - w - 8) + 'px'; p.style.top = clamp(t, 8, innerHeight - h - 8) + 'px';
  p.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); UI.closePops(); } });
  return p;
};
UI.modal = (html, cls = '') => {
  UI.closePops();
  const b = document.createElement('div'); b.className = 'modal-back';
  b.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  $('#pops').appendChild(b);
  const close = () => b.remove();
  b.addEventListener('pointerdown', e => { if (e.target === b) close(); });
  b.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  $$('[data-close]', b).forEach(x => x.onclick = close);
  setTimeout(() => (b.querySelector('[autofocus]') || b.querySelector('input, button'))?.focus(), 20);
  const m = b.querySelector('.modal'); m.close = close; return m;
};
UI.confirm = (title, ok = 'Delete', danger = true, sub = '') => new Promise(res => {
  const m = UI.modal(`<h3>${title}</h3>${sub ? `<p class="msub">${sub}</p>` : ''}<div class="mfoot"><button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'red' : 'dark'}" data-yes autofocus>${ok}</button></div>`, 'small');
  m.querySelector('[data-no]').onclick = () => { m.close(); res(false); };
  m.querySelector('[data-yes]').onclick = () => { m.close(); res(true); };
});
UI.ask = (title, value = '', ok = 'Save', placeholder = '') => new Promise(res => {
  const m = UI.modal(`<h3>${title}</h3><form class="mform"><input value="${esc(value)}" placeholder="${esc(placeholder)}" autofocus><div class="mfoot"><button type="button" class="btn" data-no>Cancel</button><button class="btn dark">${ok}</button></div></form>`, 'small');
  const inp = m.querySelector('input'); setTimeout(() => inp.select(), 30);
  m.querySelector('[data-no]').onclick = () => { m.close(); res(null); };
  m.querySelector('form').onsubmit = e => { e.preventDefault(); m.close(); res(inp.value.trim() || null); };
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('.pop, #flyout, #tools, .bar, .ctx, .modal-back, .drawer, #panel, .reacts')) UI.closePops(); }, true);

// ---------- top bars ----------
function barL() {
  const b = WB.board, owner = WB.role() !== 'viewer';
  $('#bar-l').innerHTML = `${EMBED ? '' : `<a class="ib" href="index.html#ideas" title="Back to Ideas">${ic(ICON.back)}</a>`}<button class="ib" id="u-boards" title="All boards (B)">${ic(ICON.boards)}</button><span class="sep"></span>
    <div class="bname"><input id="u-name" value="${esc(b.name)}" aria-label="Board name" spellcheck="false" ${owner ? '' : 'readonly'}><button class="fold" id="u-folder" title="Folder" ${owner ? '' : 'disabled'}>${ic(ICON.folder, 15)}${esc(b.folder)}</button></div>
    <span class="status" id="u-status"></span>${owner ? '' : '<span class="vo">View only</span>'}`;
  const n = $('#u-name'), fitName = () => { n.style.width = Math.min(280, Math.max(60, n.value.length * 9.6 + 16)) + 'px'; };
  fitName();
  n.oninput = fitName;
  n.onkeydown = e => { if (e.key === 'Enter') n.blur(); if (e.key === 'Escape') { n.value = WB.board.name; n.blur(); } };
  n.onchange = () => { if (n.value.trim() && n.value.trim() !== WB.board.name) { WB.renameBoard(WB.board.id, n.value); WB.emit('toast', 'Renamed'); } else n.value = WB.board.name; fitName(); };
  $('#u-boards').onclick = UI.toggleDrawer;
  $('#u-folder').onclick = e => UI.folderPop(e.currentTarget, WB.board.id);
  status();
}
function status() {
  const s = $('#u-status'); if (!s) return;
  s.className = 'status ' + WB.status;
  s.innerHTML = WB.status === 'saving' ? '<i></i>Saving…' : WB.status === 'error' ? '<i></i>Not saved' : '<i></i>Saved';
}
function barR() {
  $('#bar-r').innerHTML = `<button class="ib" id="u-undo" title="Undo (Ctrl+Z)">${ic(ICON.undo)}</button><button class="ib" id="u-redo" title="Redo (Ctrl+Shift+Z)">${ic(ICON.redo)}</button><span class="sep"></span>
    <div class="zoom"><button class="ib" id="u-zout" title="Zoom out (Ctrl −)">${ic(ICON.minus)}</button><button class="zv" id="u-zv" title="Zoom options"></button><button class="ib" id="u-zin" title="Zoom in (Ctrl +)">${ic(ICON.plus)}</button><button class="ib" id="u-fit" title="Fit to screen (Shift+1)">${ic(ICON.fit)}</button></div><span class="sep"></span>
    <button class="btn dark" id="u-export">${ic(ICON.export, 18)}<span>Export</span></button>`;
  $('#u-undo').onclick = WB.undo; $('#u-redo').onclick = WB.redo;
  $('#u-zout').onclick = () => WB.zoomMid(1 / 1.25); $('#u-zin').onclick = () => WB.zoomMid(1.25); $('#u-fit').onclick = () => WB.fit();
  $('#u-zv').onclick = e => UI.zoomPop(e.currentTarget);
  $('#u-export').onclick = e => UI.exportPop(e.currentTarget);
  zoomLabel(); hist();
}
function hist() {
  const u = $('#u-undo'), r = $('#u-redo'); if (!u) return;
  u.disabled = !WB.undoStack.length || !WB.canEdit(); r.disabled = !WB.redoStack.length || !WB.canEdit();
  u.title = WB.undoStack.length ? `Undo ${WB.undoStack[WB.undoStack.length - 1].label} (Ctrl+Z)` : 'Nothing to undo';
}
function zoomLabel() { const z = $('#u-zv'); if (z) z.textContent = Math.round(WB.cam.z * 100) + '%'; }
function people() {
  const box = $('#u-people'); if (!box) return;
  const peers = Object.values(WB.peers);
  box.innerHTML = `<button class="av me" style="--c:${WB.me.color}" title="You (${esc(WB.me.name)}) · ${WB.role()}">${esc(WB.me.name[0])}</button>` +
    peers.slice(0, 4).map(p => `<button class="av" data-peer="${p.id}" style="--c:${p.color}" title="${esc(p.name)} is here · click to go to them">${esc(p.name[0])}<i></i></button>`).join('') +
    (peers.length > 4 ? `<span class="av more">+${peers.length - 4}</span>` : '') +
    `<span class="online">${peers.length ? peers.length + 1 + ' here' : 'Only you'}</span>`;
  $$('[data-peer]', box).forEach(b => b.onclick = () => {
    const p = WB.peers[b.dataset.peer]; if (!p || p.x == null) return;
    const v = WB.view(); WB.setCam(v.x + v.w / 2 - p.x * WB.cam.z, v.y + v.h / 2 - p.y * WB.cam.z, WB.cam.z);
  });
}

// ---------- tool rail and its option flyouts ----------
const TOOLS = [['select', 'Select', 'V'], ['hand', 'Hand', 'H'], 0, ['note', 'Sticky note', 'N'], ['text', 'Text', 'T'], ['shape', 'Shapes', 'S'], ['line', 'Connector', 'L'], 0, ['pen', 'Pen', 'P'], ['hl', 'Highlighter', 'M'], 0, ['section', 'Section', 'F'], ['stamp', 'Stamp', 'E'], ['comment', 'Comment', 'C'], ['link', 'Link or embed', 'K'], 0, ['upload', 'Upload image', ''], ['templates', 'Templates', '']];
const FLY = {
  note: () => `<div class="ft">Sticky colour</div><div class="sws">${WB.PAL.note.map(c => `<button class="sw ${c === WB.opts.note ? 'on' : ''}" data-o="note" data-v="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}</div>`,
  shape: () => `<div class="ft">Shape</div><div class="kinds">${WB.SHAPES.map(k => `<button class="${k === WB.opts.shape ? 'on' : ''}" data-o="shape" data-v="${k}" title="${k}">${SHAPE_ICON(k)}</button>`).join('')}</div><div class="ft">Fill</div><div class="sws">${WB.PAL.fill.map(c => `<button class="sw ${c === WB.opts.fill ? 'on' : ''}${c === 'transparent' ? ' none' : ''}" data-o="fill" data-v="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}</div>`,
  line: () => `<div class="ft">Line</div><div class="seg">${[['curve', 'Curved'], ['straight', 'Straight'], ['elbow', 'Elbow']].map(([v, n]) => `<button class="${WB.opts.line === v ? 'on' : ''}" data-o="line" data-v="${v}">${n}</button>`).join('')}</div><div class="ft">Arrow</div><div class="seg">${[['none', 'None'], ['end', 'End'], ['both', 'Both']].map(([v, n]) => `<button class="${WB.opts.arrow === v ? 'on' : ''}" data-o="arrow" data-v="${v}">${n}</button>`).join('')}</div>`,
  pen: () => `<div class="ft">Pen colour</div><div class="sws">${WB.PAL.ink.map(c => `<button class="sw ${c === WB.opts.pen ? 'on' : ''}" data-o="pen" data-v="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}</div><div class="ft">Size</div><div class="seg">${[2, 3, 6, 10].map(n => `<button class="${WB.opts.penW === n ? 'on' : ''}" data-o="penW" data-v="${n}"><i class="dot" style="width:${n + 2}px;height:${n + 2}px"></i></button>`).join('')}</div>`,
  hl: () => `<div class="ft">Highlighter</div><div class="sws">${WB.PAL.hl.map(c => `<button class="sw ${c === WB.opts.hl ? 'on' : ''}" data-o="hl" data-v="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}</div>`,
  stamp: () => `<div class="ft">Stamp · click the board to place</div><div class="stamps">${WB.PAL.stamps.map(s => `<button class="${s === WB.opts.stamp ? 'on' : ''}" data-o="stamp" data-v="${s}">${s}</button>`).join('')}</div>`,
};
// pages of the app: the first toolbar button lists them (keys 1–7 jump there)
const APP = [['home', 'Home', '<path d="M3.5 9 10 3.5 16.5 9v7.5h-13z"/><path d="M8 16.5v-4h4v4"/>'], ['today', 'Today', '<rect x="3.5" y="3.5" width="13" height="13" rx="3"/><path d="M7 10.2 9.2 12.4 13.2 7.8"/>'], ['hours', 'Hours', '<circle cx="10" cy="10" r="6.8"/><path d="M10 6.3V10l2.6 1.7"/>'], ['calendar', 'Calendar', '<rect x="3.5" y="4.5" width="13" height="12" rx="2.5"/><path d="M3.5 8.5h13M7 3v3M13 3v3"/>'], ['ideas', 'Ideas board', '<path d="M4 4h12v8l-4 4H4z"/><path d="M12 16v-4h4"/>'], ['wall', 'Memory wall', '<path d="M10 11.5v6M6.5 3.5h7l-1 4 2.5 3h-10l2.5-3z"/>'], ['review', 'Review files', '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.5 2h6A1.5 1.5 0 0 1 17 8.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"/>']];
UI.go = i => {
  const page = APP[i]?.[0]; if (!page || page === 'ideas') return;
  if (EMBED && window.parent !== window) window.parent.location.hash = page; else location.href = 'index.html#' + page;
};
UI.navMenu = anchor => {
  const p = UI.pop(`<div class="navm">${APP.map(([k, n, d], i) => `<button data-go="${i}" class="${k === 'ideas' ? 'on' : ''}">${ic(d)}<span>${n}</span><kbd>${i + 1}</kbd></button>`).join('')}</div>`, { anchor, cls: 'navpop', key: 'nav' });
  if (!p) return;
  const r = anchor.getBoundingClientRect(); p.style.left = r.left + 'px'; p.style.top = r.top - p.offsetHeight - 10 + 'px';
  p.onclick = e => { const b = e.target.closest('[data-go]'); if (b) { UI.closePops(); UI.go(+b.dataset.go); } };
};
function tools() {
  const edit = WB.canEdit();
  let list = TOOLS.filter(t => !t || edit || ['select', 'hand', 'comment'].includes(t[0]));
  list = list.filter((t, i) => t || (i > 0 && list[i - 1] && i < list.length - 1));
  $('#tools').innerHTML = `<button class="navb" id="u-nav" title="Go to another page (1–7)" aria-label="Pages">${ic(APP[4][2])}<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5 6 4.5l3 3"/></svg></button><span class="tsep"></span>` + list.map(t => !t ? '<span class="tsep"></span>' :
    `<button class="tb${WB.tool === t[0] ? ' on' : ''}" data-tool="${t[0]}" title="${t[1]}${t[2] ? ' (' + t[2] + ')' : ''}" aria-label="${t[1]}">${t[0] === 'note' ? `<span class="nico" style="--c:${WB.opts.note}"></span>` : ic(ICON[t[0]])}${FLY[t[0]] ? '<i class="more"></i>' : ''}</button>`).join('');
}
function flyout(t, btn) {
  const f = $('#flyout');
  if (!FLY[t]) { f.hidden = true; return; }
  f.innerHTML = FLY[t](); f.hidden = false; f.dataset.tool = t;
  const r = btn.getBoundingClientRect(), bar = $('#tools').getBoundingClientRect();
  f.style.left = clamp(r.left + r.width / 2 - f.offsetWidth / 2, 12, innerWidth - f.offsetWidth - 12) + 'px';
  f.style.top = bar.top - f.offsetHeight - 10 + 'px';
}
$('#tools').addEventListener('click', e => {
  if (e.target.closest('#u-nav')) { UI.navMenu($('#u-nav')); return; }
  const b = e.target.closest('[data-tool]'); if (!b) return;
  const t = b.dataset.tool;
  if (t === 'upload') { $('#file').click(); return; }
  if (t === 'templates') { UI.templates(); return; }
  const wasOpen = !$('#flyout').hidden && $('#flyout').dataset.tool === t;
  WB.setTool(t);
  if (wasOpen) $('#flyout').hidden = true; else flyout(t, $(`#tools [data-tool="${t}"]`));
});
$('#flyout').addEventListener('click', e => {
  const b = e.target.closest('[data-o]'); if (!b) return;
  WB.opts[b.dataset.o] = b.dataset.o === 'penW' ? +b.dataset.v : b.dataset.v;
  const t = $('#flyout').dataset.tool; tools(); flyout(t, $(`#tools [data-tool="${t}"]`));
});
$('#file').addEventListener('change', e => { WB.importImages(e.target.files); e.target.value = ''; });

// ---------- properties panel ----------
UI.panelOpen = false; UI.tab = 'design';
UI.openPanel = () => UI.more($('#ctx [data-act="more"]'));
const sec = (t, body) => `<div class="psec">${t ? `<div class="pt">${t}</div>` : ''}${body}</div>`;
const sws = (k, list, types, cur) => `<div class="sws">${list.map(c => `<button class="sw ${c === cur ? 'on' : ''}${c === 'transparent' ? ' none' : ''}" data-set="${k}" data-v="${c}" data-types="${types}" style="--c:${c}" aria-label="${c}"></button>`).join('')}</div>`;
const seg = (k, opts, types, cur, num) => `<div class="seg">${opts.map(([v, n]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-set="${k}" data-v="${v}" data-types="${types}"${num ? ' data-num' : ''}>${n}</button>`).join('')}</div>`;
function boardHTML() {
  const st = WB.board.meta.settings || {}, counts = {};
  Object.values(WB.objs).forEach(o => { counts[o.type] = (counts[o.type] || 0) + 1; });
  return `<div class="phead"><b>${esc(WB.board.name)}</b><small>${Object.keys(WB.objs).length} objects</small></div>
    ${sec('Background', `<div class="bgs">${[['paper', '#F2F1ED'], ['white', '#FFFFFF'], ['warm', '#F6EFE3'], ['dark', '#1F1F23']].map(([k, c]) => `<button class="${(st.bg || 'paper') === k ? 'on' : ''}" data-act="bg" data-v="${k}" style="--c:${c}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>`)}
    ${sec('Canvas', `<button class="tog ${st.grid !== false ? 'on' : ''}" data-act="grid"><i></i>Dot grid</button><button class="tog ${st.snap !== false ? 'on' : ''}" data-act="snap"><i></i>Snap to other objects</button>`)}
    ${sec('On this board', `<div class="counts">${Object.entries(counts).map(([k, n]) => `<span>${n} ${TYPE_NAME[k].toLowerCase()}${n > 1 && !/s$/.test(TYPE_NAME[k]) ? 's' : ''}</span>`).join('') || '<span>Nothing yet</span>'}</div>`)}
    ${sec('Shortcuts', `<div class="keys">${[['V', 'Select'], ['H / Space', 'Pan'], ['N', 'Sticky'], ['T', 'Text'], ['S', 'Shape'], ['L', 'Connector'], ['P / M', 'Pen / highlighter'], ['F', 'Section'], ['C', 'Comment'], ['Tab', 'Mind-map branch'], ['Ctrl D', 'Duplicate'], ['Ctrl G', 'Group'], ['Shift 1', 'Fit board'], ['1–6', 'React']].map(([k, n]) => `<span><kbd>${k}</kbd>${n}</span>`).join('')}</div>`)}`;
}
function designHTML() {
  const sel = selObjs();
  if (!sel.length) return boardHTML();
  const o = sel[0], one = sel.length === 1, type = new Set(sel.map(x => x.type)).size === 1 ? o.type : null;
  let h = `<div class="phead"><b>${one ? TYPE_NAME[o.type] : sel.length + ' objects'}</b>${one && o.by ? `<small>added by ${esc(o.by)}</small>` : ''}</div>`;
  if (!WB.canEdit()) return h + '<p class="pnote">You can view and comment on this board.</p>';
  if (type === 'note') h += sec('Colour', sws('color', WB.PAL.note, 'note', o.color));
  if (type === 'shape') {
    h += sec('Shape', `<div class="kinds">${WB.SHAPES.map(k => `<button class="${k === o.kind ? 'on' : ''}" data-set="kind" data-v="${k}" data-types="shape" title="${k}">${SHAPE_ICON(k)}</button>`).join('')}</div>`);
    h += sec('Fill', sws('fill', WB.PAL.fill, 'shape', o.fill));
    h += sec('Border', seg('sw', [[0, 'None'], [2, 'Thin'], [4, 'Thick']], 'shape', o.sw || 0, true) + (o.sw ? sws('stroke', WB.PAL.ink, 'shape', o.stroke) : ''));
  }
  if (type === 'text') h += sec('Colour', sws('color', WB.PAL.ink, 'text', o.color || '#1C1C1E'));
  if (type === 'section') h += (one ? sec('Title', `<input data-in="text" value="${esc(o.text)}">`) : '') + sec('Colour', sws('color', WB.PAL.section, 'section', o.color));
  if (type === 'ink') h += sec('Colour', sws('color', o.hl ? WB.PAL.hl : WB.PAL.ink, 'ink', o.color)) + sec('Width', seg('sw', o.hl ? [[12, 'Thin'], [18, 'Medium'], [28, 'Wide']] : [[2, 'Fine'], [3, 'Normal'], [6, 'Bold'], [10, 'Marker']], 'ink', o.sw, true));
  if (type === 'line') {
    h += sec('Style', seg('style', [['curve', 'Curved'], ['straight', 'Straight'], ['elbow', 'Elbow']], 'line', o.style || 'curve'));
    h += sec('Arrows', seg('arrow', [['none', 'None'], ['end', 'End'], ['both', 'Both']], 'line', o.arrow || 'none'));
    h += sec('Colour', sws('color', WB.PAL.ink, 'line', o.color)) + sec('Width', seg('sw', [[1, 'Thin'], [2, 'Normal'], [4, 'Thick']], 'line', o.sw || 2, true));
    h += sec('', `<button class="tog ${o.dash ? 'on' : ''}" data-set="dash" data-toggle data-types="line"><i></i>Dashed</button>`);
    if (one) h += sec('Label', `<input data-in="text" value="${esc(o.text || '')}" placeholder="Yes, No, then…">`);
  }
  if (type === 'stamp') h += sec('Stamp', `<div class="stamps">${WB.PAL.stamps.map(s => `<button class="${s === o.emoji ? 'on' : ''}" data-set="emoji" data-v="${s}" data-types="stamp">${s}</button>`).join('')}</div>`);
  if (type === 'link' && one) h += sec('Link', `<input data-in="url" value="${esc(o.url)}" aria-label="Address"><input data-in="title" value="${esc(o.title)}" aria-label="Title"><button class="pbtn" data-act="open">${ic(ICON.open, 15)}Open link</button>`);
  if (type === 'image' && one) h += sec('Image', `<p class="pnote">${Math.round(o.w)} × ${Math.round(o.h)}. Corners keep the shape; hold Shift to stretch.</p>`);
  if (type === 'poll' && one) h += sec('Question', `<input data-in="q" value="${esc(o.q)}">`) + sec('Options', o.opts.map((p, i) => `<div class="optrow"><input data-in="opt" data-i="${i}" value="${esc(p.t)}" aria-label="Option ${i + 1}"><span>${Object.keys(p.v || {}).length}</span>${o.opts.length > 2 ? `<button data-act="rm-opt" data-i="${i}" title="Remove option">${ic(ICON.x, 14)}</button>` : ''}</div>`).join('') + `<div class="prow">${o.opts.length < 6 ? '<button class="pbtn" data-act="add-opt">+ Option</button>' : ''}<button class="pbtn" data-act="reset-poll">Reset votes</button></div>`);
  if (type === 'comment' && one) h += sec('', `<button class="pbtn" data-act="thread">Open thread</button>`);
  if (sel.some(x => ['note', 'text', 'shape'].includes(x.type))) {
    const al = o.align || (o.type === 'text' ? 'left' : 'center');
    h += sec('Text', seg('fs', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']], 'note,text,shape', o.fs || 'm') +
      `<div class="seg">${[['left', 'l'], ['center', 'c'], ['right', 'r']].map(([v, k]) => `<button class="${al === v ? 'on' : ''}" data-set="align" data-v="${v}" data-types="note,text,shape" title="Text ${v}">${ic(ICON.al[k], 16)}</button>`).join('')}<button class="${o.bold ? 'on' : ''}" data-set="bold" data-toggle data-types="text,shape" title="Bold"><b>B</b></button></div>`);
  }
  if (one && o.type !== 'line') h += sec('Position', `<div class="xywh">${[['x', 'X'], ['y', 'Y'], ['w', 'W'], ['h', 'H'], ['r', '°']].map(([k, n]) => `<label><span>${n}</span><input data-in="${k}" type="number" value="${Math.round(o[k] || 0)}"${o.locked ? ' disabled' : ''}></label>`).join('')}</div>`);
  if (sel.filter(x => x.type !== 'line').length > 1) h += sec('Align', `<div class="algn">${Object.keys(ALIGN).map(a => `<button data-align="${a}" title="${ALIGN[a]}">${ic(ICON.al[a], 17)}</button>`).join('')}</div>`);
  h += sec('Arrange', `<div class="acts"><button data-act="front">To front</button><button data-act="up">Forward</button><button data-act="down">Backward</button><button data-act="back">To back</button>${sel.length > 1 ? '<button data-act="group">Group</button>' : ''}${sel.some(x => x.g) ? '<button data-act="ungroup">Ungroup</button>' : ''}<button data-act="lock">${sel.every(x => x.locked) ? 'Unlock' : 'Lock'}</button><button data-act="dup">Duplicate</button><button data-act="del" class="red">Delete</button></div>`);
  return h;
}
const selKey = () => [...WB.sel].join(',');
// the options card for what is selected: opened from ⋯ in the bar above it, or by double-clicking
function panel() {
  const p = $('#pops .pop.props'); if (!p) return;
  if (!WB.sel.size) { UI.closePops(); return; }
  const a = document.activeElement;
  if (p.contains(a) && a.matches('input') && p._key === selKey()) return; // don't wipe what you are typing
  p._key = selKey();
  p.querySelector('.pbody').innerHTML = designHTML();
}
UI.more = (anchor, x, y) => {
  if (!WB.sel.size) return;
  const p = UI.pop(`<div class="pbody">${designHTML()}</div>`, { anchor, x, y, cls: 'props', key: anchor ? 'more' : null });
  if (!p) return;
  p._key = selKey();
  p.addEventListener('click', propsClick); p.addEventListener('change', propsChange); p.addEventListener('keydown', propsKey);
};
let panelF = 0;
const panelSoon = () => { if (!panelF) panelF = requestAnimationFrame(() => { panelF = 0; panel(); }); };
function applySet(b) {
  const k = b.dataset.set, types = b.dataset.types?.split(',');
  if (b.hasAttribute('data-toggle')) { const on = !selObjs().filter(o => !types || types.includes(o.type)).every(o => o[k]); WB.I.patch({ [k]: on || undefined }, types); return; }
  let v = b.dataset.v; if (b.hasAttribute('data-num')) v = +v;
  const patch = { [k]: v };
  if (k === 'sw' && v > 0 && types?.includes('shape') && !selObjs().every(o => o.stroke)) patch.stroke = '#1C1C1E';
  WB.I.patch(patch, types);
}
async function propsClick(e) {
  const t = e.target.closest('[data-tab],[data-set],[data-act],[data-align],[data-sel]'); if (!t) return;
  if (t.dataset.tab) { UI.tab = t.dataset.tab; panel(); return; }
  if (t.dataset.set) return applySet(t);
  if (t.dataset.align) return WB.I.align(t.dataset.align);
  if (t.dataset.sel) {
    const id = t.dataset.sel; if (e.shiftKey) { const s = new Set(WB.sel); s.has(id) ? s.delete(id) : s.add(id); WB.setSel(s); } else WB.select([id]);
    const o = WB.objs[id], b = WB.box(o), a = WB.toScreen(b.x, b.y), v = WB.view();
    if (a.x < v.x || a.y < v.y || a.x > v.x + v.w || a.y > v.y + v.h) WB.setCam(v.x + v.w / 2 - (b.x + b.w / 2) * WB.cam.z, v.y + v.h / 2 - (b.y + b.h / 2) * WB.cam.z, WB.cam.z);
    return;
  }
  const act = t.dataset.act, o = selObjs()[0], I = WB.I;
  const st = WB.board.meta.settings || {};
  if (act === 'bg') WB.setMeta({ settings: { ...st, bg: t.dataset.v } });
  else if (act === 'grid') WB.setMeta({ settings: { ...st, grid: st.grid === false } });
  else if (act === 'snap') WB.setMeta({ settings: { ...st, snap: st.snap === false } });
  else if (act === 'front' || act === 'back' || act === 'up' || act === 'down') I.order(act);
  else if (act === 'group') I.group(); else if (act === 'ungroup') I.ungroup(); else if (act === 'lock') I.lock();
  else if (act === 'dup') I.duplicate(); else if (act === 'del') I.del();
  else if (act === 'open' && o) window.open(o.url, '_blank', 'noopener');
  else if (act === 'add-opt' && o) WB.act('Add option', () => WB.update(o.id, { opts: [...o.opts, { t: 'Option ' + String.fromCharCode(65 + o.opts.length), v: {} }], h: WB.pollHeight(o.opts.length + 1) }));
  else if (act === 'rm-opt' && o) WB.act('Remove option', () => WB.update(o.id, { opts: o.opts.filter((_, i) => i !== +t.dataset.i), h: WB.pollHeight(o.opts.length - 1) }));
  else if (act === 'reset-poll' && o) WB.act('Reset poll', () => WB.update(o.id, { opts: o.opts.map(p => ({ ...p, v: {} })) }));
  else if (act === 'thread' && o) UI.thread(o.id);
  else if (act === 'show-resolved') { UI.showResolved = !UI.showResolved; panel(); }
  else if (act === 'jump') { const c = WB.objs[t.dataset.id]; if (!c) return; WB.select([c.id]); const v = WB.view(); WB.setCam(v.x + v.w / 2 - c.x * WB.cam.z, v.y + v.h / 2 - c.y * WB.cam.z, WB.cam.z); UI.thread(c.id); }
  else if (act === 'save-version') { WB.save(true); WB.snapshot('Saved version'); WB.emit('toast', 'Version saved'); panel(); }
  else if (act === 'restore') { const v = WB.versions()[+t.dataset.i]; if (v && await UI.confirm(`Restore “${v.label}” from ${timeAgo(v.t)}?`, 'Restore', false, 'The board goes back to how it was then. You can undo this.')) { WB.restoreVersion(+t.dataset.i); WB.emit('toast', 'Version restored'); } }
}
function propsChange(e) {
  const t = e.target.closest('[data-in]'); if (!t) return;
  const k = t.dataset.in, o = selObjs()[0]; if (!o) return;
  if (['x', 'y', 'w', 'h', 'r'].includes(k)) { const n = +t.value; if (!isFinite(n)) return; WB.act('Edit ' + k.toUpperCase(), () => WB.update(o.id, { [k]: k === 'w' || k === 'h' ? Math.max(4, n) : n })); }
  else if (k === 'opt') WB.act('Edit option', () => WB.update(o.id, { opts: o.opts.map((p, i) => i === +t.dataset.i ? { ...p, t: t.value } : p) }));
  else WB.act('Edit ' + k, () => WB.update(o.id, { [k]: t.value }));
  t.blur();
}
function propsKey(e) { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); if (e.key !== 'Escape') e.stopPropagation(); }

// ---------- context bar above the selection ----------
function ctx() {
  const c = $('#ctx'), sel = selObjs();
  if (!sel.length || !WB.canEdit() || WB.I.editing || document.body.classList.contains('dragging') || (sel.length === 1 && sel[0].type === 'comment')) { c.hidden = true; return; }
  const o = sel[0], type = new Set(sel.map(x => x.type)).size === 1 ? o.type : null;
  const dots = (k, list, types, cur) => list.map(v => `<button class="cdot ${v === cur ? 'on' : ''}${v === 'transparent' ? ' none' : ''}" data-set="${k}" data-v="${v}" data-types="${types}" style="--c:${v}" aria-label="${v}"></button>`).join('');
  let h = '';
  if (type === 'note') h += dots('color', WB.PAL.note.slice(0, 7), 'note', o.color) + '<span class="csep"></span>' + `<button class="cb" data-cycle="fs" title="Text size">Aa <small>${(o.fs || 'm').toUpperCase()}</small></button>`;
  else if (type === 'shape') h += `<button class="cb" data-cycle="kind" title="Change shape">${SHAPE_ICON(o.kind)}</button><span class="csep"></span>` + dots('fill', WB.PAL.fill.slice(0, 7), 'shape', o.fill);
  else if (type === 'text') h += dots('color', WB.PAL.ink.slice(0, 6), 'text', o.color || '#1C1C1E') + '<span class="csep"></span>' + `<button class="cb${o.bold ? ' on' : ''}" data-set="bold" data-toggle data-types="text"><b>B</b></button><button class="cb" data-cycle="fs" title="Text size">Aa <small>${(o.fs || 'l').toUpperCase()}</small></button>`;
  else if (type === 'line') h += `<button class="cb" data-cycle="style" title="Line style">${{ curve: 'Curved', straight: 'Straight', elbow: 'Elbow' }[o.style || 'curve']}</button><button class="cb" data-cycle="arrow" title="Arrows">${{ none: '—', end: '→', both: '↔' }[o.arrow || 'none']}</button><span class="csep"></span>` + dots('color', WB.PAL.ink.slice(0, 6), 'line', o.color);
  else if (type === 'ink') h += dots('color', (o.hl ? WB.PAL.hl : WB.PAL.ink).slice(0, 6), 'ink', o.color);
  else if (type === 'section') h += dots('color', WB.PAL.section, 'section', o.color);
  else if (type === 'link') h += `<button class="cb" data-act="open">${ic(ICON.open, 16)} Open</button>`;
  else if (type === 'stamp') h += WB.PAL.stamps.slice(0, 6).map(s => `<button class="cb em${s === o.emoji ? ' on' : ''}" data-set="emoji" data-v="${s}" data-types="stamp">${s}</button>`).join('');
  if (sel.length > 1) h += sel.some(x => x.g) ? '<button class="cb" data-act="ungroup">Ungroup</button>' : '<button class="cb" data-act="group">Group</button>';
  h += `${h ? '<span class="csep"></span>' : ''}<button class="cb" data-act="dup" title="Duplicate (Ctrl+D)">${ic(ICON.dup, 17)}</button><button class="cb" data-act="del" title="Delete">${ic(ICON.trash, 17)}</button><button class="cb" data-act="more" title="More in the panel">${ic(ICON.more, 17)}</button>`;
  c.innerHTML = h; c.hidden = false;
  const b = WB.bounds(sel), a = WB.toScreen(b.x, b.y), z = WB.cam.z, w = c.offsetWidth;
  let top = a.y - c.offsetHeight - (sel.length === 1 && !['section', 'line', 'poll'].includes(o.type) ? 44 : 14);
  if (top < 70) top = a.y + b.h * z + 16;
  c.style.left = clamp(a.x + b.w * z / 2 - w / 2, 70, innerWidth - w - (UI.panelOpen ? 300 : 12)) + 'px';
  c.style.top = clamp(top, 70, innerHeight - 60) + 'px';
}
const CYCLE = { fs: ['s', 'm', 'l', 'xl'], kind: WB.SHAPES, style: ['curve', 'straight', 'elbow'], arrow: ['end', 'both', 'none'] };
$('#ctx').addEventListener('click', e => {
  const t = e.target.closest('[data-set],[data-cycle],[data-act]'); if (!t) return;
  if (t.dataset.set) return applySet(t);
  const o = selObjs()[0];
  if (t.dataset.cycle) { const k = t.dataset.cycle, list = CYCLE[k], cur = o[k] || (k === 'fs' ? 'm' : list[0]); WB.I.patch({ [k]: list[(list.indexOf(cur) + 1) % list.length] }, [o.type]); return; }
  const a = t.dataset.act;
  if (a === 'dup') WB.I.duplicate(); else if (a === 'del') WB.I.del(); else if (a === 'group') WB.I.group(); else if (a === 'ungroup') WB.I.ungroup();
  else if (a === 'more') UI.more(t); else if (a === 'open' && o) window.open(o.url, '_blank', 'noopener');
});


// ---------- zoom, export, folder menus ----------
UI.zoomPop = anchor => {
  const p = UI.pop(`<div class="menu">${[[.25, '25%'], [.5, '50%'], [1, '100%'], [2, '200%']].map(([z, n]) => `<button data-z="${z}">${n}</button>`).join('')}<hr><button data-z="fit">Fit board<kbd>Shift 1</kbd></button><button data-z="sel" ${WB.sel.size ? '' : 'disabled'}>Fit selection<kbd>Shift 2</kbd></button><hr><button data-z="grid">Dot grid<kbd>${WB.board.meta.settings?.grid === false ? 'Off' : 'On'}</kbd></button></div>`, { anchor, key: 'zoom' });
  if (p) p.onclick = e => { const b = e.target.closest('[data-z]'); if (!b) return; const z = b.dataset.z; UI.closePops(); if (z === 'grid') { const st = WB.board.meta.settings || {}; WB.setMeta({ settings: { ...st, grid: st.grid === false } }); } else if (z === 'fit') WB.fit(); else if (z === 'sel') WB.fit([...WB.sel], 2); else WB.zoomMid(+z / WB.cam.z); };
};
UI.exportPop = anchor => {
  const p = UI.pop(`<div class="ph">Export</div>
    <div class="seg full">${['png', 'svg', 'pdf'].map(f => `<button class="${UI.fmt === f ? 'on' : ''}" data-f="${f}">${f.toUpperCase()}</button>`).join('')}</div>
    <div class="seg full">${[['board', 'Whole board'], ['sel', 'Selection']].map(([k, n]) => `<button class="${UI.scope === k ? 'on' : ''}" data-s="${k}" ${k === 'sel' && !WB.sel.size ? 'disabled' : ''}>${n}</button>`).join('')}</div>
    <p class="pnote">PNG and PDF at 2× for sharp text. Comments are left out.</p><button class="btn dark wide" data-go>Export ${UI.fmt.toUpperCase()}</button>`, { anchor, cls: 'exp', place: 'below-right', key: 'export' });
  if (!p) return;
  p.onclick = e => {
    const f = e.target.closest('[data-f]'), s = e.target.closest('[data-s]');
    if (f) { UI.fmt = f.dataset.f; UI.openKey = null; UI.exportPop(anchor); return; }
    if (s && !s.disabled) { UI.scope = s.dataset.s; UI.openKey = null; UI.exportPop(anchor); return; }
    if (e.target.closest('[data-go]')) { UI.closePops(); WB.exportBoard(UI.fmt, UI.scope === 'sel'); }
  };
};
UI.folderPop = (anchor, id) => {
  const cur = (id === WB.board.id ? WB.board : WB.getBoard(id))?.folder;
  const p = UI.pop(`<div class="ph">Move to folder</div><div class="menu">${WB.folders().map(f => `<button data-f="${esc(f)}">${ic(ICON.folder, 16)}${esc(f)}${f === cur ? ` <span class="ck">${ic(ICON.check, 15)}</span>` : ''}</button>`).join('')}<hr><button data-new>${ic(ICON.plus, 16)}New folder…</button></div>`, { anchor, key: 'folder' + id });
  if (!p) return;
  p.onclick = async e => {
    const b = e.target.closest('[data-f],[data-new]'); if (!b) return;
    UI.closePops();
    let f = b.dataset.f;
    if (b.hasAttribute('data-new')) { f = await UI.ask('New folder', '', 'Create', 'e.g. KamiLabs'); if (!f) return; if (!WB.folders().includes(f)) WB.setFolders([...WB.folders(), f]); }
    WB.moveBoard(id, f); WB.emit('toast', `Moved to ${f}`);
  };
};

// ---------- right-click menu ----------
UI.ctxMenu = (x, y, id, at) => {
  const o = id && WB.objs[id], edit = WB.canEdit(), sel = selObjs();
  const items = o ? [
    edit && ['dup', 'Duplicate', 'Ctrl D'], ['copy', 'Copy', 'Ctrl C'], edit && ['paste', 'Paste here', 'Ctrl V'], 0,
    edit && ['front', 'Bring to front', 'Ctrl ]'], edit && ['back', 'Send to back', 'Ctrl ['],
    edit && sel.length > 1 && ['group', 'Group', 'Ctrl G'], edit && sel.some(s => s.g) && ['ungroup', 'Ungroup', 'Ctrl Shift G'],
    edit && ['lock', sel.every(s => s.locked) ? 'Unlock' : 'Lock', 'Ctrl L'],
    edit && sel.length === 1 && ['note', 'note', 'text', 'shape'].includes(o.type) && ['branch', 'Add branch', 'Tab'],
    ['comment', 'Comment here', ''], 0, edit && ['del', 'Delete', 'Del'],
  ] : [edit && ['paste', 'Paste here', 'Ctrl V'], edit && ['note', 'Add sticky here', ''], ['comment', 'Comment here', ''], ['all', 'Select all', 'Ctrl A'], 0, ['fit', 'Fit board', 'Shift 1']];
  const list = items.filter((it, i, arr) => it || (i > 0 && arr[i - 1]));
  const p = UI.pop(`<div class="menu">${list.map(it => !it ? '<hr>' : `<button data-m="${it[0]}"${it[0] === 'paste' && !WB.clip ? ' disabled' : ''} class="${it[0] === 'del' ? 'red' : ''}">${it[1]}${it[2] ? `<kbd>${it[2]}</kbd>` : ''}</button>`).join('')}</div>`, { x, y, cls: 'cmenu' });
  p.onclick = e => {
    const b = e.target.closest('[data-m]'); if (!b) return; UI.closePops();
    const m = b.dataset.m, I = WB.I;
    if (m === 'dup') I.duplicate(); else if (m === 'copy') { I.copy(false); WB.emit('toast', 'Copied'); } else if (m === 'paste') I.paste(WB.clip, { at });
    else if (m === 'front') I.order('front'); else if (m === 'back') I.order('back'); else if (m === 'group') I.group(); else if (m === 'ungroup') I.ungroup();
    else if (m === 'lock') I.lock(); else if (m === 'branch') WB.addChild(id); else if (m === 'del') I.del();
    else if (m === 'comment') UI.newComment(at, x, y); else if (m === 'all') WB.select(Object.keys(WB.objs)); else if (m === 'fit') WB.fit();
    else if (m === 'note') { let n; WB.act('Add sticky', () => { n = WB.add({ type: 'note', x: at.x - 100, y: at.y - 100, w: 200, h: 200, text: '', color: WB.opts.note, fs: 'm' }); }); WB.select([n.id]); setTimeout(() => WB.I.edit(n.id), 0); }
  };
};

// ---------- comments ----------
UI.thread = id => {
  const o = WB.objs[id]; if (!o) return;
  const s = WB.toScreen(o.x + o.w, o.y);
  const canDel = o.thread[0]?.by === WB.me.name || WB.role() === 'owner';
  const p = UI.pop(`<div class="th-head"><b>Comment</b><button class="ib s" data-c="resolve" title="${o.resolved ? 'Reopen' : 'Resolve'}" aria-label="${o.resolved ? 'Reopen' : 'Resolve'}">${ic(ICON.check, 16)}</button>${canDel ? `<button class="ib s" data-c="delete" title="Delete thread" aria-label="Delete thread">${ic(ICON.trash, 16)}</button>` : ''}<button class="ib s" data-c="close" aria-label="Close">${ic(ICON.x, 16)}</button></div>
    ${o.resolved ? '<div class="th-res">Resolved</div>' : ''}
    <div class="th-list">${o.thread.map(m => `<div class="msg">${avatar(m.by, 'sm')}<div><b>${esc(m.by)}</b><small>${timeAgo(m.at)}</small><p>${esc(m.text)}</p></div></div>`).join('')}</div>
    <form class="th-form"><input placeholder="Reply…" aria-label="Reply" autocomplete="off"><button class="ib s dark" aria-label="Send">${ic(ICON.send, 16)}</button></form>`, { x: s.x + 12, y: s.y - 8, cls: 'thread' });
  p.dataset.thread = id;
  p.querySelector('form').onsubmit = e => { e.preventDefault(); const v = p.querySelector('input').value.trim(); if (!v) return; WB.comments.reply(id, v); UI.thread(id); };
  p.onclick = e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    if (b.dataset.c === 'close') UI.closePops();
    if (b.dataset.c === 'resolve') { WB.comments.resolve(id); UI.closePops(); }
    if (b.dataset.c === 'delete') { WB.comments.remove(id); UI.closePops(); }
  };
  setTimeout(() => p.querySelector('input')?.focus(), 20);
};
UI.newComment = (at, sx, sy) => {
  const p = UI.pop(`<form class="th-form new">${avatar(WB.me.name, 'sm')}<input placeholder="Add a comment…" aria-label="Comment" autocomplete="off"><button class="ib s dark" aria-label="Post">${ic(ICON.send, 16)}</button></form>`, { x: sx + 14, y: sy - 22, cls: 'thread newc' });
  p.querySelector('form').onsubmit = e => {
    e.preventDefault(); const v = p.querySelector('input').value.trim(); if (!v) return;
    const o = WB.comments.create(at.x, at.y, v); UI.closePops(); WB.setTool('select');
    if (o) { WB.select([o.id]); UI.thread(o.id); }
  };
  setTimeout(() => p.querySelector('input').focus(), 20);
};
UI.linkInput = (at, sx, sy) => {
  const p = UI.pop(`<form class="lform"><div class="ph">Add a link</div><input placeholder="Paste a link: YouTube, Figma, any site" aria-label="Link" autocomplete="off"><button class="btn dark">Add</button></form>`, { x: sx, y: sy, cls: 'linkp' });
  p.querySelector('form').onsubmit = e => { e.preventDefault(); const v = p.querySelector('input').value; if (!v.trim()) return; UI.closePops(); WB.addLink(v, at); WB.setTool('select'); };
  setTimeout(() => p.querySelector('input').focus(), 20);
};
UI.lineLabel = (id, sx, sy) => {
  if (!WB.canEdit()) return;
  const o = WB.objs[id];
  const p = UI.pop(`<form class="lform"><div class="ph">Label</div><input value="${esc(o.text || '')}" placeholder="Yes, No, then…" aria-label="Label" autocomplete="off"><button class="btn dark">Save</button></form>`, { x: sx - 120, y: sy + 12, cls: 'linkp' });
  p.querySelector('form').onsubmit = e => { e.preventDefault(); UI.closePops(); WB.act('Label connector', () => WB.update(id, { text: p.querySelector('input').value.trim() })); };
  setTimeout(() => p.querySelector('input').select(), 20);
};

// ---------- templates ----------
const TPL_ART = {
  brainstorm: '<rect x="6" y="8" width="88" height="54" rx="8" fill="#FFF7DD" stroke="#00000012"/>' + [0, 1, 2, 3].map(i => `<rect x="${12 + i * 20}" y="20" width="16" height="16" rx="3" fill="${['#FFE380', '#FFC27A', '#FFB3D1', '#CFC2FF'][i]}"/><rect x="${12 + i * 20}" y="40" width="16" height="16" rx="3" fill="${['#A9D8FF', '#A8EBBB', '#FFE380', '#FFC27A'][i]}"/>`).join(''),
  mindmap: '<path d="M50 35 C64 35 62 16 76 16 M50 35 C64 35 64 35 76 35 M50 35 C64 35 62 54 76 54 M50 35 C36 35 36 35 24 35" stroke="#1C1C1E" stroke-width="1.4" fill="none"/><rect x="36" y="27" width="28" height="16" rx="6" fill="#7B61FF"/><rect x="74" y="10" width="20" height="12" rx="3" fill="#A9D8FF"/><rect x="74" y="29" width="20" height="12" rx="3" fill="#A8EBBB"/><rect x="74" y="48" width="20" height="12" rx="3" fill="#FFC27A"/><rect x="6" y="29" width="20" height="12" rx="3" fill="#FFB3D1"/>',
  flowchart: '<ellipse cx="14" cy="35" rx="10" ry="6" fill="#A8EBBB"/><rect x="32" y="28" width="20" height="14" rx="3" fill="#A9D8FF"/><path d="M68 25 L78 35 L68 45 L58 35 Z" fill="#FFE380"/><ellipse cx="91" cy="35" rx="7" ry="5" fill="#A8EBBB"/><path d="M24 35H32M52 35H58M78 35H84" stroke="#1C1C1E" stroke-width="1.4"/>',
  retro: ['#EAF9EE', '#FFF0E3', '#F4F1FF'].map((c, i) => `<rect x="${6 + i * 30}" y="8" width="27" height="54" rx="5" fill="${c}" stroke="#00000012"/><rect x="${10 + i * 30}" y="20" width="12" height="12" rx="2" fill="${['#A8EBBB', '#FFC27A', '#CFC2FF'][i]}"/>`).join(''),
  kanban: ['#F2F2F4', '#EAF5FF', '#EAF9EE'].map((c, i) => `<rect x="${6 + i * 30}" y="8" width="27" height="54" rx="5" fill="${c}" stroke="#00000012"/><rect x="${9 + i * 30}" y="18" width="21" height="10" rx="2" fill="${['#FFE380', '#A9D8FF', '#A8EBBB'][i]}"/>${i === 0 ? '<rect x="9" y="31" width="21" height="10" rx="2" fill="#FFE380"/>' : ''}`).join(''),
  weekly: [0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${5 + i * 13}" y="10" width="11" height="50" rx="3" fill="${WB.PAL.section[i]}" stroke="#00000012"/><rect x="${6 + i * 13}" y="18" width="9" height="9" rx="2" fill="${WB.PAL.note[i % 6]}"/>`).join(''),
};
UI.templates = () => {
  if (!WB.canEdit()) return;
  const m = UI.modal(`<div class="mh"><h3>Templates</h3><button class="ib" data-close aria-label="Close">${ic(ICON.x)}</button></div><p class="msub">Dropped in the middle of your view, ready to edit. Undo takes it away again.</p>
    <div class="tpls">${Object.entries(WB.TEMPLATES).map(([k, t]) => `<button class="tpl" data-tpl="${k}" style="--t:${t.tint}"><svg viewBox="0 0 100 70" aria-hidden="true">${TPL_ART[k] || ''}</svg><b>${t.name}</b><small>${t.sub}</small></button>`).join('')}</div>`, 'wide');
  m.onclick = e => { const b = e.target.closest('[data-tpl]'); if (!b) return; m.close(); WB.insertTemplate(b.dataset.tpl); };
};

// ---------- boards drawer: folders, new, rename, duplicate, move, delete ----------
UI.toggleDrawer = () => { const d = $('#drawer'); d.hidden = !d.hidden; if (!d.hidden) drawer(); };
function drawer() {
  const d = $('#drawer'); if (d.hidden) return;
  const idx = WB.index(), folders = WB.folders(), q = UI.dq.toLowerCase();
  const groups = folders.map(f => [f, idx.filter(b => (folders.includes(b.folder) ? b.folder : folders[0]) === f && b.name.toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated)]);
  d.innerHTML = `<div class="dh"><b>Boards</b><button class="ib" data-d="close" aria-label="Close">${ic(ICON.x)}</button></div>
    <div class="dtools"><input class="dsearch" placeholder="Search boards" value="${esc(UI.dq)}" aria-label="Search boards"><button class="btn dark sm" data-d="new">${ic(ICON.plus, 15)}Board</button><button class="btn sm" data-d="folder">${ic(ICON.folder, 15)}Folder</button></div>
    <div class="dlist">${groups.map(([f, list]) => `<div class="dfold"><div class="fh">${ic(ICON.folder, 15)}<span class="fn">${esc(f)}</span><small>${list.length}</small><button class="ib s" data-d="frename" data-f="${esc(f)}" title="Rename folder" aria-label="Rename folder">${ic(ICON.edit, 14)}</button>${folders.length > 1 ? `<button class="ib s" data-d="fdel" data-f="${esc(f)}" title="Delete folder" aria-label="Delete folder">${ic(ICON.x, 14)}</button>` : ''}</div>
      ${list.map(b => `<div class="drow${b.id === WB.board.id ? ' on' : ''}" data-b="${b.id}" tabindex="0"><span class="dsw" style="--c:${swatchOf(b.id)}"></span><span class="dn"><b>${esc(b.name)}</b><small>${b.count} objects · ${timeAgo(b.updated)}</small></span><span class="dact"><button class="ib s" data-d="ren" title="Rename" aria-label="Rename">${ic(ICON.edit, 14)}</button><button class="ib s" data-d="dup" title="Duplicate" aria-label="Duplicate">${ic(ICON.dup, 14)}</button><button class="ib s" data-d="move" title="Move to folder" aria-label="Move to folder">${ic(ICON.folder, 14)}</button><button class="ib s" data-d="del" title="Delete" aria-label="Delete">${ic(ICON.trash, 14)}</button></span></div>`).join('') || '<p class="dempty">No boards here</p>'}</div>`).join('')}</div>`;
  const s = $('.dsearch', d); s.oninput = () => { UI.dq = s.value; drawer(); const n = $('.dsearch'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
}
$('#drawer').addEventListener('click', async e => {
  const b = e.target.closest('[data-d]'), row = e.target.closest('[data-b]');
  const act = b?.dataset.d, id = row?.dataset.b;
  if (!act && id) { if (id !== WB.board.id) WB.openBoard(id); drawer(); return; }
  if (act === 'close') return UI.toggleDrawer();
  if (act === 'new') { const n = await UI.ask('New board', 'Untitled board', 'Create'); if (!n) return; const nb = WB.createBoard(n, WB.board.folder || WB.folders()[0]); WB.openBoard(nb.id); drawer(); WB.emit('toast', 'Board created'); return; }
  if (act === 'folder') { const n = await UI.ask('New folder', '', 'Create', 'e.g. KamiLabs'); if (n && !WB.folders().includes(n)) WB.setFolders([...WB.folders(), n]); drawer(); return; }
  if (act === 'frename') {
    const old = b.dataset.f, n = await UI.ask('Rename folder', old, 'Rename'); if (!n || n === old) return;
    WB.setFolders(WB.folders().map(f => f === old ? n : f));
    WB.index().filter(x => x.folder === old).forEach(x => WB.moveBoard(x.id, n)); drawer(); return;
  }
  if (act === 'fdel') {
    const f = b.dataset.f, rest = WB.folders().filter(x => x !== f), inside = WB.index().filter(x => x.folder === f);
    if (!await UI.confirm(`Delete the folder “${f}”?`, 'Delete folder', true, inside.length ? `Its ${inside.length} board${inside.length > 1 ? 's move' : ' moves'} to ${rest[0]}.` : '')) return;
    inside.forEach(x => WB.moveBoard(x.id, rest[0])); WB.setFolders(rest); drawer(); return;
  }
  if (!id) return;
  const info = WB.index().find(x => x.id === id);
  if (act === 'ren') { const n = await UI.ask('Rename board', info.name, 'Rename'); if (n) { WB.renameBoard(id, n); drawer(); } }
  else if (act === 'dup') { const nb = WB.duplicateBoard(id); if (nb) { WB.emit('toast', `Made “${nb.name}”`); drawer(); } }
  else if (act === 'move') UI.folderPop(b, id);
  else if (act === 'del') {
    const full = id === WB.board.id ? WB.board : WB.getBoard(id), owner = (full?.meta.members || []).find(m => m.role === 'owner')?.name;
    if (owner && owner !== WB.me.name) { WB.emit('toast', 'Only the owner can delete this board'); return; }
    if (await UI.confirm(`Delete “${info.name}”?`, 'Delete board', true, 'This removes the board and its versions from this browser. It can’t be undone.')) { WB.deleteBoard(id); drawer(); WB.emit('toast', 'Board deleted'); }
  }
});
$('#drawer').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-b]')) e.target.click(); if (e.key === 'Escape') UI.toggleDrawer(); e.stopPropagation(); });

// ---------- first run: one empty board to start from ----------
function seed() {
  if (WB.index().length) return;
  WB.LS.set('tessera.wb.folders', ['Personal', 'Projects']);
  WB.LS.set('tessera.wb.b.ideas', { id: 'ideas', name: 'Ideas', folder: 'Personal', objs: {}, meta: { members: [{ name: WB.me.name, role: 'owner' }], settings: { grid: true, bg: 'paper' } } });
  WB.LS.set('tessera.wb.index', [{ id: 'ideas', name: 'Ideas', folder: 'Personal', updated: Date.now(), count: 0, owner: WB.me.name }]);
}

// ---------- wiring ----------
WB.on('board', () => { barL(); barR(); tools(); panel(); ctx(); drawer(); });
WB.on('status', status);
WB.on('index', () => { drawer(); });
WB.on('sel', () => { panelSoon(); ctx(); });
WB.on('change', d => { panelSoon(); ctx(); const t = $('#pops .thread[data-thread]'); if (t && d?.remote && !t.querySelector('input')?.value) UI.thread(t.dataset.thread); });
WB.on('cam', () => { zoomLabel(); ctx(); });
WB.on('tool', () => { tools(); if (WB.tool !== 'select') { $('#ctx').hidden = true; } });
WB.on('history', () => { hist(); if (UI.tab === 'history') panelSoon(); });
WB.on('versions', () => { if (UI.tab === 'history') panelSoon(); });
WB.on('meta', () => { barL(); tools(); hist(); panelSoon(); });
addEventListener('resize', () => { ctx(); WB.emit('cam'); });

document.body.style.setProperty('--me', WB.me.color);
seed();
const want = new URLSearchParams(location.search).get('b');
if (!WB.openBoard(want)) WB.openBoard(WB.index().find(b => b.id === 'ideas')?.id || WB.index()[0]?.id || WB.createBoard('Untitled board', 'Personal').id);
WB.setTool('select');
