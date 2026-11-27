// Tessera · Memory wall: the dialogs over the wall: a one-line question (a place's name, a wall's new name), New wall,
// the viewer that shows one thing big and edits it, and the gallery of things to hang. They sit on document.body like
// the classic page's, so the wall's own pointer handlers never see them; a click on the backdrop or Escape closes one.
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { reducedMotion, toast } from '../../store/ui';
import { KIT } from './kit';
import {
  FIRST, THEMES, curWall, drawOf, kit, newWall, removeItem, setFields, setPhoto, src, useWalls,
  type ThemeId,
} from './store';

export type Dlg =
  | { t: 'ask'; title: string; sub: string; ph: string; ok: string; done: (v: string) => void }
  | { t: 'new' }
  | { t: 'view'; wall: string; id: string; fresh: boolean }
  | { t: 'gallery'; wall: string };
export type OpenDlg = Dlg & { k: number };

/** custom properties alongside ordinary styles */
export const css = (o: CSSProperties & { [k: `--${string}`]: string }): CSSProperties => o;
export const str = (v: unknown) => String(v ?? '');
/** text with its line breaks kept */
export const lines = (t: string) => t.split('\n').flatMap((l, i) => (i ? [<br key={i} />, l] : [l]));

// ---------- reading a photo from disk: made at most 1000px on its long side, as a JPEG ----------
export const readPhoto = (file: File) => new Promise<string | null>(res => {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d'); if (!g) return res(null);
      g.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .84));
    };
    img.onerror = () => res(null); img.src = fr.result as string;
  };
  fr.onerror = () => res(null); fr.readAsDataURL(file);
});
export const pickFiles = (multiple: boolean) => new Promise<File[]>(res => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = multiple;
  i.onchange = () => res([...(i.files || [])]); i.click();
});

/** focuses what a dialog starts on, a moment after it opens (as the classic page did) */
function useFocusSoon(get: () => HTMLElement | null | undefined) {
  const f = useRef(get); f.current = get;
  useEffect(() => { const t = setTimeout(() => f.current()?.focus(), 30); return () => clearTimeout(t); }, []);
}

// ---------- the backdrop and its card ----------
function Modal({ cls, close, children }: { cls: string; close: () => void; children: ReactNode }) {
  return (
    <motion.div className="wv-back" exit={reducedMotion() ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
      onPointerDown={e => { if (e.target === e.currentTarget) close(); }}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <div className={'wv ' + cls} role="dialog" aria-modal="true">{children}</div>
    </motion.div>
  );
}

/** whichever dialog is open; `close(k)` closes that one only, so a late click on one fading out leaves the next alone */
export function Dialogs({ dlg, close, hang }: { dlg: OpenDlg | null; close: (k: number) => void; hang: (wall: string, key: string) => void }) {
  let body: ReactNode = null, cls = 'small';
  if (dlg) {
    const shut = () => close(dlg.k);
    if (dlg.t === 'ask') body = <Ask d={dlg} close={shut} />;
    else if (dlg.t === 'new') body = <NewWall close={shut} />;
    else if (dlg.t === 'view') { cls = 'view'; body = <Viewer wid={dlg.wall} id={dlg.id} fresh={dlg.fresh} close={shut} />; }
    else { cls = 'gallery'; body = <Gallery wid={dlg.wall} close={shut} hang={k => hang(dlg.wall, k)} />; }
  }
  return createPortal(
    <AnimatePresence>{dlg && <Modal key={dlg.k} cls={cls} close={() => close(dlg.k)}>{body}</Modal>}</AnimatePresence>,
    document.body,
  );
}

// ---------- a one-line question ----------
function Ask({ d, close }: { d: Extract<Dlg, { t: 'ask' }>; close: () => void }) {
  const inp = useRef<HTMLInputElement>(null);
  useFocusSoon(() => inp.current);
  const submit = (e: FormEvent) => { e.preventDefault(); const v = inp.current!.value.trim(); close(); if (v) d.done(v); };
  return (
    <>
      <h3>{d.title}</h3><p className="sub">{d.sub}</p>
      <form onSubmit={submit}>
        <input ref={inp} placeholder={d.ph} autoComplete="off" />
        <div className="foot"><button type="button" className="wb" onClick={close}>Cancel</button><button className="wb dark">{d.ok}</button></div>
      </form>
    </>
  );
}

// ---------- New wall: a name and a kind ----------
function NewWall({ close }: { close: () => void }) {
  const [theme, setTheme] = useState<ThemeId>('trip'), inp = useRef<HTMLInputElement>(null);
  useFocusSoon(() => inp.current);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = inp.current!.value.trim(); if (!n) { inp.current!.focus(); return; }
    newWall(n, theme); close(); toast(`${n} is up. Add your first photo.`);
  };
  return (
    <>
      <h3>New wall</h3><p className="sub">One wall for one event: a trip, a festival, a season, a collection.</p>
      <form onSubmit={submit}>
        <input ref={inp} placeholder="e.g. Goa with college friends" autoComplete="off" />
        <div className="themes">
          {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([k, t]) => (
            <button key={k} type="button" className={`th ${t.g}${k === theme ? ' on' : ''}`} data-th={k} aria-pressed={k === theme}
              onClick={() => { setTheme(k); inp.current?.focus(); }}>{t.name}</button>
          ))}
        </div>
        <div className="foot"><button type="button" className="wb" onClick={close}>Cancel</button><button className="wb dark">Create</button></div>
      </form>
    </>
  );
}

// ---------- the viewer: one thing shown big, and what it says ----------
function Viewer({ wid, id, fresh, close }: { wid: string; id: string; fresh: boolean; close: () => void }) {
  // a new photo opens it afresh (fields read again, Done focused), as the classic page did
  const [n, setN] = useState(0);
  return <ViewerBody key={n} wid={wid} id={id} fresh={fresh && !n} close={close} reopen={() => setN(n + 1)} />;
}
function ViewerBody({ wid, id, fresh, close, reopen }: { wid: string; id: string; fresh: boolean; close: () => void; reopen: () => void }) {
  const live = useWalls(s => s.D.walls.find(x => x.id === wid));
  const liveIt = live?.items.find(x => x.id === id);
  // what was shown stays while the dialog fades out after a delete
  const last = useRef({ w: live, it: liveIt }); if (live && liveIt) last.current = { w: live, it: liveIt };
  const { w, it } = last.current;
  const [sure, setSure] = useState(false);
  const right = useRef<HTMLDivElement>(null), done = useRef<HTMLButtonElement>(null);
  useFocusSoon(() => (fresh ? right.current?.querySelector<HTMLElement>('[data-f]') : done.current));
  if (!w || !it) return null;
  const d = it.kind === 'prop' ? kit(it.prop) : undefined;
  const upd = () => setFields(wid, id, [...right.current!.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-f]')].map(f => [f.dataset.f!, f.value]));
  const pickPhoto = async () => { const [f] = await pickFiles(false); if (!f) return; const s = await readPhoto(f); if (!s) return; setPhoto(wid, id, s); reopen(); };
  const toDrawing = () => { setPhoto(wid, id, null); reopen(); };
  const del = () => {
    if (!sure) { setSure(true); return; }
    removeItem(wid, id); close(); toast(d ? 'Taken down' : 'Deleted');
  };
  let visual: ReactNode;
  if (d) {
    // an object, drawn bigger on its own wire
    const s = Math.min(1.5, 400 / d.h, 420 / d.w);
    visual = (
      <div className="v-prop" style={css({ '--wy': `${(d.hy * s).toFixed(1)}px` })}>
        <svg width={Math.round(d.w * s)} height={Math.round(d.h * s)} viewBox={`0 0 ${d.w} ${d.h}`} overflow="visible" aria-hidden="true" dangerouslySetInnerHTML={{ __html: drawOf(it.prop!) }} />
      </div>
    );
  } else if (it.kind === 'note') {
    visual = <div className="v-note"><div className="tag big"><i /><p>{lines(it.text || '…')}</p></div></div>;
  } else if (it.kind === 'postcard') {
    visual = (
      <div className="v-post">
        <div className="post front"><img src={src(it)} alt="" /><div className="greet"><small>Greetings from</small><b>{str(it.place)}</b></div></div>
        <div className="post backside">
          <div className="msg">{lines(it.text || 'Write the back of the postcard…')}</div>
          <div className="addr"><span className="stampbig"><img src={src(it)} alt="" /></span><span className="pm">{(it.place || '').toUpperCase()}<br />{it.date || ''}</span><i /><i /><i /></div>
        </div>
      </div>
    );
  } else {
    visual = <div className="v-photo"><div className="print big"><div className="ph"><img src={src(it)} alt="" /></div><div className="cap">{str(it.title)}</div></div></div>;
  }
  const fields = d ? (
    <>
      <label>Name<input data-f="title" defaultValue={it.title || d.name} onChange={upd} /></label>
      <label>The story behind it<textarea data-f="text" rows={5} placeholder="Where it came from, who it was from" defaultValue={str(it.text)} onChange={upd} /></label>
    </>
  ) : it.kind === 'note' ? (
    <label>Note<textarea data-f="text" rows={5} placeholder="Something small worth keeping" defaultValue={str(it.text)} onChange={upd} /></label>
  ) : it.kind === 'postcard' ? (
    <>
      <label>Greetings from<input data-f="place" defaultValue={str(it.place)} onChange={upd} /></label>
      <label>Date<input data-f="date" defaultValue={str(it.date)} onChange={upd} /></label>
      <label>On the back<textarea data-f="text" rows={5} placeholder="What happened there?" defaultValue={str(it.text)} onChange={upd} /></label>
    </>
  ) : (
    <>
      <label>Title<input data-f="title" defaultValue={str(it.title)} onChange={upd} /></label>
      <label>Date<input data-f="date" defaultValue={str(it.date)} onChange={upd} /></label>
      <label>What happened<textarea data-f="text" rows={5} placeholder="A few lines to remember it by" defaultValue={str(it.text)} onChange={upd} /></label>
    </>
  );
  const label = d ? 'Object' : it.kind === 'photo' ? 'Photo' : it.kind === 'postcard' ? 'Postcard' : 'Note';
  return (
    <>
      <div className="v-l">{visual}</div>
      <div className="v-r" ref={right}>
        <div className="v-h"><span>{`${label} · ${w.name}`}</span><button className="x" aria-label="Close" onClick={close}>×</button></div>
        {fields}
        <div className="foot">
          {(it.kind === 'photo' || it.kind === 'postcard') && (
            <>
              <button className="wb" onClick={pickPhoto}>{it.src ? 'Change photo' : 'Use my photo'}</button>
              {it.src && it.art ? <button className="wb" onClick={toDrawing}>Use drawing</button> : null}
            </>
          )}
          <button className={'wb red' + (sure ? ' sure' : '')} onClick={del}>{d ? (sure ? 'Take it down?' : 'Take down') : (sure ? 'Delete it?' : 'Delete')}</button>
          <button className="wb dark" ref={done} onClick={close}>Done</button>
        </div>
      </div>
    </>
  );
}

// ---------- the things you can hang: grouped, with what suits this wall first ----------
function Gallery({ wid, close, hang }: { wid: string; close: () => void; hang: (key: string) => void }) {
  const D = useWalls(s => s.D), w = D.walls.find(x => x.id === wid) || curWall(D);
  const first = useRef<HTMLButtonElement>(null);
  useFocusSoon(() => first.current);
  const cats = [...new Set([...(FIRST[w.theme] || []), ...Object.values(KIT).map(d => d.cat)])];
  let n = 0;
  return (
    <>
      <div className="v-h"><span>{`Hang something · ${w.name}`}</span><button className="x" aria-label="Close" onClick={close}>×</button></div>
      {cats.map(c => (
        <Section key={c} name={c}>
          {Object.entries(KIT).filter(([, d]) => d.cat === c).map(([k, d]) => {
            const s = Math.min(92 / d.h, 118 / d.w, 1);
            return (
              <button key={k} className="gi" data-k={k} ref={n++ ? undefined : first} onClick={() => { close(); hang(k); }}>
                <span className="gth" style={css({ '--wy': `${(10 + d.hy * s).toFixed(1)}px` })}>
                  <svg width={Math.round(d.w * s)} height={Math.round(d.h * s)} viewBox={`0 0 ${d.w} ${d.h}`} overflow="visible" aria-hidden="true" dangerouslySetInnerHTML={{ __html: drawOf(k) }} />
                </span>
                <b>{d.name}</b>
              </button>
            );
          })}
        </Section>
      ))}
    </>
  );
}
const Section = ({ name, children }: { name: string; children: ReactNode }) => <><h4>{name}</h4><div className="gx">{children}</div></>;
