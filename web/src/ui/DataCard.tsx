// Tessera · your data: where it's saved, the daily backups, a copy to keep, and putting one back.
// It opens from the Home badge and from Review's "Backups" button.
import { useEffect, useRef, useState } from 'react';
import { PopTop } from './Pop';
import { closePop, openPop, toast } from '../store/ui';
import { backupNow, backups, download, info, restoreFile } from '../store/persist';
import { clock } from '../store/clock';
import { dayIdx, fmtTime, plural, shortDate } from '../lib/dates';

const when = (ms: number) => { const d = new Date(ms), D = dayIdx(d), T = clock().T, t = fmtTime(d.getHours() + d.getMinutes() / 60); return D === T ? `today, ${t}` : D === T - 1 ? `yesterday, ${t}` : `${shortDate(D)}, ${t}`; };
const backupWhen = (name: string) => {
  const [ymd, hms] = name.split(' '), [y, m, d] = ymd.split('-').map(Number), D = dayIdx(new Date(y, m - 1, d));
  return /^\d{6}$/.test(hms || '') ? when(new Date(y, m - 1, d, +hms.slice(0, 2), +hms.slice(2, 4)).getTime()) : D === clock().T ? 'today' : shortDate(D);
};

function DataCard() {
  const { remote, savedAt } = info();
  const [line, setLine] = useState(remote ? 'Looking…' : 'Download a copy to keep one somewhere safe.');
  const [file, setFile] = useState<File | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const list = () => backups().then(r => {
    if (!r) return;
    const b = r.backups;
    setLine(b.length ? `One a day, the last ${r.keep} kept. Newest: ${backupWhen(b[0].name)}. ${plural(b.length, 'copy', 'copies')} so far.` : `One a day, the last ${r.keep} kept. The first one is made before tomorrow's first change.`);
  }).catch(() => setLine('The server isn’t answering, so no backups can be listed.'));
  useEffect(() => { list(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const at = savedAt ? new Date(savedAt) : null;
  return (
    <>
      <PopTop label="Your data" />
      <div className="dline"><b>Saved</b><span>{remote ? 'In this browser and on this computer' : 'In this browser only. Run serve.py to keep a copy on this computer too'}{at ? `, last at ${fmtTime(at.getHours() + at.getMinutes() / 60)}` : ''}.</span></div>
      <div className="dline"><b>Backups</b><span>{line}</span></div>
      <input type="file" accept="application/json,.json" hidden ref={pick} onChange={e => setFile(e.target.files?.[0] || null)} />
      {file ? (
        <div className="pfoot asking">
          <p className="pask">Replace everything here with {file.name}? What's here now is backed up first.</p>
          <button type="button" className="pbtn" onClick={closePop}>Cancel</button>
          <button type="button" className="pbtn red" onClick={() => restoreFile(file).catch((e: Error) => toast(e.message))}>Replace</button>
        </div>
      ) : (
        <div className="pfoot">
          <button type="button" className="pbtn" onClick={() => pick.current?.click()}>Restore from a file</button>
          {remote && <button type="button" className="pbtn" onClick={async () => { try { await backupNow(); toast('Backed up'); list(); } catch { toast('The server isn’t answering. Try again in a moment'); } }}>Back up now</button>}
          <button type="button" className="pbtn dark" onClick={async () => { await download(); toast('Saved a copy to your downloads'); }}>Download a copy</button>
        </div>
      )}
    </>
  );
}
export const openDataCard = (anchor: HTMLElement) => openPop(anchor, <DataCard />);
