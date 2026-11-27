// Tessera · the app shell: the page switcher, the router, and the pieces several pages share.
//
// Every file in pages/ adds its page to P:
//   P.x()             the page's HTML
//   P.x.bind(root)    wires it up once it is in the document
//   P.x.layout(root)  optional: measures and places things that depend on the drawn size (runs again on resize)
//   P.x.morph = true  optional: moving inside the page (#x/…) morphs with a view transition instead of cutting
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

// ---------- pieces several pages share ----------
const CAT = id => CATS.find(c => c.id === id);
// a day's 24 hours as blocks; a run of the same category is one block with its name (Home and Hours)
function stripHTML(cells) {
  let h = '', i = 0;
  while (i < 24) {
    const id = cells[i]; let n = 1; while (id && cells[i + n] === id) n++;
    const c = id && CAT(id);
    h += c ? `<div class="hb f" style="grid-column:span ${n};--cs:${c.solid};--cf:${c.fg || '#fff'}">${n >= 2 ? esc(c.name) : ''}</div>` : '<div class="hb"></div>';
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
  STORE.restore(() => { if (!document.querySelector('input:focus, textarea:focus, [data-float]')) render(); });
  render();
});
