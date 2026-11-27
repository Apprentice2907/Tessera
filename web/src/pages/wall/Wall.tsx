// Tessera · Memory wall: one wire-grid wall per event (a trip, a festival, a season, a collection). Photos clipped on,
// postcards and paper tags, places that open their own wall, and real things hung on the wires with S-hooks,
// baskets and shelves. Drag anything and it snaps onto the nearest wire, with a little swing.
//   The wall is drawn at 1690 × 850 and scaled to fit the window; on a tall, narrow screen (a phone) it fills the
//   height instead and you slide along it. The fixed parts (grid, lights, spotlights) are SVG strings from scene.ts;
//   the things on the wall, the menus and the dialogs are React.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { reducedMotion, toast } from '../../store/ui';
import { KIT } from './kit';
import { back, desk, grid, leaves, lights } from './scene';
import {
  PH, PW, addItem, addPlace, artSrc, childOf, clamp, count, curWall, data, deleteWall, dims, drawOf, go, kit, lean,
  moveItem, nextZ, pics, renameWall, root, snapY, src, th, today, toggleLights, trail, uid, useWalls, wallOf,
  type Item, type WallData, type WallRec,
} from './store';
import { Dialogs, css, lines, pickFiles, readPhoto, str, type Dlg, type OpenDlg } from './dialogs';

// how the wall sits in the window; kept between visits, like the classic page
let scale = 1, panX: number | null = null;
function fit(el: HTMLElement | null, st: HTMLElement | null) {
  if (!el || !st) return;
  const top = 76, bottom = 104, aw = innerWidth - 40, ah = innerHeight - top - bottom;
  const tallNarrow = innerWidth < 720 && innerHeight > innerWidth;
  scale = tallNarrow ? Math.min(ah / (PH + 40), .62) : Math.min(aw / (PW + 60), ah / (PH + 40));
  const w = PW * scale, room = innerWidth - w, pans = room < 32;
  if (pans) panX = clamp(panX ?? (room / 2), room - 16, 16); else panX = null;
  el.classList.toggle('pannable', pans);
  st.style.transform = `translate(${pans ? panX : room / 2}px, ${top + (ah - PH * scale) / 2 + 8 * scale}px) scale(${scale})`;
}
// a little swing when something is let go on a wire
function swing(n: Element | null | undefined) {
  if (!n) return;
  n.classList.remove('swing'); void (n as HTMLElement).offsetWidth; n.classList.add('swing');
  setTimeout(() => n.classList.remove('swing'), 1200);
}
let fg = '', deskArt = '';

// ---------- small drawn parts ----------
const Peg = () => (
  <svg className="clip peg" width="20" height="54" viewBox="0 0 20 54" aria-hidden="true">
    <rect x="2" y="0" width="7" height="54" rx="2" fill="#D9B98A" /><rect x="11" y="0" width="7" height="54" rx="2" fill="#CDAA78" />
    <rect x="2" y="0" width="16" height="54" rx="2" fill="none" stroke="#A88355" strokeWidth=".8" /><circle cx="10" cy="20" r="5" fill="none" stroke="#9aa0a8" strokeWidth="2" />
  </svg>
);
const Binder = () => (
  <svg className="clip binder" width="36" height="40" viewBox="0 0 36 40" aria-hidden="true">
    <path d="M11 18C9 4 27 4 25 18" stroke="#cfd3d8" strokeWidth="2.4" fill="none" /><path d="M6 18h24l-3 18H9z" fill="#141414" /><path d="M6 18h24l-1 4H7z" fill="#3a3a3a" />
  </svg>
);
const Clip = ({ it, theme }: { it: Item; theme: string }) => ((it.clip || th(theme).clip) === 'peg' ? <Peg /> : <Binder />);
const icon = (d: string) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const PEN = icon('M9.6 2.4l2 2L5 11l-2.7.7L3 9z'), BIN = icon('M2.5 4h9M5.5 4V2.5h3V4M3.8 4l.6 7.5h5.2l.6-7.5');
const dot = (s: string) => (/[.!?…]$/.test(s) ? s : s + '.');
const memories = (n: number) => (n ? `${n} memor${n === 1 ? 'y' : 'ies'}` : 'Nothing up yet');
const isPic = (it: Item) => it.kind === 'photo' || it.kind === 'postcard';

// ---------- one thing on the wall: drag it (it snaps onto a wire when let go), click or Enter opens it ----------
function WallItem({ it, D, w, open }: { it: Item; D: WallData; w: WallRec; open: (it: Item) => void }) {
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const n = e.currentTarget, w0 = curWall(data()), cur = w0.items.find(x => x.id === it.id); if (!cur) return;
    const sx = e.clientX, sy = e.clientY, x0 = cur.x, y0 = cur.y, { w: iw, h: ih } = dims(cur);
    let moved = false, x = x0, y = y0, z = cur.z;
    try { n.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
    const top = Math.max(...w0.items.map(o => o.z || 0));
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      if (!moved) { moved = true; n.classList.add('lift'); z = top + 1; n.style.zIndex = String(z); }
      x = Math.round(clamp(x0 + (ev.clientX - sx) / scale, -iw * .3, PW - iw * .7));
      y = Math.round(clamp(y0 + (ev.clientY - sy) / scale, -60, PH - ih * .5));
      n.style.left = x + 'px'; n.style.top = y + 'px';
    };
    const up = () => {
      n.removeEventListener('pointermove', mv); n.removeEventListener('pointerup', up); n.removeEventListener('pointercancel', up);
      n.classList.remove('lift');
      if (!moved) { open(cur); return; }
      y = snapY(cur, y); n.style.top = y + 'px'; swing(n);
      moveItem(w0.id, cur.id, x, y, z);
    };
    n.addEventListener('pointermove', mv); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const cur = curWall(data()).items.find(x => x.id === it.id); if (cur) open(cur);
  };
  const shell = (label: string, children: ReactNode, oy?: number) => (
    <div className={`wi k-${it.kind}`} data-id={it.id} tabIndex={0} role="button" aria-label={label} onPointerDown={down} onKeyDown={key}
      style={css({ left: it.x, top: it.y, '--r': `${it.r || 0}deg`, zIndex: it.z || 1, ...(oy != null ? { '--oy': `${oy}px` } : {}) })}>
      {children}
    </div>
  );
  if (it.kind === 'prop') {
    const d = kit(it.prop); if (!d) return null;
    return shell(str(it.title || d.name),
      <svg width={d.w} height={d.h} viewBox={`0 0 ${d.w} ${d.h}`} overflow="visible" aria-hidden="true" dangerouslySetInnerHTML={{ __html: drawOf(it.prop!) }} />, d.hy);
  }
  if (it.kind === 'photo') return shell(str(it.title), (
    <>
      <div className="print"><div className="ph"><img src={src(it)} alt="" draggable={false} /></div><div className="cap">{str(it.title)}</div>{it.date ? <div className="dt">{str(it.date)}</div> : null}</div>
      <Clip it={it} theme={w.theme} />
    </>
  ));
  if (it.kind === 'postcard') return shell(`Postcard from ${str(it.place)}`, (
    <>
      <div className="post"><img src={src(it)} alt="" draggable={false} /><div className="greet"><small>Greetings from</small><b>{str(it.place)}</b></div><span className="pstamp" /></div>
      <span className="c1"><Clip it={it} theme={w.theme} /></span><span className="c2"><Clip it={it} theme={w.theme} /></span>
    </>
  ));
  if (it.kind === 'note') return shell('Note', (
    <>
      <svg className="string" width="60" height="40" viewBox="0 0 60 40" aria-hidden="true"><path d="M30 2C18 10 14 24 30 38M30 2C42 10 46 24 30 38" stroke="#9b7b55" strokeWidth="1.6" fill="none" /></svg>
      <div className="tag"><i /><p>{lines(str(it.text))}</p></div>
    </>
  ));
  if (it.kind === 'place') {
    // a stack of the place's own prints, and its name tag
    const child = childOf(D, it), name = child ? child.name : '?', own = (child?.items || []).filter(isPic).slice(0, 3);
    const n = count(D, child || { items: [] });
    return shell(`Open ${name}`, (
      <>
        <div className="stack">
          {(own.length ? own : [{ art: th(child?.theme).art }]).map((p, i) => (
            <div key={i} className="mini" style={css({ '--r2': `${[-7, 5, -1][i]}deg`, '--dx': `${[-14, 12, 0][i]}px` })}><img src={src(p)} alt="" draggable={false} /></div>
          ))}
        </div>
        <div className="ptag"><b>{name}</b><small>{`${n} memor${n === 1 ? 'y' : 'ies'} ›`}</small></div>
        <Clip it={it} theme={w.theme} />
      </>
    ));
  }
  return null;
}

// ---------- which wall: a small bento of your walls, each tile in its own ground with a few of its prints peeking up ----------
type Menu = { t: 'pick' | 'add'; anchor: HTMLElement };
const TILT = ['6deg', '-5deg', '3deg'];
const menuOut = () => (reducedMotion() ? undefined : { opacity: 0, transition: { duration: 0.1 } });

function PickTile({ D, w, on, goTo, rename, close }: { D: WallData; w: WallRec; on: boolean; goTo: (id: string) => void; rename: (w: WallRec) => void; close: () => void }) {
  const [sure, setSure] = useState(false);
  const n = count(D, w), mem = memories(n);
  const del = () => {
    if (D.walls.filter(x => !x.parent).length < 2) { toast('Keep at least one wall'); return; }
    if (!sure) { setSure(true); return; }
    deleteWall(w.id); close(); toast(`Deleted ${w.name}`);
  };
  return (
    <div className={`wt ${th(w.theme).g}${on ? ' on' : ''}`} data-open={w.id} tabIndex={0} role="button" aria-label={`${w.name}, ${mem}${on ? ', showing now' : ''}`} onClick={() => goTo(w.id)}>
      <p className="wc"><b>{dot(w.name)}</b><span>{mem}</span></p>
      {pics(D, w).map((s, i) => <span key={i} className="wp" style={css({ '--i': String(i), '--r': TILT[i] })}><img src={s} alt="" draggable={false} /></span>)}
      {on ? <span className="label">Showing</span> : null}
      <span className="wa">
        <button className="ico" data-ren={w.id} title="Rename" aria-label={`Rename ${w.name}`} onClick={e => { e.stopPropagation(); rename(w); }}>{PEN}</button>
        <button className={'ico' + (sure ? ' sure' : '')} data-delw={w.id} title="Delete" aria-label={`Delete ${w.name}`} onClick={e => { e.stopPropagation(); del(); }}>{sure ? 'Delete?' : BIN}</button>
      </span>
    </div>
  );
}
function PickMenu({ D, anchor, goTo, rename, fresh, close }: { D: WallData; anchor: HTMLElement; goTo: (id: string) => void; rename: (w: WallRec) => void; fresh: () => void; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const m = ref.current!, r = anchor.getBoundingClientRect();
    m.style.left = Math.max(12, Math.min(r.left, innerWidth - m.offsetWidth - 12)) + 'px'; m.style.top = r.bottom + 8 + 'px';
  }, [anchor]);
  const cur = root(D, curWall(D)).id;
  const keys = (e: React.KeyboardEvent) => {
    const id = (e.target as HTMLElement).dataset?.open;
    if ((e.key === 'Enter' || e.key === ' ') && id) { e.preventDefault(); goTo(id); }
  };
  return (
    <motion.div className="wmenu pick" ref={ref} onKeyDown={keys} exit={menuOut()}>
      {D.walls.filter(w => !w.parent).map(w => <PickTile key={w.id} D={D} w={w} on={cur === w.id} goTo={goTo} rename={rename} close={close} />)}
      <button className="wt g-dots wnew" data-new="" onClick={fresh}><p className="wc"><b>New wall.</b><span>For a trip, a festival, a season.</span></p><span className="plus" aria-hidden="true">+</span></button>
    </motion.div>
  );
}

// ---------- add: each row shows a tiny version of the thing itself, in this wall's own picture ----------
const ROWS = [['photo', 'Photo', 'From your computer'], ['postcard', 'Postcard', 'A picture with a note on the back'], ['note', 'Paper tag', 'A few words'], ['place', 'Place', 'Opens its own wall, like a city on a trip'], ['object', 'Something to hang', 'Baskets, shelves, souvenirs, toys']] as const;
type AddKind = typeof ROWS[number][0];
const SAMPLE: Record<string, string> = { trip: 'pottery', festival: 'diyas', sport: 'ball', hobby: 'cars', everyday: 'pens' };
function AddMenu({ w, anchor, add }: { w: WallRec; anchor: HTMLElement; add: (k: AddKind) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const m = ref.current!, r = anchor.getBoundingClientRect();
    m.style.left = Math.min(r.right - 270, innerWidth - 280) + 'px'; m.style.top = r.bottom + 8 + 'px';
  }, [anchor]);
  const img = <img src={artSrc(th(w.theme).art)} alt="" />;
  const k = kit(SAMPLE[w.theme]) ? SAMPLE[w.theme] : 'pottery', d = KIT[k], s = Math.min(40 / d.w, 36 / d.h);
  const thumb: Record<AddKind, ReactNode> = {
    photo: <span className="mp">{img}</span>,
    postcard: <span className="mc">{img}</span>,
    note: <span className="mt" />,
    place: <><span className="mp s1">{img}</span><span className="mp s2">{img}</span></>,
    object: <svg width={Math.round(d.w * s)} height={Math.round(d.h * s)} viewBox={`0 0 ${d.w} ${d.h}`} overflow="visible" dangerouslySetInnerHTML={{ __html: drawOf(k) }} />,
  };
  return (
    <motion.div className="wmenu add" ref={ref} exit={menuOut()}>
      {ROWS.map(([key, n, t]) => (
        <button key={key} data-add={key} onClick={() => add(key)}><span className="at" aria-hidden="true">{thumb[key]}</span><span className="nm"><b>{n}</b><small>{t}</small></span></button>
      ))}
    </motion.div>
  );
}

// ---------- the page ----------
export function Wall() {
  const D = useWalls(s => s.D);
  const w = curWall(D), t = th(w.theme);
  const el = useRef<HTMLElement>(null), stage = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [dlg, setDlg] = useState<OpenDlg | null>(null);
  const seq = useRef(0);
  const show = (d: Dlg) => setDlg({ ...d, k: ++seq.current });
  const closeMenus = () => setMenu(null);
  const goTo = (id: string) => { if (go(id)) closeMenus(); };

  // the wall fits the window, and again whenever the window changes
  useLayoutEffect(() => {
    const f = () => fit(el.current, stage.current);
    f(); addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);
  // a press outside the menus closes them; on a phone, dragging the wall's empty parts (or scrolling) slides it.
  // Native listeners on the scene, so the dialogs (on document.body) never reach them.
  useEffect(() => {
    const host = el.current!;
    const down = (e: PointerEvent) => {
      const tg = e.target as Element;
      if (!tg.closest('.wmenu, [data-pick], [data-addm]')) setMenu(null);
      if (!host.classList.contains('pannable') || e.button > 0 || tg.closest('.wi, .wtop, .wmenu, .wv-back, button, a, input')) return;
      const x0 = e.clientX, p0 = panX ?? 0; let moved = false;
      const mv = (ev: PointerEvent) => { const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 4) return; moved = true; panX = p0 + dx; fit(host, stage.current); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    };
    const wheel = (e: WheelEvent) => {
      if (!host.classList.contains('pannable') || (e.target as Element).closest('.wmenu, .wv-back')) return;
      e.preventDefault(); panX = (panX ?? 0) - (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY); fit(host, stage.current);
    };
    host.addEventListener('pointerdown', down); host.addEventListener('wheel', wheel, { passive: false });
    return () => { host.removeEventListener('pointerdown', down); host.removeEventListener('wheel', wheel); };
  }, []);
  // Escape closes a menu and puts you back on its button
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(null); menu.anchor.focus(); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [menu]);

  const open = (it: Item) => {
    if (it.kind === 'place') { if (it.wall) goTo(it.wall); return; }
    show({ t: 'view', wall: curWall(data()).id, id: it.id, fresh: false });
  };
  async function add(kind: AddKind) {
    closeMenus();
    const wid = w.id;
    if (kind === 'object') { show({ t: 'gallery', wall: wid }); return; }
    if (kind === 'photo') {
      const files = (await pickFiles(true)).filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      let first: string | null = null;
      for (const f of files) {
        const s = await readPhoto(f); if (!s) continue;
        const id = addItem(wid, x => ({ id: uid('p'), kind: 'photo', r: lean(), z: nextZ(x), src: s, title: f.name.replace(/\.[^.]+$/, '').slice(0, 40), date: today(), text: '' }));
        first = first || id;
      }
      if (first) show({ t: 'view', wall: wid, id: first, fresh: true });
      return;
    }
    if (kind === 'postcard' || kind === 'note') {
      const id = kind === 'postcard'
        ? addItem(wid, x => ({ id: uid('c'), kind: 'postcard', r: lean(), z: nextZ(x), art: th(x.theme).art, place: x.name, date: today(), text: '' }))
        : addItem(wid, x => ({ id: uid('n'), kind: 'note', r: lean(), z: nextZ(x), text: '' }));
      if (id) show({ t: 'view', wall: wid, id, fresh: true });
      return;
    }
    show({ t: 'ask', title: 'A place on this wall', sub: 'It gets its own wall, with its own photos.', ph: 'e.g. Jodhpur', ok: 'Add place',
      done: name => { addPlace(wid, name); toast(`Added ${name}. Click it to fill it.`); } });
  }
  // something from the gallery goes up on the wall it was opened on, with a swing
  const hang = (wid: string, key: string) => {
    const d = kit(key); if (!d) return;
    const id = addItem(wid, x => ({ id: uid('o'), kind: 'prop', prop: key, r: 0, z: nextZ(x) }));
    if (id) requestAnimationFrame(() => swing(el.current?.querySelector(`.wi[data-id="${CSS.escape(id)}"]`)));
    toast(`${d.name} is up. Drag it onto any wire.`);
  };
  const rename = (x: WallRec) => {
    closeMenus();
    show({ t: 'ask', title: 'Rename wall', sub: x.name, ph: x.name, ok: 'Rename', done: n => renameWall(x.id, n) });
  };
  const toggle = (kind: Menu['t']) => (e: React.MouseEvent<HTMLButtonElement>) => setMenu(menu?.t === kind ? null : { t: kind, anchor: e.currentTarget });

  const r = root(D, w), tr = trail(D, w);
  const backArt = useMemo(() => back(w.theme), [w.theme]);
  const box = { viewBox: `0 0 ${PW} ${PH}`, width: PW, height: PH, overflow: 'visible', 'aria-hidden': true } as const;
  return (
    <main className="wallscene" ref={el} data-mode={D.mode} data-theme={w.theme} data-grid={t.grid}>
      <div className="room" />
      <div className="sun" aria-hidden="true"><i /><i /><i /><i /></div>
      <svg className="fg" viewBox="0 0 300 600" aria-hidden="true" dangerouslySetInnerHTML={{ __html: (fg ||= leaves()) }} />
      <div className="stage" ref={stage}>
        <div className="panel">
          <svg className="grid" {...box} dangerouslySetInnerHTML={{ __html: grid(t.grid) }} />
          <svg className="props back" {...box} dangerouslySetInnerHTML={{ __html: backArt }} />
          <svg className="lights" {...box} dangerouslySetInnerHTML={{ __html: lights() }} />
          <div className="items">{w.items.map(it => <WallItem key={it.id} it={it} D={D} w={w} open={open} />)}</div>
          {w.items.length ? null : <div className="empty"><b>An empty wall.</b><span>Add a photo, a postcard, a place or something to hang.</span></div>}
        </div>
      </div>
      <div className="desk" aria-hidden="true" dangerouslySetInnerHTML={{ __html: (deskArt ||= desk()) }} />
      <div className="wtop">
        <div className="crumbs">
          <button className="wpick" data-pick="" aria-haspopup="true" onClick={toggle('pick')}>
            <b>{r.name}</b>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 4.5 6 7.5l3-3" /></svg>
          </button>
          {tr.slice(1).map((x, i) => (
            <Fragment key={x.id}><span className="sl">/</span><button className={'crumb' + (i === tr.length - 2 ? ' on' : '')} data-go={x.id} onClick={() => goTo(x.id)}>{x.name}</button></Fragment>
          ))}
          {w.parent ? <button className="back" data-go={w.parent} title={`Back to ${wallOf(D, w.parent)?.name ?? ''}`} onClick={() => goTo(w.parent!)}>← Back</button> : null}
        </div>
        <div className="acts">
          <button className={'wb glass' + (D.mode === 'evening' ? ' on' : '')} data-lights="" title="Fairy lights" onClick={toggleLights}><i /><span>{D.mode === 'evening' ? 'Lights on' : 'Lights off'}</span></button>
          <button className="wb glass dark" data-addm="" onClick={toggle('add')}>+ Add</button>
        </div>
      </div>
      <AnimatePresence>
        {menu?.t === 'pick' && <PickMenu key="pick" D={D} anchor={menu.anchor} goTo={goTo} rename={rename} close={closeMenus} fresh={() => { closeMenus(); show({ t: 'new' }); }} />}
        {menu?.t === 'add' && <AddMenu key="add" w={w} anchor={menu.anchor} add={add} />}
      </AnimatePresence>
      <Dialogs dlg={dlg} close={k => setDlg(cur => (cur?.k === k ? null : cur))} hang={hang} />
    </main>
  );
}
