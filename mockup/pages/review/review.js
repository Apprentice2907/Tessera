// Tessera · Review: the archive. One folder per part of life; a folder holds a file for every month
// (or one per project), and a file opens into its documents. Folder → files → documents, every level a bento grid.
// The data lives in data/archive.js (FOLDERS, FILES, CASES, BOOKS, PROJ_ART, LIFTS …); the numbers are counted by store.js
// from Today and Hours, so the archive shows what really happened: gym days, DSA questions, coding hours, the Japanese streak.
'use strict';
const RV = (() => {
  // each folder's ground from the bento palette; `on` is the ground colour a tick is cut out of; `a` is its day-square ramp.
  // big = the headline evidence, ev2 = the second line of evidence the old case file carried
  const LOOK = {
    gym:  { g: 'g-green',  on: '#3E8A66', a: ['#CFF2D8', '#8EDFA3', '#34C759', '#1F8A3B'], big: ['120', 'kg', 'Deadlift PR'], ev2: ['Sessions in Nov', '14 of 16 days'] },
    code: { g: 'g-lilac',  on: '#C9B8FF', a: ['#E2DBFF', '#B9A9FF', '#7B61FF', '#5A3ECF'], big: ['46', '', 'Questions in Nov'], ev2: ['CF rating', '1587, up 67'] },
    cre:  { g: 'g-orange', on: '#FF6A2C', a: ['#FFE2D1', '#FFB58C', '#FF7438', '#D9481A'], big: ['15', 'd', 'Japanese streak'], ev2: ['Paintings', '3 this month'] },
    proj: { g: 'g-night',  on: '#151517', a: [], big: ['4', '/5', 'Projects active'], ev2: ['Last update', 'Today, Nov 16'] },
    kami: { g: 'g-kraft',  on: '#C8A37C', a: [], big: ['70', 'h', 'Logged in Nov'], ev2: ['Updates', '15 in Nov'] },
  };
  // every monthly file: its headline number (the line under its name is the old file's own band)
  const MONTH = {
    'gym-nov':  ['14', '/16', 'sessions so far'],
    'gym-oct':  ['100', 'kg', 'deadlift by Oct 31'],
    'gym-sep':  ['18', '', 'sessions'],
    'code-nov': ['14', '/16', 'days with questions'],
    'code-oct': ['38', '', 'questions'],
    'cre-nov':  ['3', '', 'paintings so far'],
    'cre-oct':  ['1', '', 'painting'],
  };
  const NOTE = {
    gym: 'Deadlift finally 120!! Next stop: 140 by January.',
    code: 'Graphs are still weak. Ten BFS and DFS problems before December.',
    cre: 'Hiragana done by December, then katakana. Film one painting timelapse.',
  };
  let shown = null;                                                 // the level on screen before this one
  const TODAY_D = TODAY.getDate();                                  // the mockup's today: Mon 16 Nov

  const ARROW = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 3 4.5 7l4 4"/></svg>';
  const TICKSVG = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5 L5.8 10.5 L11.5 3.8"/></svg>';
  const PENCIL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z"/></svg>';
  const BIN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></svg>';
  const mark = s => /[.!?]$/.test(s) ? s : s + '.';
  const copy = (b, s) => `<div class="copy"><b>${esc(mark(b))}</b> <span>${s}</span></div>`;
  const title = s => s.charAt(0) + s.slice(1).toLowerCase();
  const opened = x => { const [m, d] = x.opened.split(' '); return /^\d+$/.test(d) && d.length <= 2 ? `${title(m)} ${+d}` : title(x.opened); };
  const folderOf = id => FOLDERS.find(f => f.id === id) || (FILES[id] && FOLDERS.find(f => f.id === FILES[id].folder));
  const level = () => { const p = location.hash.slice(1).split('/'); return p[1] && (FILES[p[1]] || FOLDERS.some(f => f.id === p[1])) ? p[1] : 'root'; };
  const href = id => (id === 'root' ? '#review' : '#review/' + id);
  const vt = id => `view-transition-name:rv-${id}`;
  const tick = (on = true) => `<span class="ck${on ? '' : ' no'}">${on ? TICKSVG : ''}</span>`;
  const back = (id, label) => `<a class="rv-back" href="${href(id)}">${ARROW}${esc(label)}</a>`;
  const fmt = v => (Math.round(v * 10) / 10).toString();
  // a tile that slides in after the one that opened; i sets the order
  const tile = (area, g, cls, inner, i, extra = '') => `<section class="tile ${g} ${cls} rv-in" style="grid-area:${area};--d:${140 + i * 55}ms" ${extra}>${inner}</section>`;
  const gymNow = () => { const g = STORE.stats().gym; return { s: g.sessions, att: g.att, planned: g.planned, best: g.best }; };
  // the case polaroid: the folder's picture with its caption, as on the old manila folders
  const polaroid = (c, cls) => `<span class="fd-pol ${cls}"><img src="${c.art()}" alt="" draggable="false"><b>${esc(c.cap)}</b></span>`;

  // ---------- newest first, and the files you add yourself ----------
  // a file's date is 'NOV 02' (in its year) or 'SEP 2026'; files added on the same day keep the order they were added in
  const monIndex = m => MON3.findIndex(x => x.toUpperCase() === m.toUpperCase());
  const openedAt = x => { const [m, d] = x.opened.split(' '), day = /^\d{1,2}$/.test(d) ? +d : 1, yr = /^\d{4}$/.test(d) ? +d : x.year; return new Date(yr, monIndex(m), day).getTime() + (x.addedAt ? x.addedAt % 86400000 : 0); };
  const newestFirst = f => [...f.files].sort((a, b) => openedAt(FILES[b]) - openedAt(FILES[a]));
  const onlyBooks = f => f.files.every(id => FILES[id].book);
  // the projects folder counts what is in it, so a new project shows up in its line and its number
  const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  const subOf = f => (f.id === 'proj' ? `${WORDS[f.files.length] || f.files.length} things I’m building` : CASES[f.id].sub);
  const latestEntry = f => Math.max(0, ...f.files.flatMap(id => { const b = BOOKS[FILES[id].book]; return b && !b.aggregate ? b.entries.map(([m, d]) => m * 40 + d) : []; }));
  const kamiNov = () => FOLDERS.find(f => f.id === 'kami').files.flatMap(id => { const b = BOOKS[FILES[id].book]; return b && !b.aggregate ? b.entries : []; }).filter(([m]) => m === TODAY.getMonth()).length;
  function bigOf(f) {
    const st = STORE.stats();
    if (f.id === 'proj') return [String(f.files.filter(id => BOOKS[FILES[id].book]?.status === 'ACTIVE').length), '/' + f.files.length, LOOK.proj.big[2]];
    if (f.id === 'gym') return [String(Math.max(...LIFTS.filter(l => /deadlift/i.test(l[0])).map(l => l[2]), 0)), 'kg', 'Deadlift PR'];
    if (f.id === 'code') return [String(st.code.questions), '', 'Questions in Nov'];
    if (f.id === 'cre') return [String(st.cre.jp), 'd', 'Japanese streak'];
    if (f.id === 'kami') return [String(BOOKS.kami ? BOOKS.kami.hours.reduce((a, b) => a + b, 0) : 0), 'h', 'Logged in Nov'];
    return LOOK[f.id].big;
  }
  function ev2Of(f) {
    const st = STORE.stats();
    if (f.id === 'gym') return ['Sessions in Nov', `${st.gym.sessions} of ${st.gym.planned} days`];
    if (f.id === 'proj') { const v = latestEntry(f), m = Math.floor(v / 40), d = v % 40; return ['Last update', v ? `${m === TODAY.getMonth() && d === TODAY_D ? 'Today, ' : ''}${MON3[m]} ${d}` : 'None yet']; }
    if (f.id === 'kami') return ['Updates', `${kamiNov()} in ${MON3[TODAY.getMonth()]}`];
    return LOOK[f.id].ev2;
  }
  const SAVE = 'lo.rv.added';
  const PAINT = { gym: ['#3E8A66', '#E8F57E'], code: ['#C9B8FF', '#111113'], cre: ['#FF6A2C', '#FFFFFF'], proj: ['#151517', '#F5F5F7'], kami: ['#C8A37C', '#2B1E12'] };
  const xml = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // a new file's cover: its folder's colour with its name set big, like the other project covers
  // on the shelf and on its own page, a file you added wears its name as live text in the folder's colour, so it wraps to fit any card
  const ownCover = (x, L) => `<span class="own-cover ${L.g}" aria-hidden="true"><b>${esc(x.title)}</b></span>`;
  // (the same cover as a picture, for anything that needs an image: the name sized to fit, a long one on two lines)
  const coverArt = (name, fid) => () => {
    const [bg, fg] = PAINT[fid] || PAINT.proj;
    let lines = [name];
    if (name.length > 14 && name.includes(' ')) {
      let at = -1; for (let i = 0; i < name.length; i++) if (name[i] === ' ' && (at < 0 || Math.abs(i - name.length / 2) < Math.abs(at - name.length / 2))) at = i;
      lines = [name.slice(0, at), name.slice(at + 1)];
    }
    const fs = Math.max(18, Math.min(52, Math.floor(252 / (0.56 * Math.max(...lines.map(l => l.length))))));
    const text = lines.map((l, i) => `<tspan x="22" dy="${i ? Math.round(fs * 1.02) : 0}">${xml(l)}</tspan>`).join('');
    return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 228"><rect width="300" height="228" fill="${bg}"/>${[112, 82, 52].map(r => `<circle cx="264" cy="30" r="${r}" fill="none" stroke="${fg}" stroke-opacity=".18" stroke-width="2"/>`).join('')}<text x="22" y="${fs + 24}" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="${fs}" letter-spacing="-1" fill="${fg}">${text}</text></svg>`);
  };
  let added = [];
  try { added = JSON.parse(localStorage.getItem(SAVE)) || []; } catch { added = []; }
  added = added.filter(a => a && a.id && a.key && a.file && a.book && FOLDERS.some(f => f.id === a.file.folder));
  added.forEach(a => {
    FILES[a.id] = a.file; BOOKS[a.key] = a.book; PROJ_ART[a.key] = coverArt(a.file.title, a.file.folder);
    const f = FOLDERS.find(x => x.id === a.file.folder); if (!f.files.includes(a.id)) f.files.push(a.id);
  });
  const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(added.map(a => ({ id: a.id, key: a.key, file: FILES[a.id], book: BOOKS[a.key] })))); } catch { toast('Could not save: browser storage is full'); } };
  let fresh = null;                                                 // the file just added, so it lands at the front with a little drop
  function addFile(f, name) {
    const monthly = !onlyBooks(f), pre = CASES[f.id].no.split('-')[0], key = 'u' + Date.now().toString(36), id = `${f.id}-${key}`;
    const nums = f.files.map(i => FILES[i].no).filter(no => /-\d{4}$/.test(no)).map(no => +no.slice(-4));
    const no = monthly ? `${pre}-S${String(added.filter(a => FILES[a.id]?.folder === f.id).length + 1).padStart(2, '0')}` : `${pre}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
    FILES[id] = { folder: f.id, title: name, year: 2026, no, opened: `NOV ${TODAY_D}`, band: [monthly ? 'FILE' : 'PROJECT FILE', 'Just started'], spread: 'book', book: key, r: 0, addedAt: Date.now() };
    BOOKS[key] = { name, group: { proj: 'Personal', kami: 'KamiLabs' }[f.id] || f.short || f.name, status: 'ACTIVE', started: `Nov ${TODAY_D}, 2026`, path: `${f.name} / ${name}`, tagline: 'Just started.', about: 'Opened today. Log what happens each week and this file fills itself in.', stack: [], plan: [], hours: [0, 0, 0, 0], entries: [] };
    PROJ_ART[key] = coverArt(name, f.id);
    f.files.push(id); added.push({ id, key }); persist(); fresh = id;
    return id;
  }
  // only files you added can be renamed or deleted; the archive's own files stay put
  function renameFile(id, name) {
    const x = FILES[id], b = BOOKS[x.book], f = folderOf(id);
    x.title = name; b.name = name; b.path = `${f.name} / ${name}`; PROJ_ART[x.book] = coverArt(name, f.id);
    persist();
  }
  function deleteFile(id) {
    const x = FILES[id], f = folderOf(id);
    f.files.splice(f.files.indexOf(id), 1);
    delete BOOKS[x.book]; delete PROJ_ART[x.book]; delete FILES[id];
    added = added.filter(a => a.id !== id); persist();
  }

  // ---------- days of a month, as squares ----------
  const monthOf = x => MONTHS.indexOf(x.title);
  function days(id) {
    const x = FILES[id], m = monthOf(x), n = new Date(x.year, m + 1, 0).getDate(), live = !!x.live, out = [];
    for (let d = 1; d <= n; d++) {
      const wd = new Date(x.year, m, d).getDay();
      if (live && d > TODAY_D) { out.push({ d, f: 1 }); continue; }
      if (x.folder === 'gym') {
        const t = live ? GYM_STAMPS[d] : (wd !== 0 && ((m === 9 && d !== 13) || d % 2 === 1 || d > 20)) ? SPLIT[wd] || 'FULL' : '';
        out.push({ d, v: t ? (t === 'PR!' ? 4 : 3) : 0, t });
      } else if (x.folder === 'code') {
        const q = live ? DSA_NOV[d - 1] : (d * 7 + 3) % 5;
        out.push({ d, v: q === 0 ? 0 : q <= 2 ? 1 : q === 3 ? 2 : q === 4 ? 3 : 4, t: q ? String(q) : '' });
      } else {
        const j = live ? (STORE.stats().cre.jpDays[d - 1] ? 2 : 0) : (d > 9 && wd !== 0 ? (d % 3) + 1 : 0);
        out.push({ d, v: j, t: '' });
      }
    }
    return { lead: (new Date(x.year, m, 1).getDay() + 6) % 7, out };
  }
  // stampable: past days carry data-d so a click can stamp or unstamp them
  const cal = (id, cls, labels, stampable) => {
    const { lead, out } = days(id), a = LOOK[FILES[id].folder].a, mo = MON3[monthOf(FILES[id])];
    return `<div class="cal ${cls}" style="--a1:${a[0]};--a2:${a[1]};--a3:${a[2]};--a4:${a[3]}" ${stampable ? '' : 'aria-hidden="true"'}>${'<i class="x"></i>'.repeat(lead)}${out.map(c => c.f
      ? '<i class="f"></i>'
      : `<i class="${c.v ? 'l' + c.v : ''}" ${stampable ? `data-d="${c.d}" role="button" tabindex="0" aria-label="${mo} ${c.d}${c.t ? ', ' + esc(c.t) : ', not stamped'}"` : ''}>${labels && c.t ? `<em>${esc(c.t)}</em>` : ''}</i>`).join('')}</div>`;
  };

  // ---------- 1. the archive: a folder per part of life ----------
  function folderTile(f, size, i) {
    const L = LOOK[f.id], c = CASES[f.id], files = newestFirst(f).map(id => FILES[id]);
    const many = { big: 5, wide: 5, tall: 3, small: 3 }[size];
    const sheets = files.slice(0, many).map((x, k) => `<span class="sheet" style="--k:${k}"><i>${esc(x.book ? (x.title.length > 8 ? x.title.split(' ')[0] : x.title) : x.title.slice(0, 3))}</i></span>`).reverse().join('');
    const roomy = size === 'big' || size === 'tall';
    const prof = roomy ? `<div class="prof">${c.profile.map(p => `<div>${tick()}${esc(p)}</div>`).join('')}<span class="label">${esc(c.circle)}</span></div>` : '';
    const span = { big: 'lead', tall: 'tall', wide: 'wide', small: '' }[size];
    const from = shown && (shown === f.id || FILES[shown]?.folder === f.id);
    const cls = ['tile fd', size, span !== size && span, !from && 'rv-in'].filter(Boolean).join(' ');
    return `<a class="${cls}" href="${href(f.id)}" style="grid-area:${f.id};--on:${L.on};--d:${i * 60}ms;${vt(f.id)}" aria-label="${esc(f.name)}: ${files.length} ${files[0].book ? 'project files' : 'monthly files'}">
      <span class="fd-back ${L.g}"><span class="fd-tab">${esc(c.no)}</span></span>
      <span class="fd-sheets">${sheets}</span>
      <span class="fd-front ${L.g}">
        ${copy(f.short || f.name, esc(mark(subOf(f))))}${roomy ? polaroid(c, '') : ''}${prof}
        <span class="stat">${bigOf(f)[0]}<small>${bigOf(f)[1]}</small></span>
        <span class="aside">${bigOf(f)[2]}<small>${esc(ev2Of(f)[0])}: ${esc(ev2Of(f)[1])}</small></span>
      </span></a>`;
  }
  function rootHTML() {
    const size = { gym: 'big', code: 'tall', cre: 'tall', proj: 'wide', kami: 'small' };
    return `<main class="bento rv rv-root">
      <section class="tile g-paper rv-intro rv-in" style="grid-area:intro">
        ${copy('The archive', 'Every month of your life, filed. A new file opens on the 1st and fills itself in.')}
        <button class="label rv-new" data-new="folder">+ New folder</button>
      </section>
      ${FOLDERS.map((f, i) => folderTile(f, size[f.id] || 'small', i + 1)).join('')}
    </main>`;
  }

  // ---------- 2. a folder, opened: its cover, then its files ----------
  function cover(f, id = f.id) {
    const L = LOOK[f.id], c = CASES[f.id], order = newestFirst(f), n = order.length;
    return `<section class="tile fd open tall" style="grid-area:cover;--on:${L.on};${vt(id)}">
      <span class="fd-back ${L.g}"><span class="fd-tab">${esc(c.no)}</span></span>
      <div class="fd-front ${L.g}">
        ${back('root', 'Archive')}
        ${copy(f.name, esc(mark(subOf(f))))}
        <div class="prof">${c.profile.map(p => `<div>${tick()}${esc(p)}</div>`).join('')}<span class="label">${esc(c.circle)}</span></div>
        ${polaroid(c, 'big')}
        <div class="cv-ev">
          <dl><div><dt>${esc(ev2Of(f)[0])}</dt><dd>${esc(ev2Of(f)[1])}</dd></div><div><dt>Files</dt><dd>${n} ${onlyBooks(f) ? 'projects' : 'files'} · latest ${esc(FILES[order[0]].no)}</dd></div><div><dt>${esc(title(c.div))}</dt><dd>since ${esc(f.since)}</dd></div></dl>
          <span class="cv-lab">${bigOf(f)[2]}</span>
          <span class="cv-stat">${bigOf(f)[0]}<small>${bigOf(f)[1]}</small></span>
        </div>
      </div></section>`;
  }
  // pos: { s: its place on the shelf, big: the newest file at the front, tall: an older file given two or three rows }
  function fileTile(id, f, i, pos) {
    const x = FILES[id], L = LOOK[f.id], big = !!pos.big, span = big ? 'lead' : pos.tall ? 'tall' : '';
    const tab = `<span class="fl-tab ${L.g}">${esc(x.no)}</span>`;
    const anim = fresh === id ? 'rv-fresh' : shown === id ? '' : 'rv-pull';
    const open = `class="tile fl ${x.book ? 'book' : 'month'} ${big ? 'big' : ''} ${span} ${anim}" href="${href(id)}" draggable="false" style="${pos.s};--d:${160 + Math.min(i, 6) * 70}ms;${vt(id)}"`;
    if (x.book) {
      const b = BOOKS[x.book], ups = bookEntries(x.book).length, paused = b.status === 'PAUSED';
      return `<a ${open} aria-label="${esc(x.title)}, ${ups} updates">${tab}<span class="fl-body">
        ${x.addedAt ? ownCover(x, L) : `<img class="fl-art" src="${PROJ_ART[x.book]()}" alt="" draggable="false">`}
        <span class="fl-card">${copy(x.title, esc(mark(x.band[1])))}<span class="fl-meta"><span class="chip ${paused ? '' : 'live'}">${title(b.status)}</span>${ups} update${ups === 1 ? '' : 's'} · opened ${esc(opened(x))}</span></span>
      </span></a>`;
    }
    const st = STORE.stats();
    const live = { 'gym-nov': [String(st.gym.sessions), '/' + st.gym.planned, 'sessions so far'], 'code-nov': [String(st.code.qdays), '/' + TODAY_D, 'days with questions'] };
    const [num, unit, what] = live[id] || MONTH[id] || ['', '', ''];
    const meta = x.live ? `Day ${TODAY_D} of 30 · opened ${opened(x)}` : `Archived · opened ${opened(x)}`;
    return `<a ${open} aria-label="${esc(x.title)} ${x.year}">${tab}<span class="fl-body g-white">
      ${copy(`${x.title} ${x.year}`, esc(mark(x.band[1])))}
      <span class="chip top ${x.live ? 'live' : ''}">${x.live ? 'In progress' : 'Closed'}</span>
      ${big ? cal(id, 'big', f.id === 'gym') : span === 'tall' ? cal(id, 'mid', f.id === 'gym') : cal(id, 'mini')}
      <span class="fstat"><b>${num}<small>${unit}</small></b><span>${what}</span><small>${esc(meta)}</small></span>
    </span></a>`;
  }
  // under the newest file: start the next one
  function newTile(f, i, style) {
    const book = onlyBooks(f);
    const inner = book
      ? `${copy('New project', 'It gets its own file and a page for every week, and goes to the front.')}<span class="plus" aria-hidden="true">+</span>`
      : `${copy('December 2026', 'Opens on the 1st and fills itself in. Need one sooner? Start a file now.')}<span class="fstat"><b>15</b><span>days to go</span></span><button class="label rv-new" data-new="file">+ New file</button>`;
    return `<section class="tile g-dots rv-next ${book ? 'is-new' : ''} rv-pull" style="${style};--d:${160 + i * 70}ms" data-newtile="${f.id}" ${book ? 'data-new="file" role="button" tabindex="0"' : ''}>${inner}</section>`;
  }
  // the shelf: the newest file big at the front with the new-file tile under it, then the older files three to a column.
  // The last column shares its height out, so there are no holes; anything past the third column is a slide away.
  function shelf(f) {
    const order = newestFirst(f), old = order.slice(1), cols = Math.ceil(old.length / 3), rest = old.length % 3;
    const place = i => {
      const col = 3 + Math.floor(i / 3), row = i % 3, last = Math.floor(i / 3) === cols - 1;
      if (last && rest === 1) return { s: `grid-column:${col};grid-row:1 / span 3`, tall: true };
      if (last && rest === 2) return row === 0 ? { s: `grid-column:${col};grid-row:1` } : { s: `grid-column:${col};grid-row:2 / span 2`, tall: true };
      return { s: `grid-column:${col};grid-row:${row + 1}` };
    };
    const w = old.length ? 2 : 3;
    return `<section class="rv-shelf" style="grid-area:files" aria-label="${esc(f.name)}: ${order.length} files, newest first">
      <div class="shelf-track" data-track>
        ${fileTile(order[0], f, 0, { s: `grid-column:1 / span ${w};grid-row:1 / span 2`, big: true })}
        ${newTile(f, 1, `grid-column:1 / span ${w};grid-row:3`)}
        ${old.map((id, i) => fileTile(id, f, i + 2, place(i))).join('')}
      </div>
      <button class="shelf-nav prev" data-shelf="-1" aria-label="Newer files" hidden>${ARROW}</button>
      <button class="shelf-nav next" data-shelf="1" aria-label="Older files" hidden>${ARROW}</button>
    </section>`;
  }
  function folderHTML(f) {
    return `<main class="bento rv rv-folder">${cover(f)}${shelf(f)}</main>`;
  }

  // ---------- 3. a file, opened: its documents ----------
  function head(id, f, note) {
    const x = FILES[id], L = LOOK[f.id], b = x.book && BOOKS[x.book];
    const status = b ? `<span class="chip ${b.status === 'PAUSED' ? '' : 'live'}">${title(b.status)}</span>` : `<span class="chip ${x.live ? 'live' : ''}">${x.live ? 'In progress' : 'Closed'}</span>`;
    // a file you added carries a pencil and a bin beside its status
    const tools = x.addedAt ? `<button class="hd-ico" data-rename title="Rename" aria-label="Rename ${esc(x.title)}">${PENCIL}</button><button class="hd-ico" data-delete title="Delete" aria-label="Delete ${esc(x.title)}">${BIN}</button>` : '';
    return `<section class="tile fl head" style="grid-area:head;${vt(id)}" data-file="${id}">
      <span class="fl-tab ${L.g}">${esc(x.no)}</span>
      <div class="fl-body g-white">
        ${back(f.id, f.short || f.name)}<div class="hd-top">${tools}${status}</div>
        ${copy(b ? x.title : `${x.title} ${x.year}`, esc(note))}
        <div class="hd-acts"><button class="hd-btn" data-act="pdf">Export PDF</button><button class="hd-btn dark" data-act="page">+ Add page</button></div>
      </div></section>`;
  }
  // stats: [number, unit, caption, key]; plain numbers count up when the file opens, keys let a stamp update them
  const statHTML = ([n, u, c, k]) => {
    const m = /^([+]?)(\d+)$/.exec(n);
    return `<div><b><span ${m ? `data-count="${m[2]}" data-pre="${m[1]}"` : ''} ${k ? `data-k="${k}"` : ''}>${n}</span><small>${u}</small></b><span>${esc(c)}</span></div>`;
  };
  const report = (f, name, sub, stats, foot, live, i) => tile('report', LOOK[f.id].g, 'lead rv-report', `
    ${copy(name, esc(sub))}
    <p class="rv-foot">${esc(foot)}</p>
    ${live ? `<div class="rv-prog"><span>Day ${TODAY_D} of 30</span><i><b style="width:${TODAY_D / 30 * 100}%"></b></i></div>` : ''}
    <div class="rstats">${stats.map(statHTML).join('')}</div>`, i);
  // rows: [name, value, change] — change starting with − reads as a drop
  const rows = r => `<div class="rv-rows">${r.map(([n, v, d]) => `<div><span class="n">${n}</span><span class="v">${esc(v)}</span>${d ? `<span class="d ${/^[−-]/.test(d) ? 'dn' : ''}">${esc(d)}</span>` : ''}</div>`).join('')}</div>`;
  // ticks: [on, text, small]; with `key`, each row is a button that ticks itself (diet rules, plan milestones)
  const checks = (r, key) => `<div class="rv-checks">${r.map(([on, t, s], i) => `<div class="${on ? '' : 'off'}" ${key ? `data-${key}="${i}" role="button" tabindex="0" aria-pressed="${!!on}"` : ''}>${tick(on)}<span>${esc(t)}${s ? `<small>${esc(s)}</small>` : ''}</span></div>`).join('')}</div>`;
  const photo = (area, src, name, sub, cls, i) => tile(area, 'rv-photo', cls, `<img src="${src}" alt="" draggable="false"><div class="phcard">${copy(name, esc(sub))}</div>`, i);
  function line(pts, unit) {
    const vs = pts.map(p => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo) * .18 || 1;
    const X = i => 4 + i / (pts.length - 1) * 92, Y = v => 88 - (v - lo + pad) / (hi - lo + pad * 2) * 76;
    return `<div class="rv-line"><div class="plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map((p, i) => `${X(i)},${Y(p[1])}`).join(' ')}" vector-effect="non-scaling-stroke"/></svg>
      ${pts.map((p, i) => `<i style="left:${X(i)}%;top:${Y(p[1])}%" title="${esc(p[0])}: ${p[1]}${unit}"></i>`).join('')}</div>
      <div class="rv-xl">${pts.map((p, i) => `<span style="left:${X(i)}%">${esc(p[0])}</span>`).join('')}</div></div>`;
  }
  const delta = (a, b) => { const d = Math.round((b - a) * 10) / 10; return (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d); };
  // the lift log: the now column is editable and the change follows it
  const liftLog = () => `<div class="rv-rows">${LIFTS.map(([n, a, b], i) => `<div><span class="n">${esc(n)}</span><span class="v">${fmt(a)} → <b class="now" contenteditable="true" spellcheck="false" inputmode="decimal" data-lift="${i}" aria-label="${esc(n)} now">${fmt(b)}</b></span><span class="d ${b < a ? 'dn' : ''}">${delta(a, b)}</span></div>`).join('')}</div>`;
  const meter = (label, v, of) => `<div class="meter"><span>${esc(label)}<b>${v} / ${of}</b></span><i><b style="width:${Math.round(v / of * 100)}%"></b></i></div>`;

  function gymDocs(id, f) {
    const x = FILES[id], live = x.live, s = gymNow();
    return `<main class="bento rv rv-file rv-gym">${head(id, f, NOTE.gym)}
      ${report(f, 'Monthly report', `${x.title} ${x.year}, ${live ? 'in progress' : 'closed'}.`,
        live ? [[String(s.s), '/' + s.planned, 'sessions', 'sessions'], [String(s.att), '%', 'attendance', 'att'], [String(s.best), 'd', 'best streak'], ['+18', '%', 'volume']] : [['26', '/28', 'sessions'], ['93', '%', 'attendance'], ['9', 'd', 'best streak'], ['+12', '%', 'volume']],
        'Filed by itself from Today (gym tasks), Hours (gym blocks) and the Wall.', live, 0)}
      ${tile('att', 'g-night', 'tall rv-att', `${copy('Attendance', live ? 'A stamp for every day I went. Click a day to stamp it.' : 'A stamp for every day I went.')}${cal(id, 'stamp', true, live)}`, 1)}
      ${tile('log', 'g-white', 'tall rv-lifts', `${copy('Lift log', `Personal records, ${x.title.slice(0, 3)} 1 to now. Click a number to change it.`)}${liftLog()}`, 2)}
      ${tile('curve', 'g-paper', 'rv-curve', `${copy('Strength curve', 'Deadlift, kg.')}<span class="pr">120<small>kg</small><em>PR · Nov 14</em></span>${line([['Nov 1', 100], ['Nov 4', 105], ['Nov 7', 110], ['Nov 11', 112.5], ['Nov 14', 120]], ' kg')}`, 3)}
      ${tile('diet', 'g-yellow', 'rv-diet', `${copy('Diet protocol', 'Sugar cravings worst on Sundays.')}${checks(DIET, 'diet')}<div class="meters">${meter('No sugar', 13, 16)}${meter('Clean eating', 14, 16)}</div>`, 4)}
      ${tile('body', 'g-night', 'rv-body', `${copy('Body', 'Nov 1 to Nov 16. Drag the photo.')}<div class="ba" style="--p:50%" role="slider" aria-label="Before and after" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0"><img src="${ART.body(1)}" alt="Nov 1"><img class="after" src="${ART.body(1.24)}" alt="Nov 16"><span class="l">Nov 1</span><span class="r">Now</span></div>
        <dl class="bm">${BODY.slice(1).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><span class="fstat"><b>+2.5<small>kg</small></b><span>${BODY[0][1]}</span></span>`, 5)}
    </main>`;
  }
  // also this month: what Today filed by itself (done one-offs), then what was added here
  const alsoItems = () => [...ONEOFFS.filter(o => o.cal === 'code' && statusOf(o.day, o.id) === 'done').map(o => { const d = addDays(TODAY, o.day); return [o.title, `Done ${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MON3[d.getMonth()]}, filed from Today`]; }), ...ALSO];
  function codeDocs(id, f) {
    const x = FILES[id], live = x.live;
    return `<main class="bento rv rv-file rv-code">${head(id, f, NOTE.code)}
      ${report(f, 'Monthly report', `${x.title} ${x.year}, ${live ? 'in progress' : 'closed'}.`,
        live ? [[String(STORE.stats().code.questions), '', 'questions'], ['4', '', 'contests'], ['1587', '', 'Codeforces, up 67'], [String(STORE.stats().code.hours), 'h', 'coding']] : [['38', '', 'questions'], ['3', '', 'contests'], ['1520', '', 'Codeforces'], ['29', 'h', 'coding']],
        'Filled in from Today (DSA tasks), Hours (coding blocks) and your Codeforces and LeetCode handles.', live, 0)}
      ${tile('dsa', 'g-night', 'tall rv-dsa', `${copy('DSA', 'One square a day.')}${cal(id, 'dsa', false)}<span class="fstat"><b>${live ? STORE.stats().code.questions : 38}</b><span>${live ? `${STORE.stats().code.qdays} of ${TODAY_D} days · best streak ${STORE.stats().code.qbest}` : 'best streak 4'}</span></span>`, 1)}
      ${tile('also', 'g-white', 'tall rv-also', `${copy('Also this month', 'Not on any list, still counts.')}${checks(alsoItems().map(([t, s]) => [1, t, s]))}<input class="wk-add" data-also placeholder="+ Add something you did" aria-label="Add something you did">`, 2)}
      ${tile('log', 'g-white', 'rv-contests', `${copy('Contest log', 'Rated rounds.')}${rows([['LC Weekly 474', 'rank 3,412', '+21'], ['CF Round 1028', 'A B C', '+67'], ['CC Starters 210', '2★ → 3★', '+88'], ['LC Biweekly 169', '2 of 4', '−12']])}`, 3)}
      ${tile('ticket', 'g-yellow', 'rv-ticket', `${copy('Interview', 'SDE intern, 45 minutes of DSA.')}<span class="fstat"><b>Nov 21</b><span>Round 1 · good luck</span></span>`, 4)}
      ${photo('pr', ART.code(), 'First merged PR', 'Nov 5.', '', 5)}
    </main>`;
  }
  function creDocs(id, f) {
    const x = FILES[id], live = x.live;
    return `<main class="bento rv rv-file rv-cre">${head(id, f, NOTE.cre)}
      ${report(f, 'Monthly report', `${x.title} ${x.year}, ${live ? 'in progress' : 'closed'}.`,
        live ? [['3', '', 'paintings'], [String(STORE.stats().cre.jp), 'd', 'Japanese streak'], [String(STORE.stats().cre.football), '', 'football games'], ['6', '', 'videos, 10 min each']] : [['1', '', 'painting'], ['4', 'd', 'Japanese streak'], ['6', '', 'football games'], ['2', '', 'videos, 10 min each']],
        'Filed by itself from Today (creative tasks), Hours (creative blocks) and photos on the Wall.', live, 0)}
      ${photo('paint', ART.paint(), 'Sunset', 'Painting #1, Nov 14.', 'tall', 1)}
      ${tile('kana', 'g-white', 'tall', `${copy('Kana log', 'Hiragana progress, a row at a time.')}${rows([['<span lang="ja">あ い う え お</span>', 'learned', 'Nov 3'], ['<span lang="ja">か き く け こ</span>', 'learning', 'Nov 16'], ['<span lang="ja">さ し す せ そ</span>', 'next', ''], ['<span lang="ja">た ち つ て と</span>', 'later', ''], ['<span lang="ja">な に ぬ ね の</span>', 'later', ''], ['<span lang="ja">は ひ ふ へ ほ</span>', 'later', '']])}`, 2)}
      ${tile('jp', 'g-night', 'rv-jp', `${copy('Japanese', 'Minutes a day.')}${cal(id, 'mini on-night', false)}<span class="fstat"><b>${STORE.stats().cre.jp}<small>d</small></b><span>streak</span></span>`, 3)}
      ${tile('turf', 'g-green', '', `${copy('Turf match', 'Fri, Nov 13. Rain game.')}<span class="fstat"><b>2</b><span>goals</span></span>`, 4)}
      ${photo('paint2', ART.paint2(), 'Painting #3', 'The one I like.', '', 5)}
    </main>`;
  }
  function bookDocs(id, f) {
    const x = FILES[id], b = BOOKS[x.book], all = bookEntries(x.book);
    const hrs = b.hours.reduce((a, c) => a + c, 0), done = b.plan.filter(p => p[0]).length, mx = Math.max(1, ...b.hours);
    const active = b.hours.filter(h => h > 0).length, thisWeek = b.hours[3];
    const weeks = BOOK_WEEKS.map((st, w) => {
      const end = new Date(st); end.setDate(end.getDate() + 6);
      const list = all.filter(e => bookWeek(e[0], e[1]) === w);
      return `<div class="rv-wk"><h4>Week ${w + 1}<small>${MON3[st.getMonth()]} ${st.getDate()} – ${MON3[end.getMonth()]} ${end.getDate()} · ${b.hours[w]} h</small></h4>
        <div class="wk-list">${list.length ? list.map(([m, d, t, p]) => `<p><b>${DAY_NAMES[new Date(2026, m, d).getDay()]} ${d}</b>${p ? `<em>${esc(p)}</em>` : ''}${esc(t)}</p>`).join('') : '<p class="none">Nothing logged.</p>'}</div>
        ${w === 3 && !b.aggregate ? '<input class="wk-add" data-add placeholder="Today’s update, then Enter" aria-label="Add today’s update">' : ''}</div>`;
    }).join('');
    const meta = b.aggregate ? `Internship, started ${b.started}. Role: intern. ${b.aggregate.length} projects in one book.` : `${b.group} project, started ${b.started}. Filed in ${b.path}.`;
    const chips = b.aggregate ? b.aggregate.map(k => `${BOOKS[k].name} · ${BOOKS[k].entries.length}`) : b.stack;
    return `<main class="bento rv rv-file rv-book" data-book="${x.book}">${head(id, f, meta)}
      ${tile('about', '', 'lead rv-about', `${x.addedAt ? ownCover(x, LOOK[f.id]) : `<img src="${PROJ_ART[x.book]()}" alt="" draggable="false">`}<div class="acard">${copy(b.name, esc(b.tagline))}<p>${b.about}</p><div class="stack">${chips.map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>`, 0)}
      ${tile('plan', 'g-white', 'tall rv-plan', `${copy('Plan', `<span data-plan-n>${done}</span> of ${b.plan.length} done. Tick a milestone when it ships.`)}${checks(b.plan.map(([on, t, when]) => [on, t, when]), 'pi')}`, 1)}
      ${tile('note', 'g-yellow', 'rv-note', `${copy('Note to self', '')}<p class="q">${esc(BOOK_NOTES[x.book] || b.tagline)}</p>`, 2)}
      ${tile('hours', 'g-green', 'rv-hours', `${copy('Hours', `${hrs} h in four weeks. ${active} of 4 weeks active, ${thisWeek} h this week.`)}<div class="bars">${b.hours.map((h, i) => `<div><i style="height:${Math.max(4, h / mx * 100)}%;background:${h ? 'var(--lime)' : 'rgba(232,245,126,.25)'}"></i><small style="color:var(--c2)">W${i + 1}</small></div>`).join('')}</div>`, 3)}
      ${tile('upd', 'g-white', 'wide rv-upd', `${copy('A page a week', `${all.length} updates so far.`)}<div class="rv-weeks">${weeks}</div>`, 4)}
    </main>`;
  }
  function fileHTML(id) {
    const x = FILES[id], f = folderOf(id);
    if (x.book) return bookDocs(id, f);
    return (x.spread === 'code' ? codeDocs : x.spread === 'cre' ? creDocs : gymDocs)(id, f);
  }

  // ---------- page ----------
  function html() {
    const L = level();
    const out = L === 'root' ? rootHTML() : FILES[L] ? fileHTML(L) : folderHTML(FOLDERS.find(f => f.id === L));
    // drawn again in place (a stamp, a new update): nothing slides in a second time
    return shown === L ? out.replace('class="bento rv ', 'class="bento rv still ') : out;
  }
  const onKeyClick = (el, fn) => { el.onclick = fn; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } }; };
  // the new-file tile turns into a small form: name it, and it lands at the front of the shelf
  function askName(tileEl, f) {
    const book = onlyBooks(f);
    tileEl.onclick = tileEl.onkeydown = null; tileEl.removeAttribute('role'); tileEl.removeAttribute('tabindex'); tileEl.classList.add('asking');
    tileEl.innerHTML = `<form class="rv-form">${copy(book ? 'New project' : 'New file', 'Name it. It goes to the front of the folder.')}<input name="n" maxlength="40" autocomplete="off" placeholder="${book ? 'e.g. Portfolio v2' : 'e.g. Half marathon'}" aria-label="Name"><div class="rv-form-acts"><button type="button" class="hd-btn" data-cancel>Cancel</button><button class="hd-btn dark">Create</button></div></form>`;
    const form = $('form', tileEl), input = $('input', form);
    input.focus();
    $('[data-cancel]', form).onclick = () => render();
    input.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); render(); } };
    form.onsubmit = e => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) { input.focus(); return; }
      addFile(f, name); render();
      toast(`${name} is at the front of ${f.short || f.name}`);
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
    // coming back from a file deep in the shelf: slide it into view; a file just added: back to the front
    const from = prev && $(`.fl[href="#review/${prev}"]`, track);
    if (from) track.scrollLeft = Math.max(0, from.offsetLeft - step());
    requestAnimationFrame(sync); sync();
  }
  function bind(root) {
    const L = level(), prev = shown, moved = shown !== L;
    if (moved) { scrollTo(0, 0); shown = L; }
    $$('[data-new]', root).forEach(b => onKeyClick(b, e => {
      e.preventDefault();
      if (b.dataset.new === 'folder') { toast('New folders come with the real app'); return; }
      const t = b.closest('[data-newtile]'); askName(t, FOLDERS.find(x => x.id === t.dataset.newtile));
    }));
    bindShelf(root, prev);
    fresh = null;
    $$('[data-act]', root).forEach(b => b.onclick = () => toast(b.dataset.act === 'pdf' ? 'Saved as a PDF' : 'Add a page: a photo, a note or a log'));

    // rename: the title becomes a field (Enter saves, Escape keeps the old name); delete asks once more, then goes back to the folder
    const own = $('.fl.head[data-file]', root), fileId = own?.dataset.file;
    const ren = $('[data-rename]', root), del = $('[data-delete]', root);
    if (ren) ren.onclick = () => {
      const x = FILES[fileId], c = $('.copy', own);
      c.outerHTML = `<form class="hd-form"><input value="${esc(x.title)}" maxlength="40" aria-label="New name" autocomplete="off"><small>Enter to save · Esc to keep it</small></form>`;
      const form = $('.hd-form', own), input = $('input', form);
      input.focus(); input.select();
      input.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); render(); } };
      input.onblur = () => setTimeout(() => { if (document.contains(form)) form.requestSubmit(); }, 0);
      form.onsubmit = e => {
        e.preventDefault();
        const name = input.value.trim().replace(/\s+/g, ' ');
        if (!name || name === x.title) { render(); return; }
        const old = x.title; renameFile(fileId, name); render(); toast(`Renamed ${old} to ${name}`);
      };
    };
    if (del) del.onclick = () => {
      if (!del.classList.contains('sure')) {
        del.classList.add('sure'); del.textContent = 'Delete?'; del.title = 'Click again to delete';
        setTimeout(() => { if (document.contains(del) && del.classList.contains('sure')) { del.classList.remove('sure'); del.innerHTML = BIN; del.title = 'Delete'; } }, 3000);
        return;
      }
      const x = FILES[fileId], name = x.title, fid = x.folder;
      deleteFile(fileId); location.hash = 'review/' + fid; toast(`Deleted ${name}`);
    };

    // report numbers count up when a file opens
    if (moved && !matchMedia('(prefers-reduced-motion: reduce)').matches) $$('[data-count]', root).forEach(n => {
      const to = +n.dataset.count, pre = n.dataset.pre || '', t0 = performance.now() + 250;
      const step = t => { const p = Math.min(1, Math.max(0, (t - t0) / 900)); n.textContent = pre + Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });

    // attendance: click a past day to stamp it (or take the stamp off); the report follows
    $$('.cal.stamp [data-d]', root).forEach(c => onKeyClick(c, () => {
      const d = +c.dataset.d, on = STORE.toggleGymDay(d);
      render();
      toast(on ? `Stamped Nov ${d}. Its gym hour is in Hours too` : `Took the stamp off Nov ${d}, and its gym hour`);
      $(`.cal.stamp [data-d="${d}"]`)?.focus();
    }));

    // lift log: type a new number, the change follows
    $$('[data-lift]', root).forEach(b => {
      b.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); b.blur(); } };
      b.oninput = () => {
        const row = LIFTS[+b.dataset.lift], v = parseFloat(b.textContent.replace(',', '.'));
        if (!isFinite(v)) return;
        row[2] = v;
        const d = b.closest('div').querySelector('.d'); d.textContent = delta(row[1], v); d.classList.toggle('dn', v < row[1]);
      };
      b.onblur = () => { b.textContent = fmt(LIFTS[+b.dataset.lift][2]); };
    });

    // diet rules and plan milestones tick on click
    const toggle = (el, on) => { el.classList.toggle('off', !on); el.setAttribute('aria-pressed', on); el.querySelector('.ck').outerHTML = tick(on); };
    $$('[data-diet]', root).forEach(el => onKeyClick(el, () => { const r = DIET[+el.dataset.diet]; r[0] = r[0] ? 0 : 1; toggle(el, !!r[0]); }));
    const book = root.querySelector('[data-book]')?.dataset.book;
    $$('[data-pi]', root).forEach(el => onKeyClick(el, () => {
      const p = BOOKS[book].plan[+el.dataset.pi]; p[0] = p[0] ? 0 : 1; toggle(el, !!p[0]);
      const n = $('[data-plan-n]', root); if (n) n.textContent = BOOKS[book].plan.filter(x => x[0]).length;
      persist();
      toast(p[0] ? `“${p[1]}” ticked off` : `“${p[1]}” is open again`);
    }));

    // before / after: drag across the photo
    $$('.ba', root).forEach(v => {
      const set = x => { const r = v.getBoundingClientRect(), p = Math.max(0, Math.min(100, (x - r.left) / r.width * 100)); v.style.setProperty('--p', p.toFixed(1) + '%'); v.setAttribute('aria-valuenow', Math.round(p)); };
      v.onpointerdown = e => { set(e.clientX); try { v.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ } v.onpointermove = ev => set(ev.clientX); v.onpointerup = () => { v.onpointermove = null; }; };
      v.onkeydown = e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); const p = parseFloat(v.style.getPropertyValue('--p')) || 50, q = Math.max(0, Math.min(100, p + (e.key === 'ArrowLeft' ? -5 : 5))); v.style.setProperty('--p', q + '%'); v.setAttribute('aria-valuenow', q); };
    });

    // add a weekly update to a project book, or something you did this month
    const add = $('[data-add]', root);
    if (add) add.onkeydown = e => {
      if (e.key !== 'Enter' || !add.value.trim()) return;
      BOOKS[book].entries.push([10, TODAY_D, add.value.trim()]);
      persist(); render(); toast('Added to week 4');
      $('[data-add]')?.focus();
    };
    const also = $('[data-also]', root);
    if (also) also.onkeydown = e => {
      if (e.key !== 'Enter' || !also.value.trim()) return;
      ALSO.push([also.value.trim(), `Added ${DAY_NAMES[TODAY.getDay()]} ${TODAY_D} ${MON3[TODAY.getMonth()]}`]);
      render(); toast('Filed under this month');
      $('[data-also]')?.focus();
    };
  }
  // Escape steps back out: file → folder → archive
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || (e.target instanceof Element && e.target.closest('input, textarea, .pop, [contenteditable]'))) return;
    if (location.hash.slice(1).split('/')[0] !== 'review') return;
    const L = level(); if (L === 'root') return;
    location.hash = FILES[L] ? 'review/' + FILES[L].folder : 'review';
  });
  return { html, bind, addFile, persist };
})();

// the Review page in the app (app/app.js). Moving between levels (#review/gym → #review/gym-nov) morphs.
P.review = () => RV.html();
P.review.bind = root => RV.bind(root);
P.review.morph = true;
