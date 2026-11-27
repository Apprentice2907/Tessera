// Tessera · Memory wall — one wire-grid wall per event (a trip, a festival, a season, a collection). Photos clipped on,
// postcards and paper tags, places that open their own wall, and real things hung on the wires with S-hooks,
// baskets and shelves. Everything snaps onto a wire like it would on a real grid. Saved in this browser.
'use strict';
(() => {
  const { ART, PROPS } = window.WALL_ART;
  const { KIT, SH } = window.WALL_KIT;
  const PW = 1690, PH = 850;                      // the wall is drawn at this size, then scaled to fit
  const G = 70, O = 5;                             // a wire every 70px; the frame runs 5px in from the edge
  const KEY = 'lo.walls.v2', OLD = 'lo.walls.v1';
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const toast = m => (window.toast ? window.toast(m) : console.log(m));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const THEMES = {
    // g: the bento ground its tile gets in the wall switcher
    trip:     { name: 'Trip', g: 'g-kraft', clip: 'peg', grid: 'black', art: 'desert' },
    festival: { name: 'Festival', g: 'g-orange', clip: 'peg', grid: 'gold', art: 'garba' },
    sport:    { name: 'Sport', g: 'g-green', clip: 'binder', grid: 'white', art: 'turf' },
    hobby:    { name: 'Hobby', g: 'g-night', clip: 'binder', grid: 'black', art: 'carwall' },
    everyday: { name: 'Everyday', g: 'g-paper', clip: 'binder', grid: 'black', art: 'train' },
  };
  // which objects the Add gallery shows first on each kind of wall
  const FIRST = { trip: ['Travel', 'Rajasthan', 'Food'], festival: ['Festival', 'Food'], sport: ['Sport'], hobby: ['Toys'], everyday: ['Desk', 'Plants'] };

  // ---------- sizes, and hanging things on the wires ----------
  const dims = it => it.kind === 'prop' ? (KIT[it.prop] || { w: 120, h: 120 }) : it.kind === 'postcard' ? { w: 278, h: 186 } : it.kind === 'note' ? { w: 170, h: 150 } : { w: 210, h: 250 };
  // how far below an item's top edge its wire runs: clips grip just under the top, tags hang from a string above, objects from their hook
  const hang = it => it.kind === 'prop' ? (KIT[it.prop]?.hy ?? 12) : it.kind === 'note' ? -32 : 6;
  function snapY(it, y) {
    const a = hang(it), h = dims(it).h;
    const last = Math.max(0, Math.min(Math.floor((PH - O - 10) / G), Math.floor((PH + 30 - h + a - O) / G)));
    return O + clamp(Math.round((y + a - O) / G), 0, last) * G - a;
  }

  // ---------- data ----------
  const P = (id, x, y, r, art, title, date, text) => ({ id, kind: 'photo', x, y, r, art, title, date, text });
  const K = (id, prop, x, wire) => ({ id, kind: 'prop', prop, x, y: wire - KIT[prop].hy, r: 0 });   // an object hung on the wire at y = wire
  function seed() {
    // memories were laid out on a narrower wall: spread them out, then clip each one onto its nearest wire
    const W = (id, name, theme, parent, items) => ({ id, name, theme, parent, items: items.map((it, i) => { const o = { z: i + 1, ...it }; if (o.kind !== 'prop') { o.x = Math.round(250 + (o.x - 250) * 1.3); o.y = snapY(o, o.y); } return o; }) });
    return {
      cur: 'rajasthan', mode: 'evening',
      walls: [
        W('rajasthan', 'Rajasthan trip', 'trip', null, [
          K('rk1', 'pot', 40, O), K('rk2', 'chai', -2, 635), K('rk3', 'map', 1330, 75), K('rk4', 'puppet', 1545, 75), K('rk5', 'ticket', 1340, 425), K('rk6', 'pottery', 1450, 565),
          { id: 'g1', kind: 'place', x: 262, y: 96, r: -3, wall: 'jodhpur' },
          { id: 'g2', kind: 'place', x: 556, y: 70, r: 2, wall: 'jaipur' },
          { id: 'g3', kind: 'place', x: 850, y: 104, r: -2, wall: 'udaipur' },
          { id: 'c1', kind: 'postcard', x: 300, y: 470, r: 3, art: 'desert', place: 'Rajasthan', date: 'Dec 2025', text: 'Nine days, three cities, one very long train ride. Came home with sand in my shoes and 600 photos.' },
          { id: 'n1', kind: 'note', x: 650, y: 486, r: -4, text: '9 days · 3 cities\nthe best chai was\nat a station' },
          P('p1', 880, 444, 4, 'train', 'The overnight train', '14 Dec', 'Jaipur to Jodhpur in a sleeper coach. Didn’t sleep, didn’t mind.'),
        ]),
        W('jodhpur', 'Jodhpur', 'trip', 'rajasthan', [
          K('jk1', 'juttis', 30, 75), K('jk2', 'spices', 10, 565), K('jk3', 'puppet', 1530, 75), K('jk4', 'snack', 1430, 565), K('jk5', 'chai', 1060, 635),
          P('j1', 262, 80, -3, 'mehrangarh', 'Mehrangarh Fort', '15 Dec', 'Walked up at 8 AM before the crowds. The view of the blue houses from the top is unreal.'),
          P('j2', 500, 112, 2, 'bluecity', 'Lost in the blue lanes', '15 Dec', 'Took a wrong turn on purpose. Every door is a different shade of blue.'),
          P('j3', 738, 78, -2, 'clocktower', 'Clock Tower market', '15 Dec', 'Spices, bangles, mirchi vada. Bought saffron for mom.'),
          P('j4', 968, 120, 3, 'umaid', 'Umaid Bhawan', '16 Dec', 'Half palace, half hotel, all of it too fancy for us. Took the photo anyway.'),
          { id: 'jc', kind: 'postcard', x: 320, y: 480, r: -2, art: 'bluecity', place: 'Jodhpur', date: '16 Dec', text: 'The Blue City at sunrise is the quietest place I have ever been. Mirchi vada at Shahi Samosa: 10/10.' },
          { id: 'jn', kind: 'note', x: 690, y: 500, r: 3, text: 'Shahi Samosa\nmirchi vada\n10 / 10' },
        ]),
        W('jaipur', 'Jaipur', 'trip', 'rajasthan', [
          K('yk1', 'pot', 40, O), K('yk2', 'pottery', 10, 565), K('yk3', 'bandhani', 1520, 75), K('yk4', 'kurta', 1400, 425), K('yk5', 'bangles', 1060, 635),
          P('y1', 262, 84, 2, 'hawa', 'Hawa Mahal', '12 Dec', '953 little windows. We counted for a while, then gave up and got lassi.'),
          P('y2', 500, 118, -3, 'amber', 'Amber Fort', '12 Dec', 'Climbed every staircase. Legs remembered it for three days.'),
          P('y3', 740, 80, 3, 'nahargarh', 'Sunset at Nahargarh', '13 Dec', 'The whole city lit up below us. Best 40 minutes of the trip.'),
          P('y4', 970, 116, -2, 'bazaar', 'Bapu Bazaar', '13 Dec', 'Bargained for mojaris for twenty minutes. Saved 60 rupees. Worth it.'),
          { id: 'yc', kind: 'postcard', x: 330, y: 482, r: 2, art: 'hawa', place: 'Jaipur', date: '13 Dec', text: 'Pink city, pink sky. Got blue pottery for mom and a very pink kurta for me.' },
          { id: 'yn', kind: 'note', x: 700, y: 492, r: -3, text: 'blue pottery\nfor mom ✓' },
        ]),
        W('udaipur', 'Udaipur', 'trip', 'rajasthan', [
          K('uk1', 'pot', 40, O), K('uk2', 'flowers', 30, 565), K('uk3', 'miniature', 1470, 75), K('uk4', 'chai', 1400, 565), K('uk5', 'shades', 1090, 635),
          P('u1', 262, 96, -2, 'pichola', 'Boat on Lake Pichola', '18 Dec', 'Sunset boat ride. The Lake Palace really does look like it floats.'),
          P('u2', 500, 74, 3, 'citypalace', 'City Palace', '18 Dec', 'So many balconies. Every window had a view of the lake.'),
          P('u3', 742, 110, -3, 'sajjangarh', 'Sajjangarh at dusk', '19 Dec', 'Monsoon Palace, no monsoon, still beautiful.'),
          P('u4', 972, 82, 2, 'bagore', 'Dance at Bagore ki Haveli', '19 Dec', 'She danced with nine pots on her head. NINE.'),
          { id: 'uc', kind: 'postcard', x: 330, y: 480, r: -3, art: 'pichola', place: 'Udaipur', date: '19 Dec', text: 'City of lakes. Slowest, softest two days of the trip. Want to come back for a whole week.' },
          { id: 'un', kind: 'note', x: 700, y: 500, r: 2, text: 'come back\nfor a whole week' },
        ]),
        W('navratri', 'Navratri 2026', 'festival', null, [
          K('vk1', 'dandiya', 70, 75), K('vk2', 'diyas', -2, 635), K('vk3', 'kurta', 1440, 75), K('vk4', 'bangles', 1420, 495), K('vk5', 'puja', 1080, 635),
          P('v1', 262, 104, -3, 'garba', 'Garba, night 1', '22 Sep', 'Started shy, ended up in the inner circle. Danced till 2 AM.'),
          P('v2', 500, 74, 2, 'dandiya', 'Dandiya with the gang', '25 Sep', 'Only got hit on the knuckles twice. Personal best.'),
          P('v3', 738, 112, -2, 'pandal', 'Pandal hopping', '28 Sep', 'Seven pandals in one night. The lights at the last one were the best.'),
          P('v4', 970, 86, 3, 'kurta', 'Day 9 outfit', '30 Sep', 'The pink kurta from Jaipur finally got its moment.'),
          { id: 'vc', kind: 'postcard', x: 330, y: 486, r: 2, art: 'garba', place: 'Navratri', date: 'Sep 2026', text: 'Nine nights of music and colour. My feet still hurt and I would do it again tomorrow.' },
          { id: 'vn', kind: 'note', x: 700, y: 500, r: -3, text: 'danced till 2 AM\nfeet: destroyed' },
        ]),
        W('football', 'Football season', 'sport', null, [
          K('fk1', 'boots', 30, 75), K('fk2', 'ball', 40, 565), K('fk3', 'jersey', 1430, 75), K('fk4', 'whistle', 1450, 425), K('fk5', 'medal', 1590, 425), K('fk6', 'bottle', 1430, 635),
          P('f1', 262, 90, -2, 'turf', 'Thursday turf', 'Every Thu', 'Turf, sector 21, 7 PM. Same ten people, never the same game.'),
          P('f2', 500, 118, 3, 'goal', 'First goal of the season', '4 Sep', 'Top corner, weak foot. Nobody believes me but it happened.'),
          P('f3', 740, 76, -3, 'team', 'The team', '20 Oct', 'After winning the inter-hostel final. Number 10, obviously.'),
          P('f4', 972, 110, 2, 'rain', 'The rain match', '9 Aug', 'Played through a thunderstorm. Ball stopped in a puddle twice.'),
          { id: 'fn', kind: 'note', x: 340, y: 500, r: -3, text: '12 goals\n9 assists\n1 sprained ankle' },
          { id: 'fn2', kind: 'note', x: 640, y: 512, r: 3, text: 'next: learn\nto use my left foot' },
        ]),
        W('cars', 'Hot Wheels collection', 'hobby', null, [
          K('hk1', 'carcard', 40, 75), K('hk2', 'track', 24, 495), K('hk3', 'card2', 1440, 75), K('hk4', 'wishlist', 1470, 425), K('hk5', 'cars', 560, 635), K('hk6', 'cars', 980, 635),
          P('h1', 262, 90, -2, 'carwall', 'The collection so far', 'Nov 2026', '142 cars. Most of them still smell like the shop.'),
          P('h2', 500, 116, 3, 'loop', 'First loop-the-loop', 'Mar 2026', 'Took eleven tries. The purple one finally made it all the way round.'),
          P('h3', 740, 78, -3, 'race', 'Race day on the stairs', 'Jun 2026', 'Best of five down the stairs. The red 7 won three of them.'),
          P('h4', 970, 112, 2, 'haul', 'Sunday haul', 'Oct 2026', 'Four new cards from the shop near the metro. One of them is the rare one.'),
          { id: 'hn', kind: 'note', x: 340, y: 500, r: -3, text: '142 cars\n9 still on card\n1 very rare one' },
          { id: 'hn2', kind: 'note', x: 700, y: 500, r: 3, text: 'next: a glass\ncase for the\nrare ones' },
        ]),
      ],
    };
  }
  // a wall saved before objects existed keeps everything, gets its objects, and every memory is clipped onto a wire
  function upgrade(old) {
    const fresh = seed();
    old.walls.forEach(w => {
      const s = fresh.walls.find(x => x.id === w.id), props = s ? s.items.filter(i => i.kind === 'prop') : [];
      w.items = [...props, ...w.items.map(i => ({ ...i, z: (i.z || 1) + props.length, y: snapY(i, i.y) }))];
    });
    fresh.walls.forEach(s => { if (!old.walls.some(w => w.id === s.id)) old.walls.push(s); });
    return old;
  }
  let D;
  try { D = JSON.parse(localStorage.getItem(KEY)); } catch { D = null; }
  if (!D || !Array.isArray(D.walls)) {
    let old = null; try { old = JSON.parse(localStorage.getItem(OLD)); } catch { /* nothing saved */ }
    D = old && Array.isArray(old.walls) ? upgrade(old) : seed();
  }
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch { toast('Could not save: browser storage is full. Remove a big photo.'); } }, 300); };
  const wall = id => D.walls.find(w => w.id === (id || D.cur));
  const root = w => { while (w && w.parent) w = wall(w.parent); return w; };
  const count = w => w.items.reduce((n, it) => n + (it.kind === 'place' ? count(wall(it.wall) || { items: [] }) : it.kind === 'prop' ? 0 : 1), 0);
  const src = it => it.src || (ART[it.art] || ART[THEMES.everyday.art])();
  // up to n of a wall's own pictures: the first one from each place on it, then its own photos and postcards
  function pics(w, n = 3) {
    const own = it => it.kind === 'photo' || it.kind === 'postcard';
    const out = w.items.filter(it => it.kind === 'place').map(it => (wall(it.wall)?.items || []).find(own)).filter(Boolean);
    return [...out, ...w.items.filter(own)].slice(0, n).map(src);
  }

  // ---------- small drawn parts ----------
  const PEG = `<svg class="clip peg" width="20" height="54" viewBox="0 0 20 54" aria-hidden="true"><rect x="2" y="0" width="7" height="54" rx="2" fill="#D9B98A"/><rect x="11" y="0" width="7" height="54" rx="2" fill="#CDAA78"/><rect x="2" y="0" width="16" height="54" rx="2" fill="none" stroke="#A88355" stroke-width=".8"/><circle cx="10" cy="20" r="5" fill="none" stroke="#9aa0a8" stroke-width="2"/></svg>`;
  const BINDER = `<svg class="clip binder" width="36" height="40" viewBox="0 0 36 40" aria-hidden="true"><path d="M11 18C9 4 27 4 25 18" stroke="#cfd3d8" stroke-width="2.4" fill="none"/><path d="M6 18h24l-3 18H9z" fill="#141414"/><path d="M6 18h24l-1 4H7z" fill="#3a3a3a"/></svg>`;
  const clipFor = (it, theme) => (it.clip || THEMES[theme].clip) === 'peg' ? PEG : BINDER;

  // the wire grid: round powder-coated wires (a dark body, a highlight up-left, a shade down-right), a heavier
  // frame, and two S-hooks hanging it from nails in the wall. Its shadow on the wall comes from CSS.
  const WIRE = { black: ['#161616', 'rgba(255,255,255,.32)', ''], gold: ['#9C7628', '#F3D98E', 'rgba(70,48,10,.55)'], white: ['#EDEBE6', '#FFFFFF', 'rgba(120,112,98,.5)'] };
  function grid(kind) {
    const [base, hi, lo] = WIRE[kind] || WIRE.black;
    let v = '', h = '';
    for (let x = O + G; x < PW - O - 10; x += G) v += `M${x} ${O}V${PH - O}`;
    for (let y = O + G; y < PH - O - 10; y += G) h += `M${O} ${y}H${PW - O}`;
    const wire = (d, w) => {
      const s = d ? `<path d="${d}"` : `<rect x="${O}" y="${O}" width="${PW - 2 * O}" height="${PH - 2 * O}" rx="12"`, k = n => (w * n).toFixed(2);
      return `${s} stroke="${base}" stroke-width="${w}"/>${lo ? `${s} stroke="${lo}" stroke-width="${k(.4)}" transform="translate(${k(.28)} ${k(.28)})"/>` : ''}${s} stroke="${hi}" stroke-width="${Math.max(.8, w * .3).toFixed(2)}" transform="translate(${k(-.24)} ${k(-.24)})"/>`;
    };
    const nail = x => `${SH(x, -42, 48)}<circle cx="${x + 1.5}" cy="-46" r="6" fill="#77736C"/><circle cx="${x}" cy="-47.5" r="2.4" fill="#DAD6CE"/>`;
    return `<svg class="grid" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}" overflow="visible" aria-hidden="true"><g fill="none" stroke-linecap="round">${wire(v, 3.4)}${wire(h, 3.6)}${wire('', 7.5)}</g>${nail(Math.round(PW * .27))}${nail(Math.round(PW * .73))}</svg>`;
  }

  // fairy lights: strings of warm bulbs draped over the grid
  function lights() {
    const strands = [
      [[-12, 22], [PW / 3, 22], 62], [[PW / 3, 22], [PW * 2 / 3, 22], 74], [[PW * 2 / 3, 22], [PW + 12, 22], 62],
      [[16, 10], [34, PH - 10], 46], [[PW - 16, 10], [PW - 34, PH - 10], -46],
      [[-10, 322], [PW + 10, 250], 130], [[-10, PH - 40], [PW / 2, PH - 30], 34], [[PW / 2, PH - 30], [PW + 10, PH - 42], 34],
    ];
    let wires = '', bulbs = '', n = 0;
    strands.forEach(([[x1, y1], [x2, y2], sag]) => {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
      // a strand sags down when it runs across, and bows inward when it runs down a side
      const c = Math.abs(dx) > Math.abs(dy) ? [mx, my + sag * 2] : [mx + sag * 2, my];
      wires += `<path d="M${x1} ${y1}Q${c[0]} ${c[1]} ${x2} ${y2}" class="wire"/>`;
      const k = Math.round(L / 34);
      for (let i = 1; i < k; i++) {
        const t = i / k, x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * c[0] + t * t * x2, y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * c[1] + t * t * y2;
        n++;
        bulbs += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="17" class="halo" style="animation-duration:${(2 + (n * 7) % 30 / 10).toFixed(1)}s;animation-delay:-${(n * 13 % 40) / 10}s"/><circle r="3.3" class="bulb"/></g>`;
      }
    });
    return `<svg class="lights" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}" overflow="visible" aria-hidden="true"><defs><radialGradient id="bulbGlow"><stop offset="0" stop-color="#FFE2A0" stop-opacity=".95"/><stop offset=".35" stop-color="#FFC163" stop-opacity=".45"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient></defs>${wires}${bulbs}</svg>`;
  }

  // what is fixed to the wall itself: two spotlights, and a toran over a festival wall
  const DEFS = `<defs><radialGradient id="flameGlow"><stop offset="0" stop-color="#FFD27A" stop-opacity=".85"/><stop offset=".45" stop-color="#FFA23A" stop-opacity=".3"/><stop offset="1" stop-color="#FF8A1F" stop-opacity="0"/></radialGradient><linearGradient id="cloth" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient><radialGradient id="cone" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#FFE3B0" stop-opacity=".5"/><stop offset="1" stop-color="#FFE3B0" stop-opacity="0"/></radialGradient></defs>`;
  function fixtures(theme) {
    const R = PW - 330, spots = `<g class="spots"><path d="M330 10L230 420H430Z" fill="url(#cone)" class="cone"/><path d="M${R} 10L${R - 100} 420H${R + 100}Z" fill="url(#cone)" class="cone"/>${PROPS.spot(330, -2)}${PROPS.spot(R, -2)}</g>`;
    return spots + (theme === 'festival' ? PROPS.toran(230, PW - 230, 14) : '');
  }

  // ---------- items ----------
  function itemHTML(it, w) {
    const theme = w.theme, style = `left:${it.x}px;top:${it.y}px;--r:${it.r || 0}deg;z-index:${it.z || 1}`;
    const head = `<div class="wi k-${it.kind}" data-id="${it.id}" style="${style}" tabindex="0" role="button"`;
    if (it.kind === 'prop') {
      const d = KIT[it.prop]; if (!d) return '';
      return `<div class="wi k-prop" data-id="${it.id}" style="${style};--oy:${d.hy}px" tabindex="0" role="button" aria-label="${esc(it.title || d.name)}"><svg width="${d.w}" height="${d.h}" viewBox="0 0 ${d.w} ${d.h}" overflow="visible" aria-hidden="true">${d.draw()}</svg></div>`;
    }
    if (it.kind === 'photo') return `${head} aria-label="${esc(it.title)}"><div class="print"><div class="ph"><img src="${src(it)}" alt="" draggable="false"></div><div class="cap">${esc(it.title)}</div>${it.date ? `<div class="dt">${esc(it.date)}</div>` : ''}</div>${clipFor(it, theme)}</div>`;
    if (it.kind === 'postcard') return `${head} aria-label="Postcard from ${esc(it.place)}"><div class="post"><img src="${src(it)}" alt="" draggable="false"><div class="greet"><small>Greetings from</small><b>${esc(it.place)}</b></div><span class="pstamp"></span></div><span class="c1">${clipFor(it, theme)}</span><span class="c2">${clipFor(it, theme)}</span></div>`;
    if (it.kind === 'note') return `${head} aria-label="Note"><svg class="string" width="60" height="40" viewBox="0 0 60 40" aria-hidden="true"><path d="M30 2C18 10 14 24 30 38M30 2C42 10 46 24 30 38" stroke="#9b7b55" stroke-width="1.6" fill="none"/></svg><div class="tag"><i></i><p>${esc(it.text).replace(/\n/g, '<br>')}</p></div></div>`;
    if (it.kind === 'place') {
      const child = wall(it.wall) || { name: '?', items: [] }, pics = child.items.filter(x => x.kind === 'photo' || x.kind === 'postcard').slice(0, 3);
      const n = count(child);
      return `${head} aria-label="Open ${esc(child.name)}"><div class="stack">${(pics.length ? pics : [{ art: THEMES[child.theme].art }]).map((p, i) => `<div class="mini" style="--r2:${[-7, 5, -1][i]}deg;--dx:${[-14, 12, 0][i]}px"><img src="${src(p)}" alt="" draggable="false"></div>`).join('')}</div><div class="ptag"><b>${esc(child.name)}</b><small>${n} memor${n === 1 ? 'y' : 'ies'} ›</small></div>${clipFor(it, theme)}</div>`;
    }
    return '';
  }

  // ---------- the scene ----------
  let el = null, scale = 1;
  function render() {
    if (!el) return;
    const w = wall() || D.walls[0]; D.cur = w.id;
    const r = root(w), trail = [];
    for (let x = w; x; x = x.parent ? wall(x.parent) : null) trail.unshift(x);
    el.dataset.mode = D.mode; el.dataset.theme = w.theme; el.dataset.grid = THEMES[w.theme].grid;
    q('.panel', el).innerHTML = `${grid(THEMES[w.theme].grid)}<svg class="props back" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}" overflow="visible" aria-hidden="true">${DEFS}${fixtures(w.theme)}</svg>${lights()}<div class="items">${w.items.map(it => itemHTML(it, w)).join('')}</div>${w.items.length ? '' : `<div class="empty"><b>An empty wall.</b><span>Add a photo, a postcard, a place or something to hang.</span></div>`}`;
    q('.wtop .crumbs', el).innerHTML = `<button class="wpick" data-pick aria-haspopup="true"><b>${esc(r.name)}</b><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 4.5 6 7.5l3-3"/></svg></button>${trail.slice(1).map((x, i) => `<span class="sl">/</span><button class="crumb${i === trail.length - 2 ? ' on' : ''}" data-go="${x.id}">${esc(x.name)}</button>`).join('')}${w.parent ? `<button class="back" data-go="${w.parent}" title="Back to ${esc(wall(w.parent).name)}">← Back</button>` : ''}`;
    q('[data-lights]', el).classList.toggle('on', D.mode === 'evening');
    q('[data-lights] span', el).textContent = D.mode === 'evening' ? 'Lights on' : 'Lights off';
    bindItems();
    fit();
  }
  // the wall fits the window; on a tall, narrow screen (a phone) it fills the height instead and you slide along it
  let panX = null;
  function fit() {
    if (!el) return;
    const top = 76, bottom = 104, aw = innerWidth - 40, ah = innerHeight - top - bottom;
    const tallNarrow = innerWidth < 720 && innerHeight > innerWidth;
    scale = tallNarrow ? Math.min(ah / (PH + 40), .62) : Math.min(aw / (PW + 60), ah / (PH + 40));
    const w = PW * scale, room = innerWidth - w, pans = room < 32;
    if (pans) panX = clamp(panX ?? (room / 2), room - 16, 16); else panX = null;
    el.classList.toggle('pannable', pans);
    const st = q('.stage', el);
    st.style.transform = `translate(${pans ? panX : room / 2}px, ${top + (ah - PH * scale) / 2 + 8 * scale}px) scale(${scale})`;
  }
  // slide the wall: drag its empty parts (or swipe), or scroll sideways
  function bindPan() {
    el.addEventListener('pointerdown', e => {
      if (!el.classList.contains('pannable') || e.button > 0 || e.target.closest('.wi, .wtop, .wmenu, .wv-back, button, a, input')) return;
      const x0 = e.clientX, p0 = panX; let moved = false;
      const mv = ev => { const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 4) return; moved = true; panX = p0 + dx; fit(); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
    el.addEventListener('wheel', e => {
      if (!el.classList.contains('pannable') || e.target.closest('.wmenu, .wv-back')) return;
      e.preventDefault(); panX -= Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; fit();
    }, { passive: false });
  }
  // a little swing when something is let go on a wire
  const swing = n => { n.classList.remove('swing'); void n.offsetWidth; n.classList.add('swing'); setTimeout(() => n.classList.remove('swing'), 1200); };
  function bindItems() {
    qa('.wi', el).forEach(n => {
      n.onpointerdown = e => {
        if (e.button !== 0) return;
        const it = wall().items.find(x => x.id === n.dataset.id); if (!it) return;
        const sx = e.clientX, sy = e.clientY, x0 = it.x, y0 = it.y, { w: iw, h: ih } = dims(it); let moved = false;
        n.setPointerCapture(e.pointerId);
        const top = Math.max(...wall().items.map(x => x.z || 0));
        const mv = ev => {
          if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
          if (!moved) { moved = true; n.classList.add('lift'); it.z = top + 1; n.style.zIndex = it.z; }
          it.x = Math.round(clamp(x0 + (ev.clientX - sx) / scale, -iw * .3, PW - iw * .7));
          it.y = Math.round(clamp(y0 + (ev.clientY - sy) / scale, -60, PH - ih * .5));
          n.style.left = it.x + 'px'; n.style.top = it.y + 'px';
        };
        const up = () => {
          n.removeEventListener('pointermove', mv); n.removeEventListener('pointerup', up); n.removeEventListener('pointercancel', up);
          n.classList.remove('lift');
          if (!moved) return open(it);
          it.y = snapY(it, it.y); n.style.top = it.y + 'px'; swing(n); save();
        };
        n.addEventListener('pointermove', mv); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
      };
      n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(wall().items.find(x => x.id === n.dataset.id)); } };
    });
  }
  const go = id => { if (!wall(id)) return; D.cur = id; save(); closeMenus(); render(); };
  function open(it) {
    if (!it) return;
    if (it.kind === 'place') return go(it.wall);
    viewer(it);
  }

  // ---------- reading a photo from disk ----------
  const readPhoto = file => new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .84)); }; img.onerror = () => res(null); img.src = fr.result; };
    fr.onerror = () => res(null); fr.readAsDataURL(file);
  });
  const pickFiles = multiple => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = multiple; i.onchange = () => res([...i.files]); i.click(); });
  // a free spot: the place that overlaps the fewest things, near the middle; then clipped onto the nearest wire
  function freeSpot(w, iw, ih) {
    let best = { x: Math.round(PW / 2 - iw / 2), y: 300, s: Infinity };
    for (let y = 30; y <= PH - ih * .8; y += 35) for (let x = 20; x <= PW - iw - 20; x += 40) {
      let s = 0;
      w.items.forEach(o => { const { w: ow, h: oh } = dims(o); const ix = Math.max(0, Math.min(x + iw, o.x + ow) - Math.max(x, o.x)), iy = Math.max(0, Math.min(y + ih, o.y + oh) - Math.max(y, o.y)); s += ix * iy; });
      s += Math.hypot(x + iw / 2 - PW / 2, y + ih / 2 - PH / 2) * .5;
      if (s < best.s) best = { x, y, s };
    }
    return { x: best.x, y: best.y };
  }
  const spot = (w, it) => { const { w: iw, h: ih } = dims(it), p = freeSpot(w, iw, ih); it.x = p.x; it.y = snapY(it, p.y); return it; };
  const nextZ = w => Math.max(0, ...w.items.map(x => x.z || 0)) + 1;
  const today = () => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  // ---------- adding ----------
  async function add(kind) {
    closeMenus();
    const w = wall(), r = () => Math.round(Math.random() * 8 - 4);
    if (kind === 'object') return gallery();
    if (kind === 'photo') {
      const files = (await pickFiles(true)).filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      let first;
      for (const f of files) { const s = await readPhoto(f); if (!s) continue; const it = spot(w, { id: uid('p'), kind: 'photo', r: r(), z: nextZ(w), src: s, title: f.name.replace(/\.[^.]+$/, '').slice(0, 40), date: today(), text: '' }); w.items.push(it); first = first || it; }
      save(); render(); if (first) viewer(first, true);
      return;
    }
    if (kind === 'postcard') { const it = spot(w, { id: uid('c'), kind: 'postcard', r: r(), z: nextZ(w), art: THEMES[w.theme].art, place: w.name, date: today(), text: '' }); w.items.push(it); save(); render(); viewer(it, true); return; }
    if (kind === 'note') { const it = spot(w, { id: uid('n'), kind: 'note', r: r(), z: nextZ(w), text: '' }); w.items.push(it); save(); render(); viewer(it, true); return; }
    if (kind === 'place') {
      const name = await ask('A place on this wall', 'It gets its own wall, with its own photos.', 'e.g. Jodhpur', 'Add place');
      if (!name) return;
      const id = uid('w'); D.walls.push({ id, name, theme: w.theme, parent: w.id, items: [] });
      w.items.push(spot(w, { id: uid('g'), kind: 'place', r: r(), z: nextZ(w), wall: id }));
      save(); render(); toast(`Added ${name}. Click it to fill it.`);
    }
  }
  function addProp(key) {
    const d = KIT[key], w = wall(); if (!d) return null;
    const it = spot(w, { id: uid('o'), kind: 'prop', prop: key, r: 0, z: nextZ(w) });
    w.items.push(it); save(); render();
    const n = q(`.wi[data-id="${it.id}"]`, el); if (n) swing(n);
    toast(`${d.name} is up. Drag it onto any wire.`);
    return it;
  }

  // ---------- dialogs ----------
  function modal(html, cls = '') {
    const b = document.createElement('div'); b.className = 'wv-back'; b.innerHTML = `<div class="wv ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(b);
    const close = () => { b.remove(); render(); };
    b.addEventListener('pointerdown', e => { if (e.target === b) close(); });
    b.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    return { b, m: b.firstElementChild, close };
  }
  const ask = (title, sub, ph, ok) => new Promise(res => {
    const { b, m } = modal(`<h3>${esc(title)}</h3><p class="sub">${esc(sub)}</p><form><input placeholder="${esc(ph)}" autocomplete="off"><div class="foot"><button type="button" class="wb" data-no>Cancel</button><button class="wb dark">${esc(ok)}</button></div></form>`, 'small');
    const i = q('input', m); setTimeout(() => i.focus(), 30);
    q('[data-no]', m).onclick = () => { b.remove(); res(null); };
    q('form', m).onsubmit = e => { e.preventDefault(); b.remove(); res(i.value.trim() || null); };
  });
  // an object, drawn bigger on its own wire
  const bigProp = d => { const s = Math.min(1.5, 400 / d.h, 420 / d.w); return `<div class="v-prop" style="--wy:${(d.hy * s).toFixed(1)}px"><svg width="${Math.round(d.w * s)}" height="${Math.round(d.h * s)}" viewBox="0 0 ${d.w} ${d.h}" overflow="visible" aria-hidden="true">${d.draw()}</svg></div>`; };
  function viewer(it, fresh) {
    const w = wall(), d = it.kind === 'prop' ? KIT[it.prop] : null;
    const visual = d ? bigProp(d)
      : it.kind === 'note'
        ? `<div class="v-note"><div class="tag big"><i></i><p>${esc(it.text || '…').replace(/\n/g, '<br>')}</p></div></div>`
        : it.kind === 'postcard'
          ? `<div class="v-post"><div class="post front"><img src="${src(it)}" alt=""><div class="greet"><small>Greetings from</small><b>${esc(it.place)}</b></div></div><div class="post backside"><div class="msg">${esc(it.text || 'Write the back of the postcard…').replace(/\n/g, '<br>')}</div><div class="addr"><span class="stampbig"><img src="${src(it)}" alt=""></span><span class="pm">${esc((it.place || '').toUpperCase())}<br>${esc(it.date || '')}</span><i></i><i></i><i></i></div></div></div>`
          : `<div class="v-photo"><div class="print big"><div class="ph"><img src="${src(it)}" alt=""></div><div class="cap">${esc(it.title)}</div></div></div>`;
    const fields = d
      ? `<label>Name<input data-f="title" value="${esc(it.title || d.name)}"></label><label>The story behind it<textarea data-f="text" rows="5" placeholder="Where it came from, who it was from">${esc(it.text)}</textarea></label>`
      : it.kind === 'note'
        ? `<label>Note<textarea data-f="text" rows="5" placeholder="Something small worth keeping">${esc(it.text)}</textarea></label>`
        : it.kind === 'postcard'
          ? `<label>Greetings from<input data-f="place" value="${esc(it.place)}"></label><label>Date<input data-f="date" value="${esc(it.date)}"></label><label>On the back<textarea data-f="text" rows="5" placeholder="What happened there?">${esc(it.text)}</textarea></label>`
          : `<label>Title<input data-f="title" value="${esc(it.title)}"></label><label>Date<input data-f="date" value="${esc(it.date)}"></label><label>What happened<textarea data-f="text" rows="5" placeholder="A few lines to remember it by">${esc(it.text)}</textarea></label>`;
    const label = d ? 'Object' : it.kind === 'photo' ? 'Photo' : it.kind === 'postcard' ? 'Postcard' : 'Note';
    const { b, m, close } = modal(`<div class="v-l">${visual}</div><div class="v-r"><div class="v-h"><span>${label} · ${esc(w.name)}</span><button class="x" data-close aria-label="Close">×</button></div>${fields}<div class="foot">${it.kind === 'photo' || it.kind === 'postcard' ? `<button class="wb" data-photo>${it.src ? 'Change photo' : 'Use my photo'}</button>${it.src && it.art ? '<button class="wb" data-drawing>Use drawing</button>' : ''}` : ''}<button class="wb red" data-del>${d ? 'Take down' : 'Delete'}</button><button class="wb dark" data-close>Done</button></div></div>`, 'view');
    const upd = () => {
      qa('[data-f]', m).forEach(f => { it[f.dataset.f] = f.value; });
      const cap = q('.v-photo .cap', m); if (cap) cap.textContent = it.title;
      const gb = q('.v-post .greet b', m); if (gb) gb.textContent = it.place;
      const msg = q('.v-post .msg', m); if (msg) msg.innerHTML = esc(it.text || 'Write the back of the postcard…').replace(/\n/g, '<br>');
      const tp = q('.v-note .tag p', m); if (tp) tp.innerHTML = esc(it.text || '…').replace(/\n/g, '<br>');
      save();
    };
    qa('[data-f]', m).forEach(f => { f.oninput = upd; });
    qa('[data-close]', m).forEach(x => { x.onclick = close; });
    q('[data-photo]', m)?.addEventListener('click', async () => { const [f] = await pickFiles(false); if (!f) return; const s = await readPhoto(f); if (!s) return; it.src = s; save(); b.remove(); render(); viewer(it); });
    q('[data-drawing]', m)?.addEventListener('click', () => { delete it.src; save(); b.remove(); render(); viewer(it); });
    q('[data-del]', m).onclick = e => {
      const btn = e.currentTarget;
      if (!btn.classList.contains('sure')) { btn.classList.add('sure'); btn.textContent = d ? 'Take it down?' : 'Delete it?'; return; }
      w.items = w.items.filter(x => x !== it); save(); close(); toast(d ? 'Taken down' : 'Deleted');
    };
    setTimeout(() => (fresh ? q('[data-f]', m) : q('[data-close].dark', m))?.focus(), 30);
  }
  // the things you can hang: grouped, with what suits this wall first
  function gallery() {
    closeMenus();
    const w = wall(), cats = [...new Set([...(FIRST[w.theme] || []), ...Object.values(KIT).map(d => d.cat)])];
    const tile = ([k, d]) => { const s = Math.min(92 / d.h, 118 / d.w, 1); return `<button class="gi" data-k="${k}"><span class="gth" style="--wy:${(10 + d.hy * s).toFixed(1)}px"><svg width="${Math.round(d.w * s)}" height="${Math.round(d.h * s)}" viewBox="0 0 ${d.w} ${d.h}" overflow="visible" aria-hidden="true">${d.draw()}</svg></span><b>${esc(d.name)}</b></button>`; };
    const { b, m, close } = modal(`<div class="v-h"><span>Hang something · ${esc(w.name)}</span><button class="x" data-close aria-label="Close">×</button></div>${cats.map(c => `<h4>${esc(c)}</h4><div class="gx">${Object.entries(KIT).filter(([, d]) => d.cat === c).map(tile).join('')}</div>`).join('')}`, 'gallery');
    q('[data-close]', m).onclick = close;
    m.addEventListener('click', e => { const g = e.target.closest('[data-k]'); if (!g) return; b.remove(); addProp(g.dataset.k); });
    setTimeout(() => q('.gi', m)?.focus(), 30);
  }

  // ---------- menus: which wall, add, lights ----------
  function closeMenus() { qa('.wmenu', el || document).forEach(n => n.remove()); }
  const PEN = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.6 2.4l2 2L5 11l-2.7.7L3 9z"/></svg>';
  const BIN = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4h9M5.5 4V2.5h3V4M3.8 4l.6 7.5h5.2l.6-7.5"/></svg>';
  const dot = s => /[.!?…]$/.test(s) ? s : s + '.';
  const memories = n => n ? `${n} memor${n === 1 ? 'y' : 'ies'}` : 'Nothing up yet';
  // which wall: a small bento of your walls, each tile in its own ground with a few of its prints peeking up
  function pickMenu(anchor) {
    closeMenus();
    const tops = D.walls.filter(w => !w.parent), cur = root(wall()).id, tilt = ['6deg', '-5deg', '3deg'];
    const tile = w => {
      const n = count(w), on = cur === w.id;
      return `<div class="wt ${THEMES[w.theme].g}${on ? ' on' : ''}" data-open="${w.id}" tabindex="0" role="button" aria-label="${esc(w.name)}, ${memories(n)}${on ? ', showing now' : ''}">`
        + `<p class="wc"><b>${esc(dot(w.name))}</b><span>${memories(n)}</span></p>`
        + pics(w).map((s, i) => `<span class="wp" style="--i:${i};--r:${tilt[i]}"><img src="${s}" alt="" draggable="false"></span>`).join('')
        + (on ? '<span class="label">Showing</span>' : '')
        + `<span class="wa"><button class="ico" data-ren="${w.id}" title="Rename" aria-label="Rename ${esc(w.name)}">${PEN}</button><button class="ico" data-delw="${w.id}" title="Delete" aria-label="Delete ${esc(w.name)}">${BIN}</button></span></div>`;
    };
    const m = document.createElement('div'); m.className = 'wmenu pick';
    m.innerHTML = tops.map(tile).join('') + '<button class="wt g-dots wnew" data-new><p class="wc"><b>New wall.</b><span>For a trip, a festival, a season.</span></p><span class="plus" aria-hidden="true">+</span></button>';
    el.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.left = Math.max(12, Math.min(r.left, innerWidth - m.offsetWidth - 12)) + 'px'; m.style.top = r.bottom + 8 + 'px';
    m.onclick = async e => {
      const ren = e.target.closest('[data-ren]'), del = e.target.closest('[data-delw]'), op = e.target.closest('[data-open]');
      if (ren) { const w = wall(ren.dataset.ren); closeMenus(); const n = await ask('Rename wall', w.name, w.name, 'Rename'); if (n) { w.name = n; save(); render(); } return; }
      if (del) {
        e.stopPropagation(); const w = wall(del.dataset.delw);
        if (D.walls.filter(x => !x.parent).length < 2) { toast('Keep at least one wall'); return; }
        if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = 'Delete?'; return; }
        const gone = new Set([w.id]); let grew = true; while (grew) { grew = false; D.walls.forEach(x => { if (x.parent && gone.has(x.parent) && !gone.has(x.id)) { gone.add(x.id); grew = true; } }); }
        D.walls = D.walls.filter(x => !gone.has(x.id)); if (gone.has(D.cur)) D.cur = D.walls.find(x => !x.parent).id;
        save(); closeMenus(); render(); toast(`Deleted ${w.name}`); return;
      }
      if (e.target.closest('[data-new]')) { closeMenus(); newWall(); return; }
      if (op) go(op.dataset.open);
    };
    m.onkeydown = e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.open) { e.preventDefault(); go(e.target.dataset.open); }
      if (e.key === 'Escape') { closeMenus(); anchor.focus(); }
    };
  }
  function newWall() {
    let theme = 'trip';
    const { b, m } = modal(`<h3>New wall</h3><p class="sub">One wall for one event: a trip, a festival, a season, a collection.</p><form><input placeholder="e.g. Goa with college friends" autocomplete="off"><div class="themes">${Object.entries(THEMES).map(([k, t]) => `<button type="button" class="th ${t.g}${k === theme ? ' on' : ''}" data-th="${k}" aria-pressed="${k === theme}">${t.name}</button>`).join('')}</div><div class="foot"><button type="button" class="wb" data-no>Cancel</button><button class="wb dark">Create</button></div></form>`, 'small');
    const i = q('input', m); setTimeout(() => i.focus(), 30);
    qa('[data-th]', m).forEach(t => t.onclick = () => { theme = t.dataset.th; qa('[data-th]', m).forEach(x => { x.classList.toggle('on', x === t); x.setAttribute('aria-pressed', x === t); }); i.focus(); });
    q('[data-no]', m).onclick = () => b.remove();
    q('form', m).onsubmit = e => { e.preventDefault(); const n = i.value.trim(); if (!n) return i.focus(); const id = uid('w'); D.walls.push({ id, name: n, theme, parent: null, items: [] }); D.cur = id; save(); b.remove(); render(); toast(`${n} is up. Add your first photo.`); };
  }
  function addMenu(anchor) {
    closeMenus();
    // each row shows a tiny version of the thing itself, in this wall's own picture
    const w = wall(), img = `<img src="${src({ art: THEMES[w.theme].art })}" alt="">`;
    const d = KIT[{ trip: 'pottery', festival: 'diyas', sport: 'ball', hobby: 'cars', everyday: 'pens' }[w.theme]] || KIT.pottery, s = Math.min(40 / d.w, 36 / d.h);
    const thumb = {
      photo: `<span class="mp">${img}</span>`,
      postcard: `<span class="mc">${img}</span>`,
      note: '<span class="mt"></span>',
      place: `<span class="mp s1">${img}</span><span class="mp s2">${img}</span>`,
      object: `<svg width="${Math.round(d.w * s)}" height="${Math.round(d.h * s)}" viewBox="0 0 ${d.w} ${d.h}" overflow="visible">${d.draw()}</svg>`,
    };
    const m = document.createElement('div'); m.className = 'wmenu add';
    m.innerHTML = [['photo', 'Photo', 'From your computer'], ['postcard', 'Postcard', 'A picture with a note on the back'], ['note', 'Paper tag', 'A few words'], ['place', 'Place', 'Opens its own wall, like a city on a trip'], ['object', 'Something to hang', 'Baskets, shelves, souvenirs, toys']].map(([k, n, t]) => `<button data-add="${k}"><span class="at" aria-hidden="true">${thumb[k]}</span><span class="nm"><b>${n}</b><small>${t}</small></span></button>`).join('');
    el.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.left = Math.min(r.right - 270, innerWidth - 280) + 'px'; m.style.top = r.bottom + 8 + 'px';
    m.onclick = e => { const b = e.target.closest('[data-add]'); if (b) add(b.dataset.add); };
  }

  // ---------- mounting into the Wall page ----------
  const desk = () => `<svg class="dplant" width="70" height="84" viewBox="0 0 70 84" aria-hidden="true"><ellipse cx="35" cy="80" rx="22" ry="3.5" fill="#000" opacity=".22"/>${PROPS.succulent(35, 48)}</svg><svg class="mug" width="92" height="96" viewBox="0 0 92 96" aria-hidden="true"><path d="M30 26q-7-9 0-17q6-8-1-16M44 24q-7-9 0-17q6-8-1-16" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" fill="none" stroke-linecap="round" class="steam" transform="translate(0 6)"/><ellipse cx="38" cy="90" rx="34" ry="5" fill="#000" opacity=".22"/><path d="M64 46q18 0 18 14t-18 14" stroke="#EDE8DE" stroke-width="7" fill="none"/><path d="M10 34h56v40q0 16-16 16H26q-16 0-16-16z" fill="#F3EFE7"/><path d="M10 52h56v8H10z" fill="#E5484D"/><path d="M14 40q2 30 10 44" stroke="#fff" stroke-width="5" fill="none" opacity=".55" stroke-linecap="round"/><path d="M50 36v48" stroke="#000" stroke-width="10" opacity=".05"/><ellipse cx="38" cy="34" rx="28" ry="6" fill="#E2DCCF"/><ellipse cx="38" cy="35" rx="23" ry="4" fill="#5B3A22"/></svg>`;
  function mount(host) {
    el = host;
    el.innerHTML = `<div class="room"></div><div class="sun" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <svg class="fg" viewBox="0 0 300 600" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => PROPS.leaf(60 + (i % 3) * 50, 60 + i * 60, -40 + (i % 4) * 30, 2.6 - (i % 3) * .4, i)).join('')}</svg>
      <div class="stage"><div class="panel"></div></div>
      <div class="desk" aria-hidden="true">${desk()}</div>
      <div class="wtop"><div class="crumbs"></div><div class="acts"><button class="wb glass" data-lights title="Fairy lights"><i></i><span>Lights on</span></button><button class="wb glass dark" data-addm>+ Add</button></div></div>`;
    el.addEventListener('click', e => {
      const pick = e.target.closest('[data-pick]'), g = e.target.closest('.wtop [data-go]');
      if (pick) { if (q('.wmenu.pick', el)) closeMenus(); else pickMenu(pick); return; }
      if (g) { go(g.dataset.go); return; }
      if (e.target.closest('[data-lights]')) { D.mode = D.mode === 'evening' ? 'day' : 'evening'; save(); render(); return; }
      if (e.target.closest('[data-addm]')) { if (q('.wmenu.add', el)) closeMenus(); else addMenu(e.target.closest('[data-addm]')); return; }
    });
    el.addEventListener('pointerdown', e => { if (!e.target.closest('.wmenu, [data-pick], [data-addm]')) closeMenus(); });
    bindPan();
    render();
  }
  addEventListener('resize', () => { if (el && document.contains(el)) fit(); });
  window.WALL = { mount, data: () => D, go, add, addProp, THEMES, KIT, snapY, wire: { G, O }, reset: () => { D = seed(); save(); render(); } };
})();

// the Wall page in the app (app/app.js)
P.wall = () => '<main class="wallscene" id="wallscene"></main>';
P.wall.bind = root => WALL.mount($('#wallscene', root));
