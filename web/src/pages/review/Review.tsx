// Tessera · Review: the archive. Your folders, each a stack of files, newest at the front:
//   a monthly folder opens a file for every month and fills it in from one Hours category;
//   a projects folder holds a file per project, with its plan, its notes and a page a week.
// Folder → files → documents, every level a bento grid. Moving between levels morphs: the folder you open becomes the
// cover of the next level, the file you open becomes its header (Motion shared layout); the rest slides in after it.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion, type TargetAndTransition } from 'motion/react';
import { useData, update } from '../../store/data';
import { clock, useClock } from '../../store/clock';
import { closePop, openPop, toast } from '../../store/ui';
import { newProject, toggleCatDay } from '../../store/rules';
import { FOLDER_LOOKS, catHours, catOf, folderById, lookOf, monthNoteOf, projectsIn, streak } from '../../lib/data';
import { DAY_NAMES, MON3, MONTHS, dateOf, dayIdx, fromKey, keyOf, monthKey, monthLabel, plural, shortDate, weekStart } from '../../lib/dates';
import type { Archive, Folder, Project, Saved } from '../../lib/types';
import { EASE } from '../../ui/motion';
import { CountUp } from '../../ui/CountUp';
import { PopTop } from '../../ui/Pop';
import { openDataCard } from '../../ui/DataCard';
import { Arrow, Bin, Pencil, Tick } from '../../ui/icons';

const TICKSVG = <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5 L5.8 10.5 L11.5 3.8" /></svg>;
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const mark = (s: string) => (/[.!?…]$/.test(s) ? s : s + '.');
// during a morph the box stretches; what's written in it only moves (layout="position"), so words never squash
const MORPH = { layout: { duration: 0.5, ease: EASE } };
const BOX = { layout: true, transition: MORPH } as const;
const POS = { layout: 'position', transition: MORPH } as const;
const LIFT = { lift: { y: -3, transition: { duration: 0.3, ease: EASE } } };
const FLAP = { lift: { rotateX: -11, boxShadow: '0 -20px 34px -18px rgba(0, 0, 0, .55)', transition: { duration: 0.5, ease: EASE } } };
const Copy = ({ b, s }: { b: string; s?: ReactNode }) => <motion.div className="copy" {...POS}><b>{mark(b)}</b> <span>{s}</span></motion.div>;
const Ck = ({ on = true }: { on?: boolean }) => <span className={'ck' + (on ? '' : ' no')}>{on ? TICKSVG : null}</span>;
const href = (id: string) => (id === 'root' ? '#/review' : '#/review/' + id);
const Back = ({ id, label }: { id: string; label: string }) => <motion.a className="rv-back" href={href(id)} {...POS}><Arrow />{label}</motion.a>;
const vt = (id: string) => 'rv-' + id;

// how things arrive: tiles rise in order, files slide out of the folder they came from, a new file drops in at the front
type Anim = { initial: TargetAndTransition; animate: TargetAndTransition };
const rvIn = (ms: number): Anim => ({ initial: { opacity: 0, y: 16, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE, delay: ms / 1000 } } });
const rvPull = (ms: number): Anim => ({ initial: { opacity: 0, x: -48, rotate: -1.5 }, animate: { opacity: 1, x: 0, rotate: 0, transition: { duration: 0.6, ease: EASE, delay: ms / 1000 } } });
const rvFresh: Anim = { initial: { opacity: 0, y: -28, scale: 0.94 }, animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE } } };
const still: Anim = { initial: {}, animate: {} };

// ---------- dates ----------
const niceDate = (s: string) => { const D = dayIdx(fromKey(s)), T = clock().T; return D === T ? 'today' : D === T - 1 ? 'yesterday' : shortDate(D); };
const thisMonth = () => monthKey(clock().today);
const monthDays = (ym: string) => { const [y, m] = ym.split('-').map(Number), first = dayIdx(new Date(y, m - 1, 1)); return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => first + i); };
const monthName = (ym: string) => MONTHS[+ym.slice(5) - 1];
// every month from the one a folder was made in up to this one, newest first
function monthsOf(f: Folder) {
  const out: string[] = []; let [y, m] = f.created.split('-').map(Number);
  const today = clock().today, ty = today.getFullYear(), tm = today.getMonth() + 1;
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
  return out.reverse();
}

// ---------- what is where ----------
// #/review → the archive; #/review/<folder id> → a folder; #/review/<file id> → a project ('p…') or a month ('<folder id>@YYYY-MM')
type Level = { kind: 'root'; id: 'root' } | { kind: 'folder'; id: string; f: Folder } | { kind: 'project'; id: string; p: Project; f: Folder } | { kind: 'month'; id: string; f: Folder; ym: string };
function levelOf(a: Archive, id: string): Level {
  const f = folderById(a, id); if (f) return { kind: 'folder', id, f };
  const p = a.projects[id]; if (p && folderById(a, p.folder)) return { kind: 'project', id, p, f: folderById(a, p.folder)! };
  const m = /^(.+)@(\d{4}-\d{2})$/.exec(id), mf = m && folderById(a, m[1]);
  if (m && mf && mf.kind === 'month' && monthsOf(mf).includes(m[2])) return { kind: 'month', id, f: mf, ym: m[2] };
  return { kind: 'root', id: 'root' };
}
const tabOf = (f: Folder) => f.name.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X') + '-' + f.created.slice(2, 4);
const catName = (d: Saved, f: Folder) => catOf(d, f.cat)?.name || 'a deleted category';
type File = { id: string; ym: string; name: string; p?: undefined } | { id: string; p: Project; name: string; ym?: undefined };
const filesOf = (a: Archive, f: Folder): File[] => (f.kind === 'month'
  ? monthsOf(f).map(ym => ({ id: `${f.id}@${ym}`, ym, name: monthName(ym) }))
  : projectsIn(a, f).sort((x, y) => (x.created === y.created ? (x.id < y.id ? 1 : -1) : x.created < y.created ? 1 : -1)).map(p => ({ id: p.id, p, name: p.name })));
const lastUpdate = (ps: Project[]) => ps.reduce((m, p) => p.entries.reduce((n, e) => (e[0] > n ? e[0] : n), m), '');

// a month of one category: days so far, days with any hours, the hours, the longest run of days in a row
function monthStats(d: Saved, f: Folder, ym: string) {
  const T = clock().T, all = monthDays(ym), days = all.filter(D => D <= T), hrs = days.map(D => catHours(d, f.cat, D));
  let run = 0, best = 0; hrs.forEach(h => { run = h ? run + 1 : 0; best = Math.max(best, run); });
  return { days: days.length, total: all.length, active: hrs.filter(Boolean).length, hours: hrs.reduce((a, b) => a + b, 0), best, live: ym === thisMonth() };
}
// the lines a folder shows about itself
function facts(d: Saved, f: Folder) {
  if (f.kind === 'month') {
    const st = monthStats(d, f, thisMonth()), ms = monthsOf(f), run = streak(D => catHours(d, f.cat, D) > 0, clock().T);
    return {
      sub: `${catName(d, f)} hours, a file a month.`,
      lines: [`${plural(ms.length, 'file')} since ${monthLabel(ms[ms.length - 1])}`, `${st.active} of ${st.days} days this month`, `${st.hours} h this month`],
      label: `${run}-day streak`, big: [String(st.hours), 'h', `${monthName(thisMonth())} so far`], ev: ['Days', `${st.active} of ${st.days}`],
    };
  }
  const ps = projectsIn(d.archive, f), active = ps.filter(p => p.status === 'ACTIVE').length, last = lastUpdate(ps);
  return {
    sub: ps.length ? `${WORDS[ps.length] || ps.length} ${ps.length === 1 ? 'project' : 'projects'}.` : 'No projects yet.',
    lines: ps.length ? filesOf(d.archive, f).slice(0, 3).map(x => x.name) : ['Start one inside', 'or log an update from Today'],
    label: `${active} active`, big: [String(active), '/' + ps.length, 'Active'], ev: ['Last update', last ? niceDate(last) : 'None yet'],
  };
}

// ---------- days of a month, as squares lit by hours ----------
function Cal({ d, f, ym, cls, labels, stampable }: { d: Saved; f: Folder; ym: string; cls: string; labels?: boolean; stampable?: boolean }) {
  const L = lookOf(f), days = monthDays(ym), lead = (((days[0] % 7) + 7) % 7), T = clock().T;
  const stamp = (D: number) => {
    const on = update(dr => toggleCatDay(dr, f.cat!, D));
    toast(on ? `Added an hour of ${catName(d, f)} to ${shortDate(D)}, in Hours too` : `Cleared ${catName(d, f)} from ${shortDate(D)}`);
  };
  return (
    <motion.div className={'cal ' + cls} {...POS} style={{ ['--a1' as string]: L.a[0], ['--a2' as string]: L.a[1], ['--a3' as string]: L.a[2], ['--a4' as string]: L.a[3] }} aria-hidden={stampable ? undefined : true}>
      {Array.from({ length: lead }, (_, i) => <i key={'x' + i} className="x" />)}
      {days.map(D => {
        if (D > T) return <i key={D} className="f" />;
        const h = catHours(d, f.cat, D), v = !h ? '' : h === 1 ? 'l1' : h === 2 ? 'l2' : h <= 4 ? 'l3' : 'l4', n = dateOf(D).getDate();
        const act = stampable ? { 'data-d': D, role: 'button', tabIndex: 0, 'aria-label': `${MON3[dateOf(D).getMonth()]} ${n}, ${h ? plural(h, 'hour') : 'nothing'}`, onClick: () => stamp(D), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stamp(D); } } } : {};
        return <i key={D} className={v} {...act}>{labels && h ? <em>{h}h</em> : null}</i>;
      })}
    </motion.div>
  );
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
function rootGrid(n: number) {
  if (n <= 5) return LAYOUTS[n];
  const rows = [...LAYOUTS[5]], rest = Array.from({ length: n - 5 }, (_, i) => 'a' + (i + 5));
  while (rest.length) { const r = rest.splice(0, 4); while (r.length < 4) r.push('n'); rows.push(r.join(' ')); }
  return rows;
}
const SIZES = ['big', 'tall', 'tall', 'wide'];

function FolderTile({ d, f, i, from }: { d: Saved; f: Folder; i: number; from: string | null }) {
  const L = lookOf(f), x = facts(d, f), files = filesOf(d.archive, f);
  const size = SIZES[i] || 'small', many = { big: 5, wide: 5, tall: 3, small: 3 }[size]!;
  const roomy = size === 'big' || size === 'tall';
  // the folder you just came out of morphs back into place; the others rise in
  const back = !!from && (from === f.id || from.startsWith(f.id + '@') || d.archive.projects[from]?.folder === f.id);
  const a = back ? still : rvIn((i + 1) * 60);
  return (
    <motion.a className={['tile fd', size, size === 'big' && 'lead'].filter(Boolean).join(' ')} href={href(f.id)} aria-label={`${f.name}: ${plural(files.length, 'file')}`}
      style={{ gridArea: 'a' + i, ['--on' as string]: L.on }} layoutId={vt(f.id)} transition={MORPH} {...a} whileHover="lift" whileFocus="lift">
      <motion.span className={'fd-back ' + L.g} {...BOX}><motion.span className="fd-tab" {...POS}>{tabOf(f)}</motion.span></motion.span>
      <span className="fd-sheets">{files.slice(0, many).map((s, k) => <span key={s.id} className="sheet" style={{ ['--k' as string]: k }}><i>{f.kind === 'month' ? s.name.slice(0, 3) : s.name.length > 10 ? s.name.split(' ')[0].slice(0, 10) : s.name}</i></span>).reverse()}</span>
      <motion.span className={'fd-front ' + L.g} {...BOX} variants={FLAP}>
        <Copy b={f.name} s={x.sub} />
        {roomy && <motion.div className="prof" {...POS}>{x.lines.map(l => <div key={l}><Ck />{l}</div>)}<span className="label">{x.label}</span></motion.div>}
        <motion.span className="stat" {...POS}>{x.big[0]}<small>{x.big[1]}</small></motion.span>
        <motion.span className="aside" {...POS}>{x.big[2]}<small>{x.ev[0]}: {x.ev[1]}</small></motion.span>
      </motion.span>
    </motion.a>
  );
}
function Root({ d, from }: { d: Saved; from: string | null }) {
  const fs = d.archive.folders, grid = rootGrid(fs.length), hasNew = grid.some(r => r.split(' ').includes('n'));
  const newFolder = (e: React.SyntheticEvent<HTMLElement>) => { e.preventDefault(); folderPop(e.currentTarget, null); };
  return (
    <div className={'bento rv rv-root' + (grid.length > 3 ? ' long' : '')} style={{ gridTemplateAreas: grid.map(r => `'${r}'`).join(' '), ['--rows' as string]: grid.length }}>
      <motion.section className="tile g-paper rv-intro" style={{ gridArea: 'i' }} {...rvIn(0)}>
        <Copy b="The archive" s={fs.length ? 'A folder for each part of your life. Monthly ones fill themselves in from Hours.' : 'Your life, filed. Make a folder for each part of it.'} />
        <div className="rv-intro-acts"><button className="label rv-new" onClick={newFolder}>+ New folder</button><button className="label ghost" onClick={e => openDataCard(e.currentTarget)}>Backups</button></div>
      </motion.section>
      {fs.map((f, i) => <FolderTile key={f.id} d={d} f={f} i={i} from={from} />)}
      {hasNew && (
        <motion.section className="tile g-dots rv-next is-new" style={{ gridArea: 'n' }} role="button" tabIndex={0} {...rvIn((fs.length + 1) * 60)}
          onClick={newFolder} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') newFolder(e); }} whileHover={{ y: -3 }}>
          <Copy b={fs.length ? 'New folder' : 'Your first folder'} s={fs.length ? 'Another part of your life to keep.' : 'Gym, Coding, a language you’re learning: a folder fills itself in from the hours you log. Or keep your projects in one.'} /><span className="plus" aria-hidden="true">+</span>
        </motion.section>
      )}
    </div>
  );
}

// a new folder, or changing one: its name, what it is, and its colour
function FolderCard({ f }: { f: Folder | null }) {
  const d = useData.getState().d, go = useNavigate();
  const used = d.archive.folders.map(x => x.ground);
  const [kind, setKind] = useState<'month' | 'projects'>(f ? f.kind : 'month');
  const [cat, setCat] = useState<string | undefined>(f ? f.cat : d.cats[0]?.id);
  const [ground, setGround] = useState(f ? f.ground : Object.keys(FOLDER_LOOKS).find(g => !used.includes(g)) || 'green');
  const [name, setName] = useState(f ? f.name : ''), touched = useRef(!!f), input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  // a name that matches a category picks it ("Gym" fills in from Gym), until you pick one yourself
  const typed = (v: string) => {
    setName(v);
    if (touched.current) return;
    const s = v.trim().toLowerCase(), c = s && d.cats.find(x => x.name.toLowerCase().startsWith(s) || s.startsWith(x.name.toLowerCase()));
    if (c) setCat(c.id);
  };
  const make = () => {
    const v = name.trim().replace(/\s+/g, ' ');
    if (!v) return input.current?.focus();
    if (kind === 'month' && !catOf(useData.getState().d, cat)) return toast('Pick the hours it fills in from');
    if (f) {
      update(dr => { const x = dr.archive.folders.find(y => y.id === f.id); if (x) Object.assign(x, { name: v, ground }, x.kind === 'month' ? { cat } : {}); });
      closePop(); toast('Saved'); return;
    }
    const id = 'f' + Date.now().toString(36);
    update(dr => { dr.archive.folders.push({ id, name: v, ground, kind, ...(kind === 'month' ? { cat } : {}), created: keyOf(clock().T) }); });
    closePop(); go('/review/' + id);
    toast(kind === 'month' ? `${v} is open. Its first file is ${monthName(thisMonth())}` : `${v} is open. Start your first project in it`);
  };
  return <>
    <PopTop label={f ? 'Folder' : 'New folder'} />
    <input className="ptitle" id="nf-name" ref={input} value={name} onChange={e => typed(e.target.value)} placeholder="e.g. Gym, Coding, Side projects" maxLength={32} aria-label="Name" autoComplete="off" onKeyDown={e => { if (e.key === 'Enter') make(); }} />
    {!f && <><div className="plabel">Kind</div><span className="pseg"><button type="button" className={kind === 'month' ? 'on' : ''} onClick={() => setKind('month')}>A file a month</button><button type="button" className={kind === 'projects' ? 'on' : ''} onClick={() => setKind('projects')}>Projects</button></span></>}
    <div className="plabel" hidden={kind !== 'month'}>Fills in from these hours</div>
    <div className="pcats" hidden={kind !== 'month'} role="radiogroup" aria-label="Hours category">
      {d.cats.map(c => <button key={c.id} type="button" className={c.id === cat ? 'on' : ''} style={{ ['--cs' as string]: c.solid }} role="radio" aria-checked={c.id === cat} onClick={() => { setCat(c.id); touched.current = true; }}>{c.name}<i className="tick"><Tick /></i></button>)}
    </div>
    <div className="plabel">Colour</div>
    <div className="pgrounds" role="radiogroup" aria-label="Colour">
      {Object.entries(FOLDER_LOOKS).map(([k, L]) => <button key={k} type="button" className={L.g + (k === ground ? ' on' : '')} role="radio" aria-checked={k === ground} aria-label={k} onClick={() => setGround(k)} />)}
    </div>
    <div className="pfoot"><button type="button" className="pbtn" onClick={closePop}>Cancel</button><button type="button" className="pbtn dark" onClick={make}>{f ? 'Save' : 'Create'}</button></div>
  </>;
}
const folderPop = (anchor: HTMLElement, f: Folder | null) => openPop(anchor, <FolderCard f={f} />, true);

/** a delete button that asks once more (a second click within three seconds) */
function SureDelete({ label, go }: { label: string; go: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); }, [sure]);
  return <button className={'hd-ico' + (sure ? ' sure' : '')} title={sure ? 'Click again to delete' : 'Delete'} aria-label={`Delete ${label}`} onClick={() => (sure ? go() : setSure(true))}>{sure ? 'Delete?' : <Bin />}</button>;
}

// ---------- 2. a folder, opened: its cover, then its files ----------
function Cover({ d, f }: { d: Saved; f: Folder }) {
  const L = lookOf(f), x = facts(d, f), files = filesOf(d.archive, f), go = useNavigate();
  const del = () => {
    update(dr => {
      dr.archive.folders = dr.archive.folders.filter(y => y.id !== f.id);
      Object.values(dr.archive.projects).forEach(p => { if (p.folder === f.id) delete dr.archive.projects[p.id]; });
      Object.keys(dr.archive.months).forEach(k => { if (k.startsWith(f.id + '|')) delete dr.archive.months[k]; });
    });
    go('/review'); toast(`Deleted ${f.name}`);
  };
  return (
    <motion.section className="tile fd open tall" style={{ gridArea: 'cover', ['--on' as string]: L.on }} layoutId={vt(f.id)} transition={MORPH}>
      <motion.span className={'fd-back ' + L.g} {...BOX}><motion.span className="fd-tab" {...POS}>{tabOf(f)}</motion.span></motion.span>
      <motion.div className={'fd-front ' + L.g} {...BOX}>
        <Back id="root" label="Archive" />
        <motion.div className="hd-top" {...POS}><button className="hd-ico" title="Change" aria-label={`Change ${f.name}`} onClick={e => folderPop(e.currentTarget, f)}><Pencil /></button><SureDelete label={f.name} go={del} /></motion.div>
        <Copy b={f.name} s={x.sub} />
        <motion.div className="prof" {...POS}>{x.lines.map(l => <div key={l}><Ck />{l}</div>)}<span className="label">{x.label}</span></motion.div>
        <motion.div className="cv-ev" {...POS}>
          <dl><div><dt>{x.ev[0]}</dt><dd>{x.ev[1]}</dd></div><div><dt>Files</dt><dd>{files.length}{files.length ? ` · newest ${files[0].name}` : ''}</dd></div><div><dt>Opened</dt><dd>{niceDate(f.created)}</dd></div></dl>
          <span className="cv-lab">{x.big[2]}</span>
          <span className="cv-stat"><CountUp to={+x.big[0]} /><small>{x.big[1]}</small></span>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
type Pos = { s: CSSProperties; big?: boolean; tall?: boolean };
function FileTile({ d, file, f, i, pos, anim }: { d: Saved; file: File; f: Folder; i: number; pos: Pos; anim: 'fresh' | 'back' | 'pull' }) {
  const L = lookOf(f), big = !!pos.big, span = big ? 'lead' : pos.tall ? 'tall' : '';
  const a = anim === 'fresh' ? rvFresh : anim === 'back' ? still : rvPull(160 + Math.min(i, 6) * 70);
  const common = { className: `tile fl ${file.p ? 'book' : 'month'} ${big ? 'big' : ''} ${span}`, href: href(file.id), draggable: false, style: pos.s, layoutId: vt(file.id), transition: MORPH, ...a, whileHover: 'lift', whileFocus: 'lift' };
  if (file.p) {
    const p = file.p, ups = p.entries.length;
    return (
      <motion.a {...common} aria-label={`${p.name}, ${plural(ups, 'update')}`}>
        <motion.span className={'fl-tab ' + L.g} {...POS} variants={LIFT}>{tabOf(f)}</motion.span>
        <motion.span className="fl-body" {...BOX}>
          <motion.span className={'own-cover ' + L.g} aria-hidden="true" {...BOX}><motion.b {...POS}>{p.name}</motion.b></motion.span>
          <motion.span className="fl-card" {...POS}><Copy b={p.name} s={p.tagline || ''} /><span className="fl-meta"><span className={'chip ' + (p.status === 'ACTIVE' ? 'live' : '')}>{p.status === 'ACTIVE' ? 'Active' : 'Paused'}</span>{plural(ups, 'update')} · opened {niceDate(p.created)}</span></motion.span>
        </motion.span>
      </motion.a>
    );
  }
  const st = monthStats(d, f, file.ym), yr = file.ym.slice(0, 4);
  return (
    <motion.a {...common} aria-label={`${file.name} ${yr}`}>
      <motion.span className={'fl-tab ' + L.g} {...POS} variants={LIFT}>{MON3[+file.ym.slice(5) - 1].toUpperCase()} {yr.slice(2)}</motion.span>
      <motion.span className="fl-body g-white" {...BOX}>
        <Copy b={`${file.name} ${yr}`} s={st.live ? 'In progress.' : 'Closed.'} />
        <motion.span className={'chip top ' + (st.live ? 'live' : '')} {...POS}>{st.live ? 'In progress' : 'Closed'}</motion.span>
        <Cal d={d} f={f} ym={file.ym} cls={big ? 'big' : span === 'tall' ? 'mid' : 'mini'} labels={big || span === 'tall'} />
        <motion.span className="fstat" {...POS}><b>{st.active}<small>/{st.days}</small></b><span>days with {catName(d, f)}</span><small>{st.live ? `Day ${st.days} of ${st.total}` : `${st.hours} h in all`}</small></motion.span>
      </motion.span>
    </motion.a>
  );
}
// under the newest file: the next month, or a new project (the tile turns into a small form: name it, and it lands at the front)
function NewFileTile({ f, i, style, onMade }: { f: Folder; i: number; style: CSSProperties; onMade: (id: string) => void }) {
  const [asking, setAsking] = useState(false), input = useRef<HTMLInputElement>(null), T = clock().T, today = clock().today;
  useEffect(() => { if (asking) input.current?.focus(); }, [asking]);
  const a = rvPull(160 + i * 70);
  if (f.kind !== 'projects') {
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1), left = dayIdx(next) - T;
    return (
      <motion.section className="tile g-dots rv-next" style={style} {...a}>
        <Copy b={`${MONTHS[next.getMonth()]} ${next.getFullYear()}`} s="Opens on the 1st and fills itself in from Hours." /><span className="fstat"><b>{left}</b><span>{left === 1 ? 'day' : 'days'} to go</span></span>
      </motion.section>
    );
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = (input.current?.value || '').trim().replace(/\s+/g, ' ');
    if (!name) { input.current?.focus(); return; }
    const p = update(dr => newProject(dr, name, dr.archive.folders.find(x => x.id === f.id)));
    setAsking(false); onMade(p.id);
    toast(`${name} is at the front of ${f.name}`);
  };
  if (asking) return (
    <motion.section className="tile g-dots rv-next is-new asking" style={style}>
      <form className="rv-form" onSubmit={submit}>
        <Copy b="New project" s="Name it. It goes to the front of the folder." />
        <input ref={input} maxLength={40} autoComplete="off" placeholder="e.g. Portfolio site" aria-label="Name" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setAsking(false); } }} />
        <div className="rv-form-acts"><button type="button" className="hd-btn" onClick={() => setAsking(false)}>Cancel</button><button className="hd-btn dark">Create</button></div>
      </form>
    </motion.section>
  );
  return (
    <motion.section className="tile g-dots rv-next is-new" style={style} role="button" tabIndex={0} {...a} whileHover={{ y: -3 }}
      onClick={() => setAsking(true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAsking(true); } }}>
      <Copy b="New project" s="It gets its own file, with a plan and a page a week, and goes to the front." /><span className="plus" aria-hidden="true">+</span>
    </motion.section>
  );
}
// the shelf: the newest file big at the front with the next-file tile under it, then the older files three to a column.
// The last column shares its height out, so there are no holes; anything past the third column is a slide away.
function Shelf({ d, f, from }: { d: Saved; f: Folder; from: string | null }) {
  const files = filesOf(d.archive, f), old = files.slice(1), cols = Math.ceil(old.length / 3), rest = old.length % 3;
  const [fresh, setFresh] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null), [ends, setEnds] = useState({ less: false, more: false });
  const place = (i: number): Pos => {
    const col = 3 + Math.floor(i / 3), row = i % 3, last = Math.floor(i / 3) === cols - 1;
    if (last && rest === 1) return { s: { gridColumn: col, gridRow: '1 / span 3' }, tall: true };
    if (last && rest === 2) return row === 0 ? { s: { gridColumn: col, gridRow: 1 } } : { s: { gridColumn: col, gridRow: '2 / span 2' }, tall: true };
    return { s: { gridColumn: col, gridRow: row + 1 } };
  };
  const anim = (id: string) => (fresh === id ? 'fresh' : from === id ? 'back' : 'pull');
  const w = old.length ? 2 : 3;
  // the shelf slides: arrows, the mouse wheel, dragging with the mouse, or a swipe
  useLayoutEffect(() => {
    const t = track.current; if (!t) return;
    const sync = () => { const max = t.scrollWidth - t.clientWidth - 2; setEnds({ less: t.scrollLeft > 2, more: t.scrollLeft < max }); };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = t.scrollWidth - t.clientWidth;
      if (max <= 2 || (e.deltaY < 0 && t.scrollLeft <= 0) || (e.deltaY > 0 && t.scrollLeft >= max - 1)) return;
      e.preventDefault(); t.scrollLeft += e.deltaY;
    };
    let drag: { x: number; s: number; moved: boolean; id: number } | null = null;
    const down = (e: PointerEvent) => { if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest('input, button, form')) return; drag = { x: e.clientX, s: t.scrollLeft, moved: false, id: e.pointerId }; };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; t.classList.add('dragging'); try { t.setPointerCapture(drag.id); } catch { /* fine without */ } }
      if (drag.moved) t.scrollLeft = drag.s - dx;
    };
    const up = () => { t.classList.remove('dragging'); if (drag && !drag.moved) drag = null; };
    const cancel = () => { drag = null; up(); };
    const click = (e: MouseEvent) => { if (drag?.moved) { e.preventDefault(); e.stopPropagation(); } drag = null; };
    const nodrag = (e: DragEvent) => e.preventDefault();
    t.addEventListener('scroll', sync, { passive: true }); t.addEventListener('wheel', wheel, { passive: false });
    t.addEventListener('pointerdown', down); t.addEventListener('pointermove', move); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', cancel);
    t.addEventListener('click', click, true); t.addEventListener('dragstart', nodrag);
    // coming back from a file deep in the shelf: slide it into view
    const back = from && t.querySelector<HTMLElement>(`.fl[href="${href(from)}"]`);
    if (back) t.scrollLeft = Math.max(0, back.offsetLeft - step());
    sync(); requestAnimationFrame(sync);
    const ro = new ResizeObserver(sync); ro.observe(t);
    return () => {
      ro.disconnect(); t.removeEventListener('scroll', sync); t.removeEventListener('wheel', wheel);
      t.removeEventListener('pointerdown', down); t.removeEventListener('pointermove', move); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', cancel);
      t.removeEventListener('click', click, true); t.removeEventListener('dragstart', nodrag);
    };
  }, [f.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = () => { const t = track.current!, gap = parseFloat(getComputedStyle(t).columnGap) || 14, first = t.querySelector('.fl:not(.big)') || t.firstElementChild; return first!.getBoundingClientRect().width + gap; };
  return (
    <section className="rv-shelf" style={{ gridArea: 'files' }} aria-label={`${f.name}: ${plural(files.length, 'file')}, newest first`}>
      <div className={'shelf-track' + (ends.more ? ' more' : '') + (ends.less ? ' less' : '')} ref={track}>
        {files.length ? <>
          <FileTile key={files[0].id} d={d} file={files[0]} f={f} i={0} pos={{ s: { gridColumn: `1 / span ${w}`, gridRow: '1 / span 2' }, big: true }} anim={anim(files[0].id)} />
          <NewFileTile f={f} i={1} style={{ gridColumn: `1 / span ${w}`, gridRow: 3 }} onMade={setFresh} />
        </> : <NewFileTile f={f} i={0} style={{ gridColumn: '1 / span 3', gridRow: '1 / span 3' }} onMade={setFresh} />}
        {old.map((x, i) => <FileTile key={x.id} d={d} file={x} f={f} i={i + 2} pos={place(i)} anim={anim(x.id)} />)}
      </div>
      <button className="shelf-nav prev" aria-label="Newer files" hidden={!ends.less} onClick={() => track.current!.scrollBy({ left: -step(), behavior: 'smooth' })}><Arrow /></button>
      <button className="shelf-nav next" aria-label="Older files" hidden={!ends.more} onClick={() => track.current!.scrollBy({ left: step(), behavior: 'smooth' })}><Arrow /></button>
    </section>
  );
}

// ---------- 3. a file, opened: its documents ----------
function Head({ id, f, title, sub, tools, status, editing }: { id: string; f: Folder; title: string; sub: string; tools?: ReactNode; status?: ReactNode; editing?: ReactNode }) {
  return (
    <motion.section className="tile fl head" style={{ gridArea: 'head' }} layoutId={vt(id)} transition={MORPH}>
      <motion.span className={'fl-tab ' + lookOf(f).g} {...POS}>{tabOf(f)}</motion.span>
      <motion.div className="fl-body g-white" {...BOX}><Back id={f.id} label={f.name} /><motion.div className="hd-top" {...POS}>{tools}{status}</motion.div>{editing || <Copy b={title} s={sub} />}</motion.div>
    </motion.section>
  );
}
const Tile = ({ area, g, cls, i, children }: { area: string; g: string; cls: string; i: number; children: ReactNode }) =>
  <motion.section className={`tile ${g} ${cls}`} style={{ gridArea: area }} {...rvIn(140 + i * 55)}>{children}</motion.section>;
// stats: [number, unit, caption]; numbers count up when the file opens
const Stat = ({ n, u, c }: { n: string; u: string; c: string }) => <div><b>{/^\d+$/.test(n) ? <CountUp to={+n} delay={0.4} /> : <span>{n}</span>}<small>{u}</small></b><span>{c}</span></div>;
// ticks: [on, text, small]; with onTick, each row is a button that ticks itself
function Checks({ rows, onTick }: { rows: [boolean, string, string?][]; onTick?: (i: number) => void }) {
  return (
    <div className="rv-checks">
      {rows.map(([on, t, s], i) => {
        const act = onTick ? { role: 'button', tabIndex: 0, 'aria-pressed': on, onClick: () => onTick(i), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTick(i); } } } : {};
        return <motion.div key={i + t} layout="position" className={on ? '' : 'off'} {...act}><Ck on={on} /><span>{t}{s && <small>{s}</small>}</span></motion.div>;
      })}
    </div>
  );
}
function Bars({ list }: { list: [string, number][] }) {
  const mx = Math.max(1, ...list.map(b => b[1]));
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
      {list.map(([label, v], i) => (
        <div key={label + i}>
          <motion.i style={{ height: `${Math.max(4, v / mx * 100)}%`, opacity: v ? 1 : 0.25, transformOrigin: '50% 100%' }} title={String(v)}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.6, ease: EASE, delay: 0.45 + i * 0.06 }} />
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}
/** text you can write straight into; it's saved as you type (the browser owns the text while you edit it) */
function Editable({ value, ph, cls = '', save, as = 'p' }: { value: string; ph: string; cls?: string; save: (v: string) => void; as?: 'p' | 'span' }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (el && document.activeElement !== el && el.innerText.trim() !== value) el.textContent = value || ''; }, [value]);
  const El = as;
  return <El ref={ref as never} className={'ed ' + cls} contentEditable suppressContentEditableWarning spellCheck data-ph={ph}
    onInput={e => save((e.currentTarget as HTMLElement).innerText.trim())}
    onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && cls.includes('inline'))) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
    onBlur={e => { const el = e.currentTarget as HTMLElement; if (!el.innerText.trim()) el.textContent = ''; }} />;
}
function AddLine({ cls = 'wk-add', ph, label, add }: { cls?: string; ph: string; label: string; add: (v: string) => void }) {
  const [v, setV] = useState('');
  return <input className={cls} value={v} onChange={e => setV(e.target.value)} placeholder={ph} aria-label={label}
    onKeyDown={e => { if (e.key !== 'Enter' || !v.trim()) return; add(v.trim()); setV(''); }} />;
}

function MonthDocs({ d, lv }: { d: Saved; lv: Extract<Level, { kind: 'month' }> }) {
  const { f, ym, id } = lv, st = monthStats(d, f, ym), M = monthNoteOf(d.archive, f.id, ym), L = lookOf(f), cat = catName(d, f), T = clock().T;
  // hours a week: the Monday-to-Sunday weeks that touch this month
  const weeks: { w: number; h: number }[] = [];
  monthDays(ym).forEach(D => { const w = weekStart(D); let wk = weeks.find(x => x.w === w); if (!wk) weeks.push(wk = { w, h: 0 }); if (D <= T) wk.h += catHours(d, f.cat, D); });
  const note = (fn: (m: { note: string; also: [string, string][] }) => void) => update(dr => { const k = f.id + '|' + ym; fn(dr.archive.months[k] || (dr.archive.months[k] = { note: '', also: [] })); });
  return (
    <div className="bento rv rv-file rv-month">
      <Head id={id} f={f} title={`${monthName(ym)} ${ym.slice(0, 4)}`} sub={`Filled in from ${cat} hours in Hours.`} status={<span className={'chip ' + (st.live ? 'live' : '')}>{st.live ? 'In progress' : 'Closed'}</span>} />
      <Tile area="report" g={L.g} cls="lead rv-report" i={0}>
        <Copy b="Monthly report" s={`${monthName(ym)}, ${st.live ? 'in progress' : 'closed'}.`} />
        <p className="rv-foot">Every {cat} hour you paint in Hours, or finish a task for, counts here.</p>
        {st.live && <div className="rv-prog"><span>Day {st.days} of {st.total}</span><i><motion.b initial={{ width: 0 }} animate={{ width: `${st.days / st.total * 100}%` }} transition={{ duration: 0.9, ease: EASE, delay: 0.35 }} /></i></div>}
        <div className="rstats">
          <Stat n={String(st.active)} u={'/' + st.days} c="days" /><Stat n={String(st.hours)} u="h" c={cat} /><Stat n={String(st.best)} u="d" c="longest run" /><Stat n={(st.hours / Math.max(1, st.days)).toFixed(1)} u="h" c="a day" />
        </div>
      </Tile>
      <Tile area="cal" g="g-night" cls="tall rv-att" i={1}>
        <Copy b={cat} s={st.live ? 'Click a day to add or clear an hour.' : 'An hour a shade.'} />
        <Cal d={d} f={f} ym={ym} cls="stamp" labels stampable={st.live} />
      </Tile>
      <Tile area="also" g="g-white" cls="tall rv-also" i={2}>
        <Copy b="Also this month" s="Not on any list, still counts." />
        {M.also.length ? <Checks rows={M.also.map(([t, dt]) => [true, t, niceDate(dt)])} /> : <p className="none">Nothing yet.</p>}
        <AddLine ph="+ Add something you did" label="Add something you did" add={v => { note(m => { m.also.push([v, keyOf(clock().T)]); }); toast('Filed under this month'); }} />
      </Tile>
      <Tile area="note" g="g-yellow" cls="rv-note" i={3}>
        <Copy b="Note to self" s="" />
        <Editable value={M.note} ph="Click to write a note for this month." cls="q" save={v => note(m => { m.note = v; })} />
      </Tile>
      <Tile area="weeks" g="g-green" cls="rv-hours" i={4}>
        <Copy b="Hours a week" s={`${st.hours} h in ${monthName(ym)}.`} />
        <Bars list={weeks.map((w, i) => ['W' + (i + 1), w.h])} />
      </Tile>
    </div>
  );
}

function ProjectDocs({ lv }: { lv: Extract<Level, { kind: 'project' }> }) {
  const { p, f, id } = lv, L = lookOf(f), done = p.plan.filter(x => x[0]).length, ws = weekStart(clock().T), go = useNavigate();
  const [renaming, setRenaming] = useState(false), nameIn = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renaming) { nameIn.current?.focus(); nameIn.current?.select(); } }, [renaming]);
  const weeks = [3, 2, 1, 0].map(k => {
    const start = ws - k * 7, end = start + 6, list = p.entries.filter(e => { const D = dayIdx(fromKey(e[0])); return D >= start && D <= end; });
    return { start, end, list, now: k === 0 };
  });
  const edit = (fn: (q: Project) => void) => update(dr => { const q = dr.archive.projects[p.id]; if (q) fn(q); });
  const rename = (e?: FormEvent) => {
    e?.preventDefault();
    if (!renaming) return;
    const name = (nameIn.current?.value || '').trim().replace(/\s+/g, ' ');
    setRenaming(false);
    if (!name || name === p.name) return;
    const old = p.name; edit(q => { q.name = name; }); toast(`Renamed ${old} to ${name}`);
  };
  const tools = <>
    <button className="hd-ico" title="Rename" aria-label={`Rename ${p.name}`} onClick={() => setRenaming(true)}><Pencil /></button>
    <SureDelete label={p.name} go={() => { update(dr => { delete dr.archive.projects[p.id]; }); go('/review/' + f.id); toast(`Deleted ${p.name}`); }} />
  </>;
  const status = <button className={'chip ' + (p.status === 'ACTIVE' ? 'live' : '')} title={`Click to ${p.status === 'ACTIVE' ? 'pause' : 'pick it up again'}`}
    onClick={() => { const on = p.status !== 'ACTIVE'; edit(q => { q.status = on ? 'ACTIVE' : 'PAUSED'; }); toast(on ? `${p.name} is active again` : `${p.name} is paused`); }}>{p.status === 'ACTIVE' ? 'Active' : 'Paused'}</button>;
  // rename: the title becomes a field (Enter saves, Escape keeps the old name)
  const editing = renaming ? (
    <form className="hd-form" onSubmit={rename}>
      <input ref={nameIn} defaultValue={p.name} maxLength={40} aria-label="New name" autoComplete="off" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setRenaming(false); } }} onBlur={() => rename()} />
      <small>Enter to save · Esc to keep it</small>
    </form>
  ) : undefined;
  return (
    <div className="bento rv rv-file rv-book">
      <Head id={id} f={f} title={p.name} sub={`${f.name}. Opened ${niceDate(p.created)}. ${plural(p.entries.length, 'update')} so far.`} tools={tools} status={status} editing={editing} />
      <Tile area="about" g="" cls="lead rv-about" i={0}>
        <span className={'own-cover ' + L.g} aria-hidden="true"><b>{p.name}</b></span>
        <div className="acard">
          <div className="copy"><b>{mark(p.name)}</b> <Editable as="span" value={p.tagline} ph="One line on what it is." cls="inline" save={v => edit(q => { q.tagline = v; })} /></div>
          <Editable value={p.about} ph="What is it, who is it for, and what would “done” look like? Click to write." save={v => edit(q => { q.about = v; })} />
        </div>
      </Tile>
      <Tile area="plan" g="g-white" cls="tall rv-plan" i={1}>
        <Copy b="Plan" s={p.plan.length ? <><span>{done}</span> of {p.plan.length} done. Tick a step when it ships.</> : 'The steps to get it done.'} />
        <Checks rows={p.plan.map(([on, t]) => [!!on, t])} onTick={i => { const s = p.plan[i]; edit(q => { q.plan[i][0] = q.plan[i][0] ? 0 : 1; }); toast(!s[0] ? `“${s[1]}” ticked off` : `“${s[1]}” is open again`); }} />
        <AddLine ph="+ Add a step" label="Add a step to the plan" add={v => edit(q => { q.plan.push([0, v]); })} />
      </Tile>
      <Tile area="note" g="g-yellow" cls="rv-note" i={2}>
        <Copy b="Note to self" s="" />
        <Editable value={p.note} ph="Click to write a note to yourself." cls="q" save={v => edit(q => { q.note = v; })} />
      </Tile>
      <Tile area="hours" g="g-green" cls="rv-hours" i={3}>
        <Copy b="Updates" s={`${weeks.reduce((n, w) => n + w.list.length, 0)} in four weeks.`} />
        <Bars list={weeks.map(w => [w.now ? 'Now' : shortDate(w.start).slice(4), w.list.length])} />
      </Tile>
      <Tile area="upd" g="g-white" cls="wide rv-upd" i={4}>
        <Copy b="A page a week" s={`${plural(p.entries.length, 'update')} so far.`} />
        <div className="rv-weeks">
          {weeks.map(w => (
            <div key={w.start} className="rv-wk">
              <h4>{w.now ? 'This week' : `Week of ${shortDate(w.start).slice(4)}`}<small>{plural(w.list.length, 'update')}</small></h4>
              <div className="wk-list">
                <AnimatePresence initial={false}>
                  {w.list.length ? w.list.map(([dt, t], i) => <motion.p key={i + dt + t} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}><b>{DAY_NAMES[fromKey(dt).getDay()]} {fromKey(dt).getDate()}</b>{t}</motion.p>) : <p className="none">Nothing logged.</p>}
                </AnimatePresence>
              </div>
              {w.now && <AddLine ph="Today’s update, then Enter" label="Add today’s update" add={v => { edit(q => { q.entries.push([keyOf(clock().T), v]); }); toast('Added to this week'); }} />}
            </div>
          ))}
        </div>
      </Tile>
    </div>
  );
}

// ---------- the page ----------
export function Review() {
  const d = useData(s => s.d); useClock(s => s.T);
  const loc = useLocation(), go = useNavigate();
  const lv = levelOf(d.archive, loc.pathname.split('/')[2] || '');
  // the level on screen before this one, so moving between levels morphs instead of cuts
  const cur = useRef<string | null>(null), from = useRef<string | null>(null);
  if (cur.current !== lv.id) { from.current = cur.current; cur.current = lv.id; }
  useEffect(() => { scrollTo(0, 0); }, [lv.id]);
  // Escape steps back out: file → folder → archive
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target instanceof Element && e.target.closest('input, textarea, [data-float], [contenteditable]'))) return;
      if (lv.kind === 'root') return;
      go(lv.kind === 'folder' ? '/review' : '/review/' + lv.f.id);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [lv, go]);
  const body = lv.kind === 'root' ? <Root d={d} from={from.current} />
    : lv.kind === 'folder' ? <div className="bento rv rv-folder"><Cover d={d} f={lv.f} /><Shelf d={d} f={lv.f} from={from.current} /></div>
    : lv.kind === 'month' ? <MonthDocs d={d} lv={lv} />
    : <ProjectDocs lv={lv} />;
  return (
    <AnimatePresence mode="popLayout">
      <motion.main key={lv.id} className="rv-level" exit={{ opacity: 0, transition: { duration: 0.22 } }}>{body}</motion.main>
    </AnimatePresence>
  );
}
