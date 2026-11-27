// Tessera · Review: the archive. Your folders, each a stack of files, newest at the front:
//   a monthly folder opens a file for every month and fills it in from one Hours category;
//   a projects folder holds a file per project, with its plan, its notes and a page a week.
// Folder → files → documents, every level a bento grid. The data is ARCHIVE (data/archive.js), saved by core/store.js.
'use strict';
const RV = (() => {
  let shown = null;   // the level on screen before this one, so moving between levels morphs instead of cuts
  let fresh = null;   // a file just added: it lands at the front with a little drop

  const ARROW = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 3 4.5 7l4 4"/></svg>';
  const TICKSVG = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5 L5.8 10.5 L11.5 3.8"/></svg>';
  const PENCIL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z"/></svg>';
  const BIN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></svg>';
  const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  const mark = s => (/[.!?…]$/.test(s) ? s : s + '.');
  const copy = (b, s) => `<div class="copy"><b>${esc(mark(b))}</b> <span>${s}</span></div>`;
  const tick = (on = true) => `<span class="ck${on ? '' : ' no'}">${on ? TICKSVG : ''}</span>`;
  const href = id => (id === 'root' ? '#review' : '#review/' + id);
  const back = (id, label) => `<a class="rv-back" href="${href(id)}">${ARROW}${esc(label)}</a>`;
  const vt = id => `view-transition-name:rv-${id.replace(/[^\w-]/g, '-')}`;
  // a tile that slides in after the one that opened; i sets the order
  const tile = (area, g, cls, inner, i, extra = '') => `<section class="tile ${g} ${cls} rv-in" style="grid-area:${area};--d:${140 + i * 55}ms" ${extra}>${inner}</section>`;

  // ---------- dates ----------
  const fromKey = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const niceDate = s => { const D = dayIdx(fromKey(s)); return D === T ? 'today' : D === T - 1 ? 'yesterday' : shortDate(D); };
  const thisMonth = () => monthKey(TODAY);
  const monthDays = ym => { const [y, m] = ym.split('-').map(Number), first = dayIdx(new Date(y, m - 1, 1)); return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => first + i); };
  const monthName = ym => MONTHS[+ym.slice(5) - 1];
  // every month from the one a folder was made in up to this one, newest first
  function monthsOf(f) {
    const out = []; let [y, m] = f.created.split('-').map(Number);
    const ty = TODAY.getFullYear(), tm = TODAY.getMonth() + 1;
    while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
    return out.reverse();
  }

  // ---------- what is where ----------
  // #review → the archive; #review/<folder id> → a folder; #review/<file id> → a project ('p…') or a month ('<folder id>@YYYY-MM')
  function level() {
    const id = location.hash.slice(1).split('/')[1] || '';
    const f = folderById(id); if (f) return { kind: 'folder', id, f };
    const p = ARCHIVE.projects[id]; if (p && folderById(p.folder)) return { kind: 'project', id, p, f: folderById(p.folder) };
    const m = /^(.+)@(\d{4}-\d{2})$/.exec(id), mf = m && folderById(m[1]);
    if (mf && mf.kind === 'month' && monthsOf(mf).includes(m[2])) return { kind: 'month', id, f: mf, ym: m[2] };
    return { kind: 'root', id: 'root' };
  }
  const tabOf = f => f.name.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X') + '-' + f.created.slice(2, 4);
  const catName = f => CAT(f.cat)?.name || 'a deleted category';
  const filesOf = f => (f.kind === 'month'
    ? monthsOf(f).map(ym => ({ id: `${f.id}@${ym}`, ym, name: monthName(ym) }))
    : projectsIn(f).sort((a, b) => (a.created === b.created ? (a.id < b.id ? 1 : -1) : a.created < b.created ? 1 : -1)).map(p => ({ id: p.id, p, name: p.name })));
  const lastUpdate = ps => ps.reduce((m, p) => p.entries.reduce((n, e) => (e[0] > n ? e[0] : n), m), '');

  // a month of one category: days so far, days with any hours, the hours, the longest run of days in a row
  function monthStats(f, ym) {
    const all = monthDays(ym), days = all.filter(D => D <= T), hrs = days.map(D => STORE.catHours(f.cat, D));
    let run = 0, best = 0; hrs.forEach(h => { run = h ? run + 1 : 0; best = Math.max(best, run); });
    return { days: days.length, total: all.length, active: hrs.filter(Boolean).length, hours: hrs.reduce((a, b) => a + b, 0), best, live: ym === thisMonth() };
  }
  // the lines a folder shows about itself
  function facts(f) {
    if (f.kind === 'month') {
      const st = monthStats(f, thisMonth()), n = monthsOf(f).length, streak = STORE.streak(D => STORE.catHours(f.cat, D) > 0);
      return {
        sub: `${catName(f)} hours, a file a month.`,
        lines: [`${plural(n, 'file')} since ${monthLabel(monthsOf(f).at(-1))}`, `${st.active} of ${st.days} days this month`, `${st.hours} h this month`],
        label: `${streak}-day streak`, big: [String(st.hours), 'h', `${monthName(thisMonth())} so far`], ev: ['Days', `${st.active} of ${st.days}`],
      };
    }
    const ps = projectsIn(f), active = ps.filter(p => p.status === 'ACTIVE').length, last = lastUpdate(ps);
    return {
      sub: ps.length ? `${WORDS[ps.length] || ps.length} ${ps.length === 1 ? 'project' : 'projects'}.` : 'No projects yet.',
      lines: ps.length ? filesOf(f).slice(0, 3).map(x => x.name) : ['Start one inside', 'or log an update from Today'],
      label: `${active} active`, big: [String(active), '/' + ps.length, 'Active'], ev: ['Last update', last ? niceDate(last) : 'None yet'],
    };
  }

  // ---------- days of a month, as squares lit by hours ----------
  function cal(f, ym, cls, labels, stampable) {
    const L = lookOf(f), days = monthDays(ym), lead = (((days[0] % 7) + 7) % 7);
    const cells = days.map(D => {
      if (D > T) return '<i class="f"></i>';
      const h = STORE.catHours(f.cat, D), v = !h ? '' : h === 1 ? 'l1' : h === 2 ? 'l2' : h <= 4 ? 'l3' : 'l4', d = dateOf(D).getDate();
      return `<i class="${v}" ${stampable ? `data-d="${D}" role="button" tabindex="0" aria-label="${MON3[dateOf(D).getMonth()]} ${d}, ${h ? plural(h, 'hour') : 'nothing'}"` : ''}>${labels && h ? `<em>${h}h</em>` : ''}</i>`;
    }).join('');
    return `<div class="cal ${cls}" style="--a1:${L.a[0]};--a2:${L.a[1]};--a3:${L.a[2]};--a4:${L.a[3]}" ${stampable ? '' : 'aria-hidden="true"'}>${'<i class="x"></i>'.repeat(lead)}${cells}</div>`;
  }

  // ---------- 1. the archive: your folders ----------
  // layouts for 0–5 folders (a0 … a4, i the intro, n the new-folder tile); past five, rows of four more under them
  const LAYOUTS = [
    ['i n n n', 'i n n n', 'i n n n'],
    ['i a0 a0 n', 'i a0 a0 n', 'i a0 a0 n'],
    ['i a0 a0 a1', 'n a0 a0 a1', 'n a0 a0 a1'],
    ['i a0 a0 a1', 'a2 a0 a0 a1', 'a2 n n a1'],
    ['i a0 a0 a1', 'a2 a0 a0 a1', 'a2 a3 a3 n'],
    ['i a0 a0 a1', 'a2 a0 a0 a1', 'a2 a3 a3 a4'],
  ];
  function rootGrid(n) {
    if (n <= 5) return LAYOUTS[n];
    const rows = [...LAYOUTS[5]], rest = Array.from({ length: n - 5 }, (_, i) => 'a' + (i + 5));
    while (rest.length) { const r = rest.splice(0, 4); while (r.length < 4) r.push('n'); rows.push(r.join(' ')); }
    return rows;
  }
  const SIZES = ['big', 'tall', 'tall', 'wide'];
  function folderTile(f, i) {
    const L = lookOf(f), x = facts(f), files = filesOf(f);
    const size = SIZES[i] || 'small', many = { big: 5, wide: 5, tall: 3, small: 3 }[size];
    const sheets = files.slice(0, many).map((s, k) => `<span class="sheet" style="--k:${k}"><i>${esc(f.kind === 'month' ? s.name.slice(0, 3) : s.name.length > 10 ? s.name.split(' ')[0].slice(0, 10) : s.name)}</i></span>`).reverse().join('');
    const roomy = size === 'big' || size === 'tall';
    const prof = roomy ? `<div class="prof">${x.lines.map(l => `<div>${tick()}${esc(l)}</div>`).join('')}<span class="label">${esc(x.label)}</span></div>` : '';
    const from = shown && (shown === f.id || shown.startsWith(f.id + '@') || ARCHIVE.projects[shown]?.folder === f.id);
    const cls = ['tile fd', size, size === 'big' && 'lead', !from && 'rv-in'].filter(Boolean).join(' ');
    return `<a class="${cls}" href="${href(f.id)}" style="grid-area:a${i};--on:${L.on};--d:${(i + 1) * 60}ms;${vt(f.id)}" aria-label="${esc(f.name)}: ${plural(files.length, 'file')}">
      <span class="fd-back ${L.g}"><span class="fd-tab">${esc(tabOf(f))}</span></span>
      <span class="fd-sheets">${sheets}</span>
      <span class="fd-front ${L.g}">
        ${copy(f.name, esc(x.sub))}${prof}
        <span class="stat">${x.big[0]}<small>${esc(x.big[1])}</small></span>
        <span class="aside">${esc(x.big[2])}<small>${esc(x.ev[0])}: ${esc(x.ev[1])}</small></span>
      </span></a>`;
  }
  function rootHTML() {
    const fs = ARCHIVE.folders, grid = rootGrid(fs.length), hasNew = grid.some(r => r.split(' ').includes('n'));
    return `<main class="bento rv rv-root${grid.length > 3 ? ' long' : ''}" style="grid-template-areas:${grid.map(r => `'${r}'`).join(' ')};--rows:${grid.length}">
      <section class="tile g-paper rv-intro rv-in" style="grid-area:i">
        ${copy('The archive', fs.length ? 'A folder for each part of your life. Monthly ones fill themselves in from Hours.' : 'Your life, filed. Make a folder for each part of it.')}
        <div class="rv-intro-acts"><button class="label rv-new" data-new-folder>+ New folder</button><button class="label ghost" data-data>Backups</button></div>
      </section>
      ${fs.map((f, i) => folderTile(f, i)).join('')}
      ${hasNew ? `<section class="tile g-dots rv-next is-new rv-in" style="grid-area:n;--d:${(fs.length + 1) * 60}ms" data-new-folder role="button" tabindex="0">
        ${copy(fs.length ? 'New folder' : 'Your first folder', fs.length ? 'Another part of your life to keep.' : 'Gym, Coding, a language you’re learning: a folder fills itself in from the hours you log. Or keep your projects in one.')}<span class="plus" aria-hidden="true">+</span></section>` : ''}
    </main>`;
  }

  // a new folder, or changing one: its name, what it is, and its colour
  function folderPop(anchor, f) {
    const used = ARCHIVE.folders.map(x => x.ground);
    let kind = f ? f.kind : 'month', cat = f ? f.cat : CATS[0]?.id, ground = f ? f.ground : Object.keys(FOLDER_LOOKS).find(g => !used.includes(g)) || 'green', touched = !!f;
    openPop(anchor, `${popTop(f ? 'Folder' : 'New folder')}
      <input class="ptitle" id="nf-name" value="${f ? esc(f.name) : ''}" placeholder="e.g. Gym, Coding, Side projects" maxlength="32" aria-label="Name" autocomplete="off">
      ${f ? '' : `<div class="plabel">Kind</div><span class="pseg"><button type="button" data-kind="month">A file a month</button><button type="button" data-kind="projects">Projects</button></span>`}
      <div class="plabel" data-forcat>Fills in from these hours</div>
      <div class="pcats" data-forcat role="radiogroup" aria-label="Hours category">${CATS.map(c => `<button type="button" data-cat="${c.id}" style="--cs:${c.solid}" role="radio">${esc(c.name)}<i class="tick">${TICK}</i></button>`).join('')}</div>
      <div class="plabel">Colour</div>
      <div class="pgrounds" role="radiogroup" aria-label="Colour">${Object.entries(FOLDER_LOOKS).map(([k, L]) => `<button type="button" class="${L.g}" data-ground="${k}" role="radio" aria-label="${k}"></button>`).join('')}</div>
      <div class="pfoot"><button type="button" class="pbtn" data-x>Cancel</button><button type="button" class="pbtn dark" data-make>${f ? 'Save' : 'Create'}</button></div>`, p => {
      const name = $('#nf-name', p);
      const sync = () => {
        $$('[data-kind]', p).forEach(b => b.classList.toggle('on', b.dataset.kind === kind));
        $$('[data-forcat]', p).forEach(el => { el.hidden = kind !== 'month'; });
        $$('[data-cat]', p).forEach(b => { const on = b.dataset.cat === cat; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        $$('[data-ground]', p).forEach(b => { const on = b.dataset.ground === ground; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        p.place();
      };
      $$('[data-kind]', p).forEach(b => b.onclick = () => { kind = b.dataset.kind; sync(); });
      $$('[data-cat]', p).forEach(b => b.onclick = () => { cat = b.dataset.cat; touched = true; sync(); });
      $$('[data-ground]', p).forEach(b => b.onclick = () => { ground = b.dataset.ground; sync(); });
      // a name that matches a category picks it ("Gym" fills in from Gym), until you pick one yourself
      name.oninput = () => { if (touched) return; const v = name.value.trim().toLowerCase(), c = v && CATS.find(x => x.name.toLowerCase().startsWith(v) || v.startsWith(x.name.toLowerCase())); if (c) { cat = c.id; sync(); } };
      const make = () => {
        const v = name.value.trim().replace(/\s+/g, ' ');
        if (!v) return name.focus();
        if (kind === 'month' && !CAT(cat)) return toast('Pick the hours it fills in from');
        if (f) { Object.assign(f, { name: v, ground }, f.kind === 'month' ? { cat } : {}); closePop(); render(); toast('Saved'); return; }
        const id = 'f' + Date.now().toString(36);
        ARCHIVE.folders.push({ id, name: v, ground, kind, ...(kind === 'month' ? { cat } : {}), created: keyOf(T) });
        STORE.soon(); closePop(); location.hash = 'review/' + id;
        toast(kind === 'month' ? `${v} is open. Its first file is ${monthName(thisMonth())}` : `${v} is open. Start your first project in it`);
      };
      $('[data-make]', p).onclick = make;
      name.onkeydown = e => { if (e.key === 'Enter') make(); };
      sync(); name.focus();
    }, true);
  }

  // ---------- 2. a folder, opened: its cover, then its files ----------
  function cover(f) {
    const L = lookOf(f), x = facts(f), files = filesOf(f);
    return `<section class="tile fd open tall" style="grid-area:cover;--on:${L.on};${vt(f.id)}" data-folder="${f.id}">
      <span class="fd-back ${L.g}"><span class="fd-tab">${esc(tabOf(f))}</span></span>
      <div class="fd-front ${L.g}">
        ${back('root', 'Archive')}<div class="hd-top"><button class="hd-ico" data-edit-folder title="Change" aria-label="Change ${esc(f.name)}">${PENCIL}</button><button class="hd-ico" data-delete title="Delete" aria-label="Delete ${esc(f.name)}">${BIN}</button></div>
        ${copy(f.name, esc(x.sub))}
        <div class="prof">${x.lines.map(l => `<div>${tick()}${esc(l)}</div>`).join('')}<span class="label">${esc(x.label)}</span></div>
        <div class="cv-ev">
          <dl><div><dt>${esc(x.ev[0])}</dt><dd>${esc(x.ev[1])}</dd></div><div><dt>Files</dt><dd>${files.length}${files.length ? ` · newest ${esc(files[0].name)}` : ''}</dd></div><div><dt>Opened</dt><dd>${esc(niceDate(f.created))}</dd></div></dl>
          <span class="cv-lab">${esc(x.big[2])}</span>
          <span class="cv-stat">${x.big[0]}<small>${esc(x.big[1])}</small></span>
        </div>
      </div></section>`;
  }
  // pos: { s: its place on the shelf, big: the newest file at the front, tall: an older file given two or three rows }
  function fileTile(file, f, i, pos) {
    const L = lookOf(f), big = !!pos.big, span = big ? 'lead' : pos.tall ? 'tall' : '';
    const anim = fresh === file.id ? 'rv-fresh' : shown === file.id ? '' : 'rv-pull';
    const open = `class="tile fl ${file.p ? 'book' : 'month'} ${big ? 'big' : ''} ${span} ${anim}" href="${href(file.id)}" draggable="false" style="${pos.s};--d:${160 + Math.min(i, 6) * 70}ms;${vt(file.id)}"`;
    if (file.p) {
      const p = file.p, ups = p.entries.length;
      return `<a ${open} aria-label="${esc(p.name)}, ${plural(ups, 'update')}"><span class="fl-tab ${L.g}">${esc(tabOf(f))}</span><span class="fl-body">
        <span class="own-cover ${L.g}" aria-hidden="true"><b>${esc(p.name)}</b></span>
        <span class="fl-card">${copy(p.name, esc(p.tagline || ''))}<span class="fl-meta"><span class="chip ${p.status === 'ACTIVE' ? 'live' : ''}">${p.status === 'ACTIVE' ? 'Active' : 'Paused'}</span>${plural(ups, 'update')} · opened ${esc(niceDate(p.created))}</span></span>
      </span></a>`;
    }
    const st = monthStats(f, file.ym), yr = file.ym.slice(0, 4);
    return `<a ${open} aria-label="${esc(file.name)} ${yr}"><span class="fl-tab ${L.g}">${esc(MON3[+file.ym.slice(5) - 1].toUpperCase())} ${yr.slice(2)}</span><span class="fl-body g-white">
      ${copy(`${file.name} ${yr}`, st.live ? 'In progress.' : 'Closed.')}
      <span class="chip top ${st.live ? 'live' : ''}">${st.live ? 'In progress' : 'Closed'}</span>
      ${big ? cal(f, file.ym, 'big', true) : span === 'tall' ? cal(f, file.ym, 'mid', true) : cal(f, file.ym, 'mini')}
      <span class="fstat"><b>${st.active}<small>/${st.days}</small></b><span>days with ${esc(catName(f))}</span><small>${st.live ? `Day ${st.days} of ${st.total}` : `${st.hours} h in all`}</small></span>
    </span></a>`;
  }
  // under the newest file: the next month, or a new project
  function newTile(f, i, style) {
    if (f.kind === 'projects') {
      return `<section class="tile g-dots rv-next is-new rv-pull" style="${style};--d:${160 + i * 70}ms" data-newtile data-new-file role="button" tabindex="0">
        ${copy('New project', 'It gets its own file, with a plan and a page a week, and goes to the front.')}<span class="plus" aria-hidden="true">+</span></section>`;
    }
    const next = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 1), left = dayIdx(next) - T;
    return `<section class="tile g-dots rv-next rv-pull" style="${style};--d:${160 + i * 70}ms">
      ${copy(`${MONTHS[next.getMonth()]} ${next.getFullYear()}`, 'Opens on the 1st and fills itself in from Hours.')}<span class="fstat"><b>${left}</b><span>${left === 1 ? 'day' : 'days'} to go</span></span></section>`;
  }
  // the shelf: the newest file big at the front with the next-file tile under it, then the older files three to a column.
  // The last column shares its height out, so there are no holes; anything past the third column is a slide away.
  function shelf(f) {
    const files = filesOf(f), old = files.slice(1), cols = Math.ceil(old.length / 3), rest = old.length % 3;
    const place = i => {
      const col = 3 + Math.floor(i / 3), row = i % 3, last = Math.floor(i / 3) === cols - 1;
      if (last && rest === 1) return { s: `grid-column:${col};grid-row:1 / span 3`, tall: true };
      if (last && rest === 2) return row === 0 ? { s: `grid-column:${col};grid-row:1` } : { s: `grid-column:${col};grid-row:2 / span 2`, tall: true };
      return { s: `grid-column:${col};grid-row:${row + 1}` };
    };
    const w = old.length ? 2 : 3;
    return `<section class="rv-shelf" style="grid-area:files" aria-label="${esc(f.name)}: ${plural(files.length, 'file')}, newest first">
      <div class="shelf-track" data-track>
        ${files.length ? `${fileTile(files[0], f, 0, { s: `grid-column:1 / span ${w};grid-row:1 / span 2`, big: true })}${newTile(f, 1, `grid-column:1 / span ${w};grid-row:3`)}`
          : newTile(f, 0, 'grid-column:1 / span 3;grid-row:1 / span 3')}
        ${old.map((x, i) => fileTile(x, f, i + 2, place(i))).join('')}
      </div>
      <button class="shelf-nav prev" data-shelf="-1" aria-label="Newer files" hidden>${ARROW}</button>
      <button class="shelf-nav next" data-shelf="1" aria-label="Older files" hidden>${ARROW}</button>
    </section>`;
  }

  // ---------- 3. a file, opened: its documents ----------
  function head(id, f, title, sub, tools = '', status = '') {
    return `<section class="tile fl head" style="grid-area:head;${vt(id)}" data-file="${id}">
      <span class="fl-tab ${lookOf(f).g}">${esc(tabOf(f))}</span>
      <div class="fl-body g-white">${back(f.id, f.name)}<div class="hd-top">${tools}${status}</div>${copy(title, esc(sub))}</div></section>`;
  }
  // stats: [number, unit, caption]; numbers count up when the file opens
  const statHTML = ([n, u, c]) => `<div><b><span ${/^\d+$/.test(n) ? `data-count="${n}"` : ''}>${n}</span><small>${esc(u)}</small></b><span>${esc(c)}</span></div>`;
  // ticks: [on, text, small]; with `key`, each row is a button that ticks itself
  const checks = (rows, key) => `<div class="rv-checks">${rows.map(([on, t, s], i) => `<div class="${on ? '' : 'off'}" ${key ? `data-${key}="${i}" role="button" tabindex="0" aria-pressed="${!!on}"` : ''}>${tick(on)}<span>${esc(t)}${s ? `<small>${esc(s)}</small>` : ''}</span></div>`).join('')}</div>`;
  const bars = list => { const mx = Math.max(1, ...list.map(b => b[1])); return `<div class="bars" style="grid-template-columns:repeat(${list.length}, minmax(0, 1fr))">${list.map(([label, v]) => `<div><i style="height:${Math.max(4, v / mx * 100)}%;${v ? '' : 'opacity:.25'}" title="${v}"></i><small>${esc(label)}</small></div>`).join('')}</div>`; };
  // text you can write straight into; it's saved as you type
  const editable = (field, text, ph, cls = '') => `<p class="ed ${cls}" contenteditable="true" spellcheck="true" data-edit="${field}" data-ph="${esc(ph)}">${esc(text || '')}</p>`;

  function monthDocs(lv) {
    const { f, ym, id } = lv, st = monthStats(f, ym), M = monthNote(f.id, ym), L = lookOf(f), cat = catName(f);
    // hours a week: the Monday-to-Sunday weeks that touch this month
    const days = monthDays(ym), weeks = [];
    days.forEach(D => { const w = weekStart(D); let wk = weeks.find(x => x.w === w); if (!wk) weeks.push(wk = { w, h: 0 }); if (D <= T) wk.h += STORE.catHours(f.cat, D); });
    return `<main class="bento rv rv-file rv-month" data-month="${id}">${head(id, f, `${monthName(ym)} ${ym.slice(0, 4)}`, `Filled in from ${cat} hours in Hours.`, '', `<span class="chip ${st.live ? 'live' : ''}">${st.live ? 'In progress' : 'Closed'}</span>`)}
      ${tile('report', L.g, 'lead rv-report', `${copy('Monthly report', `${esc(monthName(ym))}, ${st.live ? 'in progress' : 'closed'}.`)}
        <p class="rv-foot">Every ${esc(cat)} hour you paint in Hours, or finish a task for, counts here.</p>
        ${st.live ? `<div class="rv-prog"><span>Day ${st.days} of ${st.total}</span><i><b style="width:${st.days / st.total * 100}%"></b></i></div>` : ''}
        <div class="rstats">${[[String(st.active), '/' + st.days, 'days'], [String(st.hours), 'h', cat], [String(st.best), 'd', 'longest run'], [(st.hours / Math.max(1, st.days)).toFixed(1), 'h', 'a day']].map(statHTML).join('')}</div>`, 0)}
      ${tile('cal', 'g-night', 'tall rv-att', `${copy(cat, st.live ? 'Click a day to add or clear an hour.' : 'An hour a shade.')}${cal(f, ym, 'stamp', true, st.live)}`, 1)}
      ${tile('also', 'g-white', 'tall rv-also', `${copy('Also this month', 'Not on any list, still counts.')}${M.also.length ? checks(M.also.map(([t, d]) => [1, t, niceDate(d)])) : '<p class="none">Nothing yet.</p>'}<input class="wk-add" data-also placeholder="+ Add something you did" aria-label="Add something you did">`, 2)}
      ${tile('note', 'g-yellow', 'rv-note', `${copy('Note to self', '')}${editable('month-note', M.note, 'Click to write a note for this month.', 'q')}`, 3)}
      ${tile('weeks', 'g-green', 'rv-hours', `${copy('Hours a week', `${st.hours} h in ${monthName(ym)}.`)}${bars(weeks.map((w, i) => ['W' + (i + 1), w.h]))}`, 4)}
    </main>`;
  }
  function projectDocs(lv) {
    const { p, f, id } = lv, L = lookOf(f), done = p.plan.filter(x => x[0]).length, ws = weekStart(T);
    const weeks = [3, 2, 1, 0].map(k => {
      const start = ws - k * 7, end = start + 6, list = p.entries.filter(e => { const D = dayIdx(fromKey(e[0])); return D >= start && D <= end; });
      return { start, end, list, now: k === 0 };
    });
    const tools = `<button class="hd-ico" data-rename title="Rename" aria-label="Rename ${esc(p.name)}">${PENCIL}</button><button class="hd-ico" data-delete title="Delete" aria-label="Delete ${esc(p.name)}">${BIN}</button>`;
    const status = `<button class="chip ${p.status === 'ACTIVE' ? 'live' : ''}" data-status title="Click to ${p.status === 'ACTIVE' ? 'pause' : 'pick it up again'}">${p.status === 'ACTIVE' ? 'Active' : 'Paused'}</button>`;
    const weekHTML = w => `<div class="rv-wk"><h4>${w.now ? 'This week' : `Week of ${shortDate(w.start).slice(4)}`}<small>${plural(w.list.length, 'update')}</small></h4>
      <div class="wk-list">${w.list.length ? w.list.map(([d, t]) => `<p><b>${DAY_NAMES[fromKey(d).getDay()]} ${fromKey(d).getDate()}</b>${esc(t)}</p>`).join('') : '<p class="none">Nothing logged.</p>'}</div>
      ${w.now ? '<input class="wk-add" data-add placeholder="Today’s update, then Enter" aria-label="Add today’s update">' : ''}</div>`;
    return `<main class="bento rv rv-file rv-book" data-project="${id}">${head(id, f, p.name, `${f.name}. Opened ${niceDate(p.created)}. ${plural(p.entries.length, 'update')} so far.`, tools, status)}
      ${tile('about', '', 'lead rv-about', `<span class="own-cover ${L.g}" aria-hidden="true"><b>${esc(p.name)}</b></span><div class="acard">${copy(p.name, editable('tagline', p.tagline, 'One line on what it is.', 'inline').replace(/^<p/, '<span').replace(/<\/p>$/, '</span>'))}${editable('about', p.about, 'What is it, who is it for, and what would “done” look like? Click to write.')}</div>`, 0)}
      ${tile('plan', 'g-white', 'tall rv-plan', `${copy('Plan', p.plan.length ? `<span data-plan-n>${done}</span> of ${p.plan.length} done. Tick a step when it ships.` : 'The steps to get it done.')}${checks(p.plan.map(([on, t]) => [on, t]), 'pi')}<input class="wk-add" data-plan placeholder="+ Add a step" aria-label="Add a step to the plan">`, 1)}
      ${tile('note', 'g-yellow', 'rv-note', `${copy('Note to self', '')}${editable('note', p.note, 'Click to write a note to yourself.', 'q')}`, 2)}
      ${tile('hours', 'g-green', 'rv-hours', `${copy('Updates', `${weeks.reduce((n, w) => n + w.list.length, 0)} in four weeks.`)}${bars(weeks.map(w => [w.now ? 'Now' : shortDate(w.start).slice(4), w.list.length]))}`, 3)}
      ${tile('upd', 'g-white', 'wide rv-upd', `${copy('A page a week', `${plural(p.entries.length, 'update')} so far.`)}<div class="rv-weeks">${weeks.map(weekHTML).join('')}</div>`, 4)}
    </main>`;
  }

  // ---------- page ----------
  function html() {
    const lv = level();
    const out = lv.kind === 'root' ? rootHTML() : lv.kind === 'folder' ? `<main class="bento rv rv-folder">${cover(lv.f)}${shelf(lv.f)}</main>` : lv.kind === 'month' ? monthDocs(lv) : projectDocs(lv);
    // drawn again in place (a stamp, a new update): nothing slides in a second time
    return shown === lv.id ? out.replace('class="bento rv ', 'class="bento rv still ') : out;
  }
  const onKeyClick = (el, fn) => { el.onclick = fn; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } }; };
  // the new-project tile turns into a small form: name it, and it lands at the front of the shelf
  function askName(tileEl, f) {
    tileEl.onclick = tileEl.onkeydown = null; tileEl.removeAttribute('role'); tileEl.removeAttribute('tabindex'); tileEl.classList.add('asking');
    tileEl.innerHTML = `<form class="rv-form">${copy('New project', 'Name it. It goes to the front of the folder.')}<input name="n" maxlength="40" autocomplete="off" placeholder="e.g. Portfolio site" aria-label="Name"><div class="rv-form-acts"><button type="button" class="hd-btn" data-cancel>Cancel</button><button class="hd-btn dark">Create</button></div></form>`;
    const form = $('form', tileEl), input = $('input', form);
    input.focus();
    $('[data-cancel]', form).onclick = () => render();
    input.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); render(); } };
    form.onsubmit = e => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) { input.focus(); return; }
      fresh = STORE.newProject(name, f).id; render();
      toast(`${name} is at the front of ${f.name}`);
    };
  }
  // the shelf slides: arrows, the mouse wheel, dragging with the mouse, or a swipe
  function bindShelf(root, prev) {
    const track = $('[data-track]', root); if (!track) return;
    const back = $('[data-shelf="-1"]', root), next = $('[data-shelf="1"]', root);
    const step = () => { const gap = parseFloat(getComputedStyle(track).columnGap) || 14, first = track.querySelector('.fl:not(.big)') || track.firstElementChild; return first.getBoundingClientRect().width + gap; };
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      back.hidden = track.scrollLeft <= 2; next.hidden = track.scrollLeft >= max;
      track.classList.toggle('more', track.scrollLeft < max); track.classList.toggle('less', track.scrollLeft > 2);
    };
    back.onclick = () => track.scrollBy({ left: -step(), behavior: 'smooth' });
    next.onclick = () => track.scrollBy({ left: step(), behavior: 'smooth' });
    track.addEventListener('scroll', sync, { passive: true });
    track.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 2 || (e.deltaY < 0 && track.scrollLeft <= 0) || (e.deltaY > 0 && track.scrollLeft >= max - 1)) return;
      e.preventDefault(); track.scrollLeft += e.deltaY;
    }, { passive: false });
    let drag = null;
    track.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('input, button, form')) return; drag = { x: e.clientX, s: track.scrollLeft, moved: false, id: e.pointerId }; });
    track.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; track.classList.add('dragging'); try { track.setPointerCapture(drag.id); } catch { /* fine without */ } }
      if (drag.moved) track.scrollLeft = drag.s - dx;
    });
    const end = () => { track.classList.remove('dragging'); if (drag && !drag.moved) drag = null; };
    track.addEventListener('pointerup', end); track.addEventListener('pointercancel', () => { drag = null; end(); });
    track.addEventListener('click', e => { if (drag?.moved) { e.preventDefault(); e.stopPropagation(); } drag = null; }, true);
    track.addEventListener('dragstart', e => e.preventDefault());
    // coming back from a file deep in the shelf: slide it into view
    const from = prev && $(`.fl[href="${href(prev)}"]`, track);
    if (from) track.scrollLeft = Math.max(0, from.offsetLeft - step());
    requestAnimationFrame(sync); sync();
  }
  // a delete button asks once more (a second click within three seconds)
  function sure(btn, go) {
    btn.onclick = () => {
      if (!btn.classList.contains('sure')) {
        btn.classList.add('sure'); btn.textContent = 'Delete?'; btn.title = 'Click again to delete';
        setTimeout(() => { if (document.contains(btn) && btn.classList.contains('sure')) { btn.classList.remove('sure'); btn.innerHTML = BIN; btn.title = 'Delete'; } }, 3000);
        return;
      }
      go();
    };
  }
  function bind(root) {
    const lv = level(), prev = shown, moved = shown !== lv.id;
    if (moved) { scrollTo(0, 0); shown = lv.id; }
    $$('[data-new-folder]', root).forEach(b => onKeyClick(b, e => { e.preventDefault(); folderPop(b); }));
    $$('[data-data]', root).forEach(b => b.onclick = () => openDataCard(b));
    $$('[data-new-file]', root).forEach(b => onKeyClick(b, e => { e.preventDefault(); askName(b, lv.f); }));
    bindShelf(root, prev);
    fresh = null;

    // report numbers count up when a file opens
    if (moved && !matchMedia('(prefers-reduced-motion: reduce)').matches) $$('[data-count]', root).forEach(n => {
      const to = +n.dataset.count, t0 = performance.now() + 250;
      const step = t => { const k = Math.min(1, Math.max(0, (t - t0) / 900)); n.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });

    // text written straight into a file: saved as you type
    $$('[data-edit]', root).forEach(el => {
      el.oninput = () => {
        const v = el.innerText.trim();
        if (el.dataset.edit === 'month-note') monthNote(lv.f.id, lv.ym).note = v; else if (lv.p) lv.p[el.dataset.edit] = v;
      };
      el.onkeydown = e => { if (e.key === 'Escape' || (e.key === 'Enter' && el.classList.contains('inline'))) { e.preventDefault(); el.blur(); } };
      el.onblur = () => { if (!el.innerText.trim()) el.textContent = ''; STORE.soon(); };
    });

    if (lv.kind === 'folder') {
      $('[data-edit-folder]', root).onclick = e => folderPop(e.currentTarget, lv.f);
      sure($('[data-delete]', root), () => {
        const f = lv.f;
        ARCHIVE.folders = ARCHIVE.folders.filter(x => x !== f);
        projectsIn(f).forEach(p => delete ARCHIVE.projects[p.id]);
        Object.keys(ARCHIVE.months).forEach(k => { if (k.startsWith(f.id + '|')) delete ARCHIVE.months[k]; });
        STORE.soon(); location.hash = 'review'; toast(`Deleted ${f.name}`);
      });
    }

    if (lv.kind === 'month') {
      // click a day to put an hour of the category on it, or clear its hours; the report follows
      $$('.cal.stamp [data-d]', root).forEach(c => onKeyClick(c, () => {
        const D = +c.dataset.d, on = STORE.toggleCatDay(lv.f.cat, D);
        render();
        toast(on ? `Added an hour of ${catName(lv.f)} to ${shortDate(D)}, in Hours too` : `Cleared ${catName(lv.f)} from ${shortDate(D)}`);
        $(`.cal.stamp [data-d="${D}"]`)?.focus();
      }));
      const also = $('[data-also]', root);
      also.onkeydown = e => {
        if (e.key !== 'Enter' || !also.value.trim()) return;
        monthNote(lv.f.id, lv.ym).also.push([also.value.trim(), keyOf(T)]);
        STORE.soon(); render(); toast('Filed under this month');
        $('[data-also]')?.focus();
      };
    }

    if (lv.kind === 'project') {
      const p = lv.p, own = $('.fl.head', root);
      $('[data-status]', root).onclick = () => { p.status = p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'; STORE.soon(); render(); toast(p.status === 'ACTIVE' ? `${p.name} is active again` : `${p.name} is paused`); };
      // rename: the title becomes a field (Enter saves, Escape keeps the old name)
      $('[data-rename]', root).onclick = () => {
        $('.copy', own).outerHTML = `<form class="hd-form"><input value="${esc(p.name)}" maxlength="40" aria-label="New name" autocomplete="off"><small>Enter to save · Esc to keep it</small></form>`;
        const form = $('.hd-form', own), input = $('input', form);
        input.focus(); input.select();
        input.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); render(); } };
        input.onblur = () => setTimeout(() => { if (document.contains(form)) form.requestSubmit(); }, 0);
        form.onsubmit = e => {
          e.preventDefault();
          const name = input.value.trim().replace(/\s+/g, ' ');
          if (!name || name === p.name) { render(); return; }
          const old = p.name; p.name = name; STORE.soon(); render(); toast(`Renamed ${old} to ${name}`);
        };
      };
      sure($('[data-delete]', root), () => { delete ARCHIVE.projects[p.id]; STORE.soon(); location.hash = 'review/' + lv.f.id; toast(`Deleted ${p.name}`); });
      // plan steps tick on click; a new step goes at the end
      $$('[data-pi]', root).forEach(el => onKeyClick(el, () => {
        const s = p.plan[+el.dataset.pi]; s[0] = s[0] ? 0 : 1; STORE.soon(); render();
        toast(s[0] ? `“${s[1]}” ticked off` : `“${s[1]}” is open again`);
      }));
      const plan = $('[data-plan]', root);
      plan.onkeydown = e => { if (e.key !== 'Enter' || !plan.value.trim()) return; p.plan.push([0, plan.value.trim()]); STORE.soon(); render(); $('[data-plan]')?.focus(); };
      const add = $('[data-add]', root);
      add.onkeydown = e => {
        if (e.key !== 'Enter' || !add.value.trim()) return;
        p.entries.push([keyOf(T), add.value.trim()]);
        STORE.soon(); render(); toast('Added to this week');
        $('[data-add]')?.focus();
      };
    }
  }
  // Escape steps back out: file → folder → archive
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || (e.target instanceof Element && e.target.closest('input, textarea, [data-float], [contenteditable]'))) return;
    if (location.hash.slice(1).split('/')[0] !== 'review') return;
    const lv = level(); if (lv.kind === 'root') return;
    location.hash = lv.kind === 'folder' ? 'review' : 'review/' + lv.f.id;
  });
  return { html, bind };
})();

// the Review page in the app (app/app.js). Moving between levels (#review/… → #review/…) morphs.
P.review = () => RV.html();
P.review.bind = root => RV.bind(root);
P.review.morph = true;
