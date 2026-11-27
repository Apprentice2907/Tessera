// Tessera · Hours: today hour by hour, painted by category, and every earlier day of the month as one row.
// Click a category to paint with it, click an hour to paint it. Double-click a category to delete it; + adds one.
'use strict';
Object.assign(S, { brush: 'code', newCat: null, catDel: null, lastCat: null });

// colours for the categories you add (the ones already in use are skipped)
const CAT_PALETTE = [
  { name: 'Teal',   solid: '#14B88F', fg: '#fff' },
  { name: 'Coral',  solid: '#FF6A3D', fg: '#fff' },
  { name: 'Black',  solid: '#1C1C1E', fg: '#fff' },
  { name: 'Indigo', solid: '#5856D6', fg: '#fff' },
  { name: 'Brown',  solid: '#A2845E', fg: '#fff' },
  { name: 'Lime',   solid: '#A4D52A', fg: '#1C1C1E' },
  { name: 'Grey',   solid: '#8E8E93', fg: '#fff' },
];
const freePalette = () => CAT_PALETTE.filter(p => !CATS.some(c => c.solid === p.solid));
const DEL_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 3l6 6M9 3 3 9"/></svg>';

P.hours = () => {
  if (!CAT(S.brush)) S.brush = CATS[0].id; // the brush was deleted, maybe in another window
  const cells = hoursOn(T), month = monthSoFar(), past = month.slice(0, -1);
  const tot = {}; month.forEach(D => hoursOn(D).forEach(c => { if (c) tot[c] = (tot[c] || 0) + 1; }));
  const logged = cells.filter(Boolean).length, mon = MONTHS[TODAY.getMonth()];
  // the three categories with the most hours this month (until there are any, the first three)
  const top = [...CATS].sort((x, y) => (tot[y.id] || 0) - (tot[x.id] || 0)).slice(0, 3);
  const canAdd = freePalette().length || S.newCat;
  const catRow = c => `<div class="crow${S.catDel === c.id ? ' deleting' : ''}"><button class="cat ${S.brush === c.id ? 'on' : ''}" data-brush="${c.id}" style="--cs:${c.solid};--cf:${c.fg || '#fff'}" aria-pressed="${S.brush === c.id}" title="Double-click to delete"><span>${esc(c.name)}</span><small>${tot[c.id] || 0}h</small><i class="tick" aria-hidden="true">${TICK}</i></button>${S.catDel === c.id ? `<button class="cdel" data-cdel="${c.id}" style="color:${c.solid}" aria-label="Delete ${esc(c.name)}" title="Delete ${esc(c.name)}">${DEL_ICON}</button>` : ''}</div>`;
  const statTile = (c, area, g) => `<section class="tile ${g}" style="grid-area:${area}">
      <div class="copy"><b>${esc(c.name)}.</b> <span>${mon} so far.</span></div>
      <div class="stat">${tot[c.id] || 0}<small>h</small></div>
      <div class="aside">${((tot[c.id] || 0) / month.length).toFixed(1)} h a day</div>
    </section>`;
  return `<main class="bento p-hours">
    <section class="tile g-white wide" style="grid-area:strip">
      <div class="copy"><b>Today, hour by hour.</b> <span>${logged} of 24 logged. Click an hour to paint it ${esc(CAT(S.brush).name)}.</span></div>
      <div class="hstrip"><div class="strip" id="hstrip">${stripHTML(cells)}</div><div class="ticks">${ticksHTML()}</div></div>
    </section>
    ${statTile(top[0], 'sleep', 'g-green')}
    <section class="tile g-night lead" style="grid-area:month">
      <div class="copy"><b>${mon} so far.</b> <span>${past.length ? 'Every finished day, one row.' : 'A new month. Each day shows up here as a row once it’s done.'}</span></div>
      <div class="heat">${past.map(D => `<b>${DAY_NAMES[dateOf(D).getDay()]} ${dateOf(D).getDate()}</b>` + hoursOn(D).map(c => { const k = c && CAT(c); return `<i style="${k ? 'background:' + k.solid : ''}" title="${k ? esc(k.name) : ''}"></i>`; }).join('')).join('')}</div>
    </section>
    <section class="tile g-cream tall cats" style="grid-area:chips">
      <div class="copy"><b>Categories.</b> <span>Pick one to paint.</span></div>
      <button class="up cplus${S.newCat ? ' open' : ''}" id="cat-add" aria-label="${S.newCat ? 'Cancel new category' : 'New category'}" aria-expanded="${!!S.newCat}"${canAdd ? '' : ' disabled title="All colours are in use"'}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M8 3 V13 M3 8 H13"/></svg></button>
      <div class="clist" data-keep="clist">${newCatHTML()}${CATS.map(catRow).join('')}</div>
    </section>
    ${statTile(top[1] || top[0], 'code', 'g-orange')}
    ${statTile(top[2] || top[0], 'social', 'g-yellow')}
  </main>`;
};

P.hours.bind = root => {
  // one click paints with it; a second click on the same one (a double-click) offers to delete it
  $$('[data-brush]', root).forEach(b => {
    b.onclick = () => {
      const id = b.dataset.brush, now = Date.now(), again = S.lastCat?.id === id && now - S.lastCat.t < 400;
      S.lastCat = { id, t: now };
      if (again) S.catDel = id; else { S.catDel = null; S.brush = id; }
      render();
      if (again) $('.cdel')?.focus();
    };
    b.onkeydown = e => { if (e.key === 'Delete' || e.key === 'Backspace') { S.catDel = b.dataset.brush; render(); $('.cdel')?.focus(); } };
  });
  $('.p-hours', root).onpointerdown = e => { if (S.catDel && !e.target.closest('.crow')) { S.catDel = null; render(); } };
  $('.cdel', root)?.addEventListener('keydown', e => { if (e.key === 'Escape') { S.catDel = null; render(); } });
  bindCategories(root);
  $('#hstrip', root).onclick = e => {
    const r = e.currentTarget.getBoundingClientRect(), h = Math.min(23, Math.max(0, Math.floor((e.clientX - r.left) / r.width * 24)));
    const cells = hoursFor(T); cells[h] = cells[h] === S.brush ? null : S.brush; STORE.claim(T, h); render();
  };
};

// ---------- add or delete a category ----------
function newCatHTML() {
  const pal = freePalette();
  if (!S.newCat || !pal.length) return '';
  const p = pal[S.newCat.pi] || pal[0];
  return `<form class="cnew" id="cat-form" autocomplete="off">
    <div class="cn1"><i id="cat-dot" style="background:${p.solid}"></i><input id="cat-name" maxlength="22" placeholder="Name, e.g. Reading" aria-label="Category name"><button type="submit">Add</button></div>
    <div class="cn2" role="radiogroup" aria-label="Colour">${pal.map((q, i) => `<button type="button" class="sw ${q === p ? 'on' : ''}" data-sw="${i}" style="--cs:${q.solid}" role="radio" aria-checked="${q === p}" aria-label="${q.name}"></button>`).join('')}</div>
  </form>`;
}
function bindCategories(root) {
  const list = $('.clist', root);
  // the list scrolls once it is full; soft edges show there is more above or below
  const fade = () => { list.classList.toggle('fade-t', list.scrollTop > 2); list.classList.toggle('fade-b', list.scrollTop + list.clientHeight < list.scrollHeight - 2); };
  list.onscroll = fade; fade();
  const plus = $('#cat-add', root);
  plus.onpointerdown = e => e.preventDefault(); // keep focus in the form, so clicking × just closes it
  plus.onclick = () => {
    S.newCat = S.newCat ? null : { pi: 0 }; render();
    if (S.newCat) { $('.clist').scrollTop = 0; $('#cat-name').focus(); }
  };
  $$('[data-cdel]', root).forEach(b => b.onclick = () => {
    const c = CAT(b.dataset.cdel); S.catDel = null;
    if (CATS.length === 1) { render(); return toast('Keep at least one category'); }
    CATS = CATS.filter(x => x !== c);
    Object.values(HOURS).forEach(cells => cells.forEach((x, i) => { if (x === c.id) cells[i] = null; }));
    if (S.brush === c.id) S.brush = CATS[0].id;
    render(); toast(`Deleted ${c.name}`);
  });
  const form = $('#cat-form', root); if (!form) return;
  const name = $('#cat-name', root), dot = $('#cat-dot', root);
  $$('[data-sw]', root).forEach(b => b.onclick = () => {
    S.newCat.pi = +b.dataset.sw; dot.style.background = b.style.getPropertyValue('--cs');
    $$('[data-sw]', root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    name.focus();
  });
  form.onkeydown = e => { if (e.key === 'Escape') { S.newCat = null; render(); } };
  form.addEventListener('focusout', () => setTimeout(() => { if (S.newCat && !form.contains(document.activeElement) && !name.value.trim()) { S.newCat = null; render(); } }, 120));
  form.onsubmit = e => {
    e.preventDefault();
    const v = name.value.trim().replace(/\s+/g, ' '); if (!v) return name.focus();
    const same = CATS.find(c => c.name.toLowerCase() === v.toLowerCase());
    if (same) { S.newCat = null; S.brush = same.id; render(); return toast(`You already have ${same.name}`); }
    const pal = freePalette(), p = pal[S.newCat.pi] || pal[0];
    const c = { id: 'c' + Date.now(), name: v, solid: p.solid, fg: p.fg, custom: true };
    CATS.push(c); S.brush = c.id; S.newCat = null; render();
    const l = $('.clist'); if (l) l.scrollTop = l.scrollHeight;
    toast(`Added ${v}. Click an hour to paint it.`);
  };
}
