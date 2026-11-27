// Tessera · small DOM helpers and icons shared by the app and the to-do widget.
'use strict';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const CHECK = '<svg viewBox="0 0 14 14"><path d="M2.5 7.5 L5.8 10.5 L11.5 3.8"/></svg>';
const TICK = '<svg viewBox="0 0 12 12"><path d="M2.5 6.3 L5 8.6 L9.5 3.6"/></svg>';

// a short message above the page switcher. A function declaration, so it is window.toast too (the Wall looks for that).
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 1900);
}
