// Tessera · the app shell: the page switcher, the router, the clock, and the pieces several pages share.
//
// Every file in pages/ adds its page to P:
//   P.x()             the page's HTML
//   P.x.bind(root)    wires it up once it is in the document
//   P.x.layout(root)  optional: measures and places things that depend on the drawn size (runs again on resize)
//   P.x.morph = true  optional: moving inside the page (#x/…) morphs with a view transition instead of cutting
//   P.x.live = true   optional: the page shows the time of day, so it redraws each minute while you're not using it
// The data is data/data.js and data/archive.js; core/store.js saves it and ties the pages together
// (Calendar → Today → Hours → Review).
'use strict';
const PAGES = [['home', 'Home'], ['today', 'Today'], ['hours', 'Hours'], ['calendar', 'Calendar'], ['ideas', 'Ideas'], ['wall', 'Wall'], ['review', 'Review']];
const P = {};
// what the pages remember between redraws; each page adds its own fields
const S = {};
// anything floating over the page (a menu, a popover) puts its close function here and carries data-float:
// a redraw closes them all, and a sync from another window never redraws one away
const FLOATS = [];
const closeFloats = () => FLOATS.forEach(close => close());
// single-key shortcuts a page adds, by lowercase key (1–7 always switch pages)
const SHORTCUTS = {};
// you're typing, dragging or have something open: background redraws wait
const busy = () => !!document.querySelector('input:focus, textarea:focus, [contenteditable]:focus, [data-float]') || document.body.classList.contains('is-dragging');

// ---------- pieces several pages share ----------
const CAT = id => CATS.find(c => c.id === id);
// a day's 24 hours as blocks; a run of the same category is one block with its name (Home and Hours)
function stripHTML(cells) {
  let h = '', i = 0;
  while (i < 24) {
    const id = cells[i]; let n = 1; while (id && cells[i + n] === id) n++;
    const c = id && CAT(id);
    h += c ? `<div class="hb f" style="grid-column:span ${n};--cs:${c.solid};--cf:${c.fg || '#fff'}">${n >= 2 ? esc(c.name) : ''}</div>` : `<div class="hb" style="grid-column:span ${n}"></div>`;
    i += n;
  }
  return h;
}
const ticksHTML = () => Array.from({ length: 24 }, (_, h) => (h % 12 ? `<span>${h % 12}</span>` : `<span class="k">${h ? '12 PM' : '12 AM'}</span>`)).join('');
// when an hour is too narrow for a bold "12 AM", the light "1" after it steps aside
function fitTicks(root) {
  $$('.ticks', root).forEach(t => {
    t.classList.remove('tight');
    const k = $('.k', t), next = k && k.nextElementSibling; if (!next) return;
    const r = document.createRange(); r.selectNodeContents(k);
    if (r.getBoundingClientRect().right > next.getBoundingClientRect().left - 4) t.classList.add('tight');
  });
}
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---------- a card that opens next to what you clicked; Esc or a click outside closes it ----------
const X_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';
function closePop() {
  $('#pop')?.remove();
  document.removeEventListener('pointerdown', closePop.out, true);
  document.removeEventListener('keydown', closePop.key, true);
}
FLOATS.push(closePop);
function openPop(anchor, html, bind, below = false) {
  closeFloats();
  const p = document.createElement('div'); p.className = 'pop'; p.id = 'pop'; p.dataset.float = ''; p.setAttribute('role', 'dialog');
  p.innerHTML = html; document.body.appendChild(p);
  const place = () => {
    const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight, gap = 10;
    let x = r.right + gap, y = r.top;
    if (x + w > innerWidth - 12) x = r.left - gap - w;
    if (below) { x = Math.max(12, Math.min(innerWidth - w - 12, r.right - w)); y = r.bottom + gap; }
    else if (x < 12) { x = Math.max(12, Math.min(innerWidth - w - 12, r.left)); y = r.bottom + gap; }
    p.style.left = x + 'px'; p.style.top = Math.max(12, Math.min(innerHeight - h - 12, y)) + 'px';
  };
  place(); p.place = place;
  closePop.out = e => { if (!p.contains(e.target)) closePop(); };
  closePop.key = e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } };
  setTimeout(() => document.addEventListener('pointerdown', closePop.out, true));
  document.addEventListener('keydown', closePop.key, true);
  $$('[data-x]', p).forEach(b => b.onclick = closePop);
  bind(p);
  return p;
}
const popTop = label => `<div class="ptop"><span>${label}</span><button type="button" class="px" data-x aria-label="Close">${X_ICON}</button></div>`;

// ---------- your data: where it's saved, the daily backups, a copy to keep, and putting one back ----------
const when = ms => { const d = new Date(ms), D = dayIdx(d), t = fmtTime(d.getHours() + d.getMinutes() / 60); return D === T ? `today, ${t}` : D === T - 1 ? `yesterday, ${t}` : `${shortDate(D)}, ${t}`; };
const backupWhen = name => { const [ymd, hms] = name.split(' '), [y, m, d] = ymd.split('-').map(Number), D = dayIdx(new Date(y, m - 1, d)); return /^\d{6}$/.test(hms || '') ? when(new Date(y, m - 1, d, +hms.slice(0, 2), +hms.slice(2, 4)).getTime()) : D === T ? 'today' : shortDate(D); };
function openDataCard(anchor) {
  const { remote, savedAt } = STORE.info();
  openPop(anchor, `${popTop('Your data')}
    <div class="dline"><b>Saved</b><span>${remote ? 'In this browser and on this computer' : 'In this browser only. Run serve.py to keep a copy on this computer too'}${savedAt ? `, last at ${fmtTime(new Date(savedAt).getHours() + new Date(savedAt).getMinutes() / 60)}` : ''}.</span></div>
    <div class="dline"><b>Backups</b><span data-backups>${remote ? 'Looking…' : 'Download a copy to keep one somewhere safe.'}</span></div>
    <div class="pfoot"><input type="file" accept="application/json,.json" hidden data-file>
      <button type="button" class="pbtn" data-restore>Restore from a file</button>${remote ? '<button type="button" class="pbtn" data-now>Back up now</button>' : ''}<button type="button" class="pbtn dark" data-download>Download a copy</button></div>`, p => {
    const line = $('[data-backups]', p);
    const list = () => STORE.backups().then(r => {
      if (!r) return;
      const b = r.backups;
      line.textContent = b.length ? `One a day, the last ${r.keep} kept. Newest: ${backupWhen(b[0].name)}. ${plural(b.length, 'copy', 'copies')} so far.` : `One a day, the last ${r.keep} kept. The first one is made before tomorrow's first change.`;
      p.place();
    }).catch(() => { line.textContent = 'The server isn’t answering, so no backups can be listed.'; });
    list();
    $('[data-download]', p).onclick = async () => { await STORE.download(); toast('Saved a copy to your downloads'); };
    const now = $('[data-now]', p);
    if (now) now.onclick = async () => { try { await STORE.backupNow(); toast('Backed up'); list(); } catch { toast('The server isn’t answering. Try again in a moment'); } };
    const pick = $('[data-file]', p);
    $('[data-restore]', p).onclick = () => pick.click();
    pick.onchange = () => {
      const file = pick.files[0]; if (!file) return;
      const foot = $('.pfoot', p);
      foot.classList.add('asking');
      foot.innerHTML = `<p class="pask">Replace everything here with ${esc(file.name)}? What's here now is backed up first.</p><button type="button" class="pbtn" data-x>Cancel</button><button type="button" class="pbtn red" data-go>Replace</button>`;
      $('[data-x]', foot).onclick = closePop;
      $('[data-go]', foot).onclick = () => STORE.restoreFile(file).catch(e => toast(e.message));
      p.place();
    };
  });
}

// ---------- the page switcher ----------
function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = PAGES.map(([id, name], i) => `<button data-go="${id}" title="${name} · ${i + 1}">${name}</button>`).join('');
  nav.onclick = e => { const b = e.target.closest('[data-go]'); if (b) location.hash = b.dataset.go; };
}
function markNav(page) {
  const nav = $('#nav');
  $$('[data-go]', nav).forEach(b => {
    const on = b.dataset.go === page;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  // on a phone the switcher scrolls sideways: keep the page you're on in view
  const on = $('.on', nav);
  if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
}

// ---------- render ----------
const current = () => { const h = location.hash.slice(1).split('/')[0]; return P[h] ? h : 'home'; };
let shownPage = null; // the page on screen, so moving inside it can morph instead of cut
function layout() {
  const app = $('#app');
  fitTicks(app);
  P[shownPage]?.layout?.(app);
}
function render() {
  STORE.sync();
  const page = current(), app = $('#app'), focus = document.activeElement?.id;
  closeFloats();
  // lists that scroll keep their place across redraws (data-keep names them)
  const keep = {}; $$('[data-keep]', app).forEach(el => { keep[el.dataset.keep] = el.scrollTop; });
  app.innerHTML = P[page]();
  $$('[data-keep]', app).forEach(el => { if (keep[el.dataset.keep]) el.scrollTop = keep[el.dataset.keep]; });
  document.body.dataset.page = page;
  P[page].bind?.(app);
  markNav(page);
  document.title = `Tessera · ${PAGES.find(p => p[0] === page)[1]}`;
  shownPage = page;
  // place things now, once the frame is drawn, and again when the fonts settle
  layout(); requestAnimationFrame(layout); document.fonts?.ready.then(layout);
  if (focus) document.getElementById(focus)?.focus();
}

// ---------- the clock: at midnight every page turns to the new day; pages that show the time refresh each minute ----------
let minuteShown = Math.floor(NOW_H * 60);
function checkClock() {
  const moved = tickClock(), minute = Math.floor(NOW_H * 60);
  if (minute === minuteShown && !moved) return;
  minuteShown = minute;
  if (shownPage && (moved || P[shownPage].live) && !busy()) render();
}

addEventListener('hashchange', () => {
  const page = current();
  const morph = page === shownPage && P[page].morph && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!morph) { render(); return; }
  // the morph waits for the next frame; a tab that isn't drawing frames (in the background) switches without it
  let done = false;
  const draw = () => { if (!done) { done = true; render(); } };
  const t = document.startViewTransition(draw);
  t.ready.catch(() => {}); t.finished.catch(() => {});
  setTimeout(() => { if (!done) { t.skipTransition(); draw(); } }, 400);
});
addEventListener('resize', layout);
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable], [data-float]')) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= PAGES.length) { location.hash = PAGES[n - 1][0]; return; }
  const run = SHORTCUTS[e.key.toLowerCase()];
  if (run) { e.preventDefault(); run(); }
});
// the page scripts load after this one; start once they all have
document.addEventListener('DOMContentLoaded', () => {
  buildNav();
  // another window saved something: redraw, unless you're typing or have a menu open
  STORE.restore(() => { if (!busy()) render(); });
  render();
  setInterval(checkClock, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkClock(); });
});
