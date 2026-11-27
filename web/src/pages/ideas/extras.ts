// Tessera · Ideas board — templates, mind-map branches, polls, comments, images, links and export.
import { toast } from '../../store/ui';
import { WB, act, add, bounds, canEdit, center, fit, remove, select, update, viewOnly } from './core';
import { BG, PAL, geom, headPath, inkPath, shapePath, stampOf, textOn } from './draw';
import { edit } from './input';
import type { NewObj } from './core';
import type { Obj } from './types';

// ---------- templates: built around (0,0), then dropped in the middle of the view ----------
type TObj = NewObj & { _k?: string; a?: { k?: string; id?: string }; b?: { k?: string; id?: string } };
const N = (k: string, x: number, y: number, text: string, color: string, w = 180, h = 180): TObj => ({ _k: k, type: 'note', x, y, w, h, text, color, fs: 'm' });
const SH = (k: string, x: number, y: number, w: number, h: number, kind: string, fill: string, text: string): TObj => ({ _k: k, type: 'shape', x, y, w, h, kind, fill, text, fs: 'm' });
const SEC = (k: string, x: number, y: number, w: number, h: number, text: string, color: string): TObj => ({ _k: k, type: 'section', x, y, w, h, text, color });
const TX = (k: string, x: number, y: number, text: string, fs: 'l' | 'xl' = 'xl', w = 600): TObj => ({ _k: k, type: 'text', x, y, w, h: fs === 'xl' ? 56 : 34, text, fs, bold: true });
const LN = (a: string, b: string, text?: string, style = 'curve'): TObj => ({ type: 'line', a: { k: a }, b: { k: b }, style, arrow: 'end', sw: 2, color: '#1C1C1E', text });
export interface Template { name: string; sub: string; tint: string; build: () => TObj[] }
export const TEMPLATES: Record<string, Template> = {
  brainstorm: { name: 'Brainstorm', sub: 'A question and eight empty stickies', tint: '#FFE380', build: () => {
    const c = PAL.note, out = [SEC('s', 0, 0, 900, 560, 'Brainstorm', '#FFF7DD'), TX('t', 40, 60, 'What should we try next?', 'l', 700)];
    for (let i = 0; i < 8; i++) out.push(N('n' + i, 40 + (i % 4) * 210, 130 + Math.floor(i / 4) * 210, '', c[i % 6]));
    return out;
  } },
  mindmap: { name: 'Mind map', sub: 'One idea in the middle, branches out', tint: '#CFC2FF', build: () => [
    SH('c', 0, 0, 240, 120, 'round', '#7B61FF', 'Main idea'),
    N('a', 400, -220, 'Branch 1', '#A9D8FF', 170, 110), N('b', 400, 5, 'Branch 2', '#A8EBBB', 170, 110), N('d', 400, 230, 'Branch 3', '#FFC27A', 170, 110),
    N('e', -330, 5, 'Branch 4', '#FFB3D1', 170, 110),
    LN('c', 'a'), LN('c', 'b'), LN('c', 'd'), LN('c', 'e'),
  ] },
  flowchart: { name: 'Flowchart', sub: 'Start, steps, a decision and the end', tint: '#A9D8FF', build: () => [
    SH('s', 0, 0, 180, 80, 'ellipse', '#A8EBBB', 'Start'), SH('a', 260, 0, 200, 90, 'round', '#A9D8FF', 'Do the step'),
    SH('d', 540, -25, 170, 140, 'diamond', '#FFE380', 'Did it work?'), SH('y', 800, 0, 180, 80, 'ellipse', '#A8EBBB', 'Done'),
    SH('n', 540, 200, 200, 90, 'round', '#FFB3D1', 'Change the plan'),
    LN('s', 'a', '', 'elbow'), LN('a', 'd', '', 'elbow'), LN('d', 'y', 'Yes', 'elbow'), LN('d', 'n', 'No', 'elbow'), LN('n', 'a', '', 'elbow'),
  ] },
  retro: { name: 'Retro', sub: 'Went well, to improve, actions', tint: '#A8EBBB', build: () => [
    SEC('a', 0, 0, 440, 520, 'Went well', '#EAF9EE'), SEC('b', 480, 0, 440, 520, 'To improve', '#FFF0E3'), SEC('c', 960, 0, 440, 520, 'Actions', '#F4F1FF'),
    N('1', 30, 70, '', '#A8EBBB'), N('2', 230, 70, '', '#A8EBBB'), N('3', 510, 70, '', '#FFC27A'), N('4', 710, 70, '', '#FFC27A'), N('5', 990, 70, '', '#CFC2FF'),
  ] },
  kanban: { name: 'Kanban', sub: 'To do, doing, done', tint: '#FFC27A', build: () => [
    SEC('a', 0, 0, 300, 640, 'To do', '#F2F2F4'), SEC('b', 330, 0, 300, 640, 'Doing', '#EAF5FF'), SEC('c', 660, 0, 300, 640, 'Done', '#EAF9EE'),
    N('1', 20, 70, 'Task', '#FFE380', 260, 120), N('2', 20, 210, 'Task', '#FFE380', 260, 120), N('3', 350, 70, 'Task', '#A9D8FF', 260, 120), N('4', 680, 70, 'Task', '#A8EBBB', 260, 120),
  ] },
  weekly: { name: 'Week plan', sub: 'Seven days side by side', tint: '#FFB3D1', build: () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.flatMap((d, i) => [SEC('d' + i, i * 230, 0, 210, 460, d, PAL.section[i % 7]), N('n' + i, i * 230 + 15, 60, '', PAL.note[i % 6], 180, 140)]);
  } },
};
export function insertTemplate(key: string, at?: { x: number; y: number }) {
  const list = TEMPLATES[key].build();
  const shapes = list.filter(o => o.type !== 'line'), b = bounds(shapes as Obj[]), c = at || center();
  const dx = c.x - (b.x + b.w / 2), dy = c.y - (b.y + b.h / 2), map: Record<string, string> = {}, ids: string[] = [];
  act('Add ' + TEMPLATES[key].name, () => {
    shapes.forEach(({ _k, ...o }) => { const n = add({ ...o, x: o.x! + dx, y: o.y! + dy, z: o.type === 'section' ? 0 : undefined }); map[_k!] = n.id; ids.push(n.id); });
    list.filter(o => o.type === 'line').forEach(({ _k, ...l }) => { void _k; ids.push(add({ ...l, a: { id: map[l.a!.k!] }, b: { id: map[l.b!.k!] } }).id); });
  });
  select(ids); fit(ids, 1);
}

// ---------- mind map: Tab adds a connected child to the right ----------
export function addChild(id: string) {
  const p = WB.objs[id]; if (!p || !['note', 'shape', 'text'].includes(p.type)) return;
  const kids = Object.values(WB.objs).filter(l => l.type === 'line' && l.a?.id === id).map(l => WB.objs[l.b?.id as string]).filter(Boolean);
  const w = p.type === 'shape' ? 170 : Math.min(p.w, 180), h = p.type === 'shape' ? 110 : Math.min(p.h, 120);
  const x = p.x + p.w + 120, y = kids.length ? Math.max(...kids.map(k => k.y + k.h)) + 30 : p.y + p.h / 2 - h / 2;
  let child: Obj | null = null;
  act('Add branch', () => {
    child = add({ type: 'note', x, y, w, h, text: '', color: p.type === 'note' ? p.color : PAL.note[kids.length % 6], fs: 'm' });
    add({ type: 'line', a: { id }, b: { id: child.id }, style: 'curve', arrow: 'none', sw: 2, color: '#1C1C1E', z: 0 });
  });
  if (!child) return;
  const cid = (child as Obj).id;
  select([cid]);
  setTimeout(() => edit(cid), 30);
}

// ---------- polls (boards made with the classic board may have them; anyone can vote) ----------
export const pollHeight = (n: number) => 86 + n * 46;
export function pollVote(id: string, i: number) {
  const o = WB.objs[id]; if (!o || !o.opts) return;
  act('Vote in poll', () => {
    const opts = o.opts!.map((p, j) => { const v = { ...(p.v || {}) }; if (j === i) { if (v[WB.me.name]) delete v[WB.me.name]; else v[WB.me.name] = 1; } else delete v[WB.me.name]; return { ...p, v }; });
    update(id, { opts });
  }, { view: true });
}

// ---------- comments (viewers can comment too) ----------
export const comments = {
  create(x: number, y: number, text: string) { let o: Obj | null = null; act('Comment', () => { o = add({ type: 'comment', x: x - 16, y: y - 32, w: 32, h: 32, thread: [{ by: WB.me.name, at: Date.now(), text }], resolved: false }); }, { view: true }); return o as Obj | null; },
  reply(id: string, text: string) { const o = WB.objs[id]; if (o) act('Reply', () => update(id, { thread: [...(o.thread || []), { by: WB.me.name, at: Date.now(), text }], resolved: false }), { view: true }); },
  resolve(id: string) { const o = WB.objs[id]; if (o) act(o.resolved ? 'Reopen comment' : 'Resolve comment', () => update(id, { resolved: !o.resolved }), { view: true }); },
  remove(id: string) { act('Delete comment', () => remove([id]), { view: true }); },
};

// ---------- images and links ----------
interface Img { src: string; w: number; h: number; name: string }
const readImage = (file: File) => new Promise<Img | null>(res => {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      let src = fr.result as string, w = img.naturalWidth, h = img.naturalHeight;
      if (file.size > 350000 || Math.max(w, h) > 1600) { // keep boards small enough to save in the browser
        const k = Math.min(1, 1400 / Math.max(w, h)), c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        src = c.toDataURL('image/jpeg', .84); w = c.width; h = c.height;
      }
      res({ src, w, h, name: file.name });
    };
    img.onerror = () => res(null);
    img.src = fr.result as string;
  };
  fr.onerror = () => res(null);
  fr.readAsDataURL(file);
});
export async function importImages(files: FileList | File[], at?: { x: number; y: number } | null) {
  const list = [...files].filter(f => f.type.startsWith('image/')); if (!list.length) return;
  if (!canEdit()) { viewOnly(); return; }
  const imgs = (await Promise.all(list.map(readImage))).filter((i): i is Img => !!i);
  const c = at || center(), ids: string[] = [];
  let x = c.x;
  const total = imgs.reduce((a, i) => a + Math.min(420, i.w) + 30, -30); x -= total / 2;
  act(imgs.length > 1 ? 'Add images' : 'Add image', () => imgs.forEach(i => {
    const w = Math.min(420, i.w), h = Math.round(w * i.h / i.w);
    ids.push(add({ type: 'image', x, y: c.y - h / 2, w, h, src: i.src, alt: i.name }).id); x += w + 30;
  }));
  select(ids);
}
export function addLink(url: string, at?: { x: number; y: number } | null) {
  url = url.trim(); if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const c = at || center(); let o: Obj | null = null;
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();
  const title = /youtube|youtu\.be/.test(host) ? 'YouTube video' : /figma/.test(host) ? 'Figma file' : /github/.test(host) ? 'GitHub · ' + (url.split('/').slice(3, 5).join('/') || 'repo') : host;
  act('Add link', () => { o = add({ type: 'link', x: c.x - 150, y: c.y - 45, w: 300, h: 90, url, title }); });
  if (o) select([(o as Obj).id]);
}
/** a link card's address is typed by someone: it opens in a new tab, but never as a script. It goes out as a click on
 *  a plain link, the way every link in Tessera does, so the desktop app can send it to your browser instead. */
export function openLink(url?: string) {
  if (!url || /^\s*(javascript|data|vbscript):/i.test(url)) return;
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------- export: PNG, SVG and PDF, drawn from the board data ----------
const FS = { s: 14, m: 20, l: 28, xl: 40 };
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
let mctx: CanvasRenderingContext2D | null = null;
const xml = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function wrap(text: string | undefined, size: number, bold: boolean | undefined, width: number) {
  mctx ??= document.createElement('canvas').getContext('2d')!;
  mctx.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
  const out: string[] = [];
  String(text || '').split('\n').forEach(par => {
    let line = '';
    par.split(/\s+/).forEach(word => {
      const t = line ? line + ' ' + word : word;
      if (mctx!.measureText(t).width > width && line) { out.push(line); line = word; } else line = t;
    });
    out.push(line);
  });
  return out;
}
function textSVG(text: string | undefined, x: number, y: number, w: number, h: number, o: Obj, color: string, valign = 'middle') {
  if (!text) return '';
  const size = FS[o.fs || 'm'], lh = size * 1.25, align = o.align || (o.type === 'text' ? 'left' : 'center');
  const lines = wrap(text, size, o.bold, w);
  const y0 = valign === 'top' ? y + size : y + h / 2 - (lines.length * lh) / 2 + size * .85;
  const ax = align === 'left' ? x : align === 'right' ? x + w : x + w / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  return `<text font-family='${FONT}' font-size="${size}" font-weight="${o.bold ? 700 : 500}" fill="${color}" text-anchor="${anchor}">${lines.map((l, i) => `<tspan x="${ax}" y="${(y0 + i * lh).toFixed(1)}">${xml(l)}</tspan>`).join('')}</text>`;
}
function lineSVG(l: Obj) {
  const g = geom(l), c = l.color || '#1C1C1E', sw = l.sw || 2;
  const head = (tip: { x: number; y: number }, from: { x: number; y: number }) => `<path d="${headPath(tip, from, sw)}" fill="${c}" stroke="${c}" stroke-width="${sw * .6}" stroke-linejoin="round"/>`;
  return `<g><path d="${g.d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${l.dash ? ' stroke-dasharray="8 7"' : ''}/>` +
    (l.arrow === 'end' || l.arrow === 'both' ? head(g.p2, g.t2) : '') + (l.arrow === 'both' ? head(g.p1, g.t1) : '') +
    (l.text ? `<text x="${g.mid.x}" y="${g.mid.y}" font-family='${FONT}' font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="#fff" stroke-width="6">${xml(l.text)}</text>` : '') + '</g>';
}
const VIDEO = /youtube|youtu\.be|vimeo/;
function objSVG(o: Obj) {
  if (o.type === 'line') return lineSVG(o);
  const { x, y, w, h } = o, rot = o.r ? ` transform="rotate(${o.r} ${x + w / 2} ${y + h / 2})"` : '';
  let s = '';
  if (o.type === 'note') s = `<rect x="${x}" y="${y + 3}" width="${w}" height="${h}" rx="14" fill="#000" opacity=".08"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${o.color}"/>` + textSVG(o.text, x + 16, y + 10, w - 32, h - 34, o, textOn(o.color)) + (o.by ? `<text x="${x + 14}" y="${y + h - 12}" font-family='${FONT}' font-size="11" fill="${textOn(o.color)}" opacity=".55">${xml(o.by)}</text>` : '');
  else if (o.type === 'text') s = textSVG(o.text, x, y, w, h, o, o.color || '#1C1C1E', 'top');
  else if (o.type === 'shape') {
    const fill = o.fill || '#A9D8FF', st = o.sw ? ` stroke="${o.stroke}" stroke-width="${o.sw}"` : '';
    s = o.kind === 'ellipse' ? `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"${st}/>`
      : o.kind === 'rect' || o.kind === 'round' ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.kind === 'round' ? 18 : 4}" fill="${fill}"${st}/>`
      : `<path transform="translate(${x} ${y})" d="${shapePath(o.kind, w, h)}" fill="${fill}"${st} stroke-linejoin="round"/>`;
    s += textSVG(o.text, x + 12, y, w - 24, h, o, o.color || textOn(fill === 'transparent' ? '#fff' : fill));
  } else if (o.type === 'image') s = `<clipPath id="c${o.id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/></clipPath><image href="${xml(o.src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${o.id})"/>`;
  else if (o.type === 'link') s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#fff" stroke="#E4E4E8"/><rect x="${x + 14}" y="${y + 14}" width="${h - 28}" height="${h - 28}" rx="12" fill="${VIDEO.test(o.url || '') ? '#E5484D' : '#1C1C1E'}"/>${VIDEO.test(o.url || '') ? `<path d="M${x + h / 2 - 5} ${y + h / 2 - 10} L${x + h / 2 + 11} ${y + h / 2} L${x + h / 2 - 5} ${y + h / 2 + 10} Z" fill="#fff"/>` : ''}<text x="${x + h + 4}" y="${y + h / 2 - 2}" font-family='${FONT}' font-size="15" font-weight="700" fill="#1C1C1E">${xml(o.title)}</text><text x="${x + h + 4}" y="${y + h / 2 + 18}" font-family='${FONT}' font-size="12" fill="#8A8A90">${xml(o.url)}</text>`;
  else if (o.type === 'section') s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${o.color || '#F4F1FF'}" stroke="#00000014" stroke-width="1.5"/><text x="${x + 22}" y="${y + 34}" font-family='${FONT}' font-size="18" font-weight="700" fill="#1C1C1E">${xml(o.text || 'Section')}</text>`;
  else if (o.type === 'stamp') s = `<g transform="translate(${x} ${y}) scale(${w / 48} ${h / 48})">${stampOf(o.emoji).art}</g>`;
  else if (o.type === 'ink') s = `<g transform="translate(${x} ${y}) scale(${w / (o.nw || 1)} ${h / (o.nh || 1)})"><path d="${inkPath(o.pts)}" fill="none" stroke="${o.color}" stroke-width="${o.sw}" stroke-linecap="round" stroke-linejoin="round"${o.hl ? ' opacity=".45"' : ''}/></g>`;
  else if (o.type === 'poll') {
    const opts = o.opts || [], total = opts.reduce((a, p) => a + Object.keys(p.v || {}).length, 0);
    s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="#1C1C1E"/><text x="${x + 20}" y="${y + 36}" font-family='${FONT}' font-size="17" font-weight="700" fill="#fff">${xml(o.q)}</text>` +
      opts.map((p, i) => { const n = Object.keys(p.v || {}).length, yy = y + 56 + i * 46; return `<rect x="${x + 16}" y="${yy}" width="${w - 32}" height="38" rx="11" fill="#2C2C30"/><rect x="${x + 16}" y="${yy}" width="${(w - 32) * (total ? n / total : 0)}" height="38" rx="11" fill="#7B61FF"/><text x="${x + 30}" y="${yy + 24}" font-family='${FONT}' font-size="14" fill="#fff">${xml(p.t)}</text><text x="${x + w - 30}" y="${yy + 24}" font-family='${FONT}' font-size="14" font-weight="700" fill="#fff" text-anchor="end">${n}</text>`; }).join('');
  }
  return rot ? `<g${rot}>${s}</g>` : s;
}
export function toSVG(list: Obj[]) {
  const b = bounds(list), pad = 48, X = b.x - pad, Y = b.y - pad, W = Math.ceil(b.w + pad * 2), H = Math.ceil(b.h + pad * 2);
  const bg = BG[WB.board?.meta.settings?.bg || 'paper'] || BG.paper;
  const rank = (o: Obj) => (o.type === 'section' ? -1e6 : o.type === 'line' ? 1e6 : 0) + o.z;
  const order = [...list].sort((a, c) => rank(a) - rank(c));
  return { w: W, h: H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${X} ${Y} ${W} ${H}"><rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${bg}"/>${order.map(objSVG).join('')}</svg>` };
}
const download = (name: string, blob: Blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
const toCanvas = (svg: string, w: number, h: number, scale: number) => new Promise<HTMLCanvasElement>((res, rej) => {
  const img = new Image();
  img.onload = () => { const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale); const g = c.getContext('2d')!; g.scale(scale, scale); g.drawImage(img, 0, 0, w, h); res(c); };
  img.onerror = rej;
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});
// a one-page PDF holding the board as a JPEG
function pdfBlob(jpegBytes: Uint8Array, pw: number, ph: number, iw: number, ih: number) {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], offs: number[] = []; let len = 0;
  const push = (p: string | Uint8Array) => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); len += b.length; };
  const obj = (n: number, body: string) => { offs[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4] = len; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`); push(jpegBytes); push('\nendstream\nendobj\n');
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
export async function exportBoard(fmt: 'png' | 'svg' | 'pdf', onlySel: boolean) {
  if (!WB.board) return;
  const ids = onlySel && WB.sel.size ? [...WB.sel] : Object.keys(WB.objs);
  const list = ids.map(id => WB.objs[id]).filter(o => o && o.type !== 'comment');
  if (!list.length) { toast('Nothing to export yet'); return; }
  const { svg, w, h } = toSVG(list), name = (WB.board.name || 'board').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  try {
    if (fmt === 'svg') download(name + '.svg', new Blob([svg], { type: 'image/svg+xml' }));
    else {
      const scale = Math.min(2, 8000 / Math.max(w, h));
      const c = await toCanvas(svg, w, h, scale);
      if (fmt === 'png') await new Promise<void>(r => c.toBlob(b => { if (b) download(name + '.png', b); r(); }, 'image/png'));
      else {
        const data = c.toDataURL('image/jpeg', .92), bin = atob(data.split(',')[1]), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        download(name + '.pdf', pdfBlob(bytes, Math.round(w * .75), Math.round(h * .75), c.width, c.height));
      }
    }
    toast(`Exported ${name}.${fmt}`);
  } catch (e) { console.error(e); toast('Export failed: ' + (e as Error).message); }
}
