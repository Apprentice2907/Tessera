// Tessera · Ideas board — what things look like: palettes, shape outlines, pen strokes, connector curves, and the
// stamps (drawn, not emoji). Shared by the canvas, the menus and the PNG/SVG/PDF export.
import { clamp, lineEnds, type EndPt } from './core';
import type { End } from './types';

export const PAL = {
  note: ['#FFE380', '#FFC27A', '#FFB3D1', '#CFC2FF', '#A9D8FF', '#A8EBBB', '#FFFFFF', '#2A2A2E'],
  fill: ['#A9D8FF', '#CFC2FF', '#A8EBBB', '#FFE380', '#FFC27A', '#FFB3D1', '#FFFFFF', '#1C1C1E', 'transparent'],
  ink: ['#1C1C1E', '#7B61FF', '#1F7BFF', '#22A55B', '#FF8A00', '#FF4F96', '#E5484D', '#FFFFFF'],
  hl: ['#FFE14D', '#7CF29A', '#7CD4FF', '#FF9CCB', '#C7A6FF'],
  section: ['#F4F1FF', '#EAF5FF', '#EAF9EE', '#FFF7DD', '#FFF0E3', '#FFEFF5', '#F2F2F4'],
};
export const SHAPES = ['rect', 'round', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'parallelogram'];
export const SHAPE_NAME: Record<string, string> = { rect: 'Rectangle', round: 'Rounded', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', hexagon: 'Hexagon', star: 'Star', parallelogram: 'Parallelogram' };
export const BG: Record<string, string> = { paper: '#F2F1ED', white: '#FFFFFF', warm: '#F6EFE3', dark: '#1F1F23' };

const dark = (hex?: string) => { if (!hex || hex === 'transparent' || hex[0] !== '#') return false; const n = parseInt(hex.slice(1), 16); return ((n >> 16 & 255) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) < 140; };
export const textOn = (bg?: string) => dark(bg) ? '#FFFFFF' : '#1C1C1E';
export const svgKind = (kind?: string) => !['rect', 'round', 'ellipse'].includes(kind || '');

export function shapePath(kind: string | undefined, w: number, h: number) {
  const P = (pts: number[][]) => 'M' + pts.map(([x, y]) => `${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`).join(' L') + ' Z';
  if (kind === 'triangle') return P([[.5, 0], [1, 1], [0, 1]]);
  if (kind === 'diamond') return P([[.5, 0], [1, .5], [.5, 1], [0, .5]]);
  if (kind === 'hexagon') return P([[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]]);
  if (kind === 'parallelogram') return P([[.2, 0], [1, 0], [.8, 1], [0, 1]]);
  if (kind === 'star') { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .22 : .5; pts.push([.5 + Math.cos(a) * r, .53 + Math.sin(a) * r]); } return P(pts); }
  return '';
}
/** a pen stroke through its points, smoothed with quadratic curves */
export function inkPath(pts: [number, number][] = []) {
  if (!pts.length) return '';
  if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]} L${(pts[1] || pts[0])[0] + .01} ${(pts[1] || pts[0])[1]}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0]} ${pts[i][1]} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  const l = pts[pts.length - 1]; return d + ` L${l[0]} ${l[1]}`;
}
export const domain = (u?: string) => { try { return new URL(u || '').hostname.replace(/^www\./, ''); } catch { return u || ''; } };
export const isVideo = (u?: string) => /youtube\.com|youtu\.be|vimeo\.com/.test(u || '');

// ---------- connectors ----------
const norm = (x: number, y: number) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
export interface Geom { d: string; p1: EndPt; p2: EndPt; t1: { x: number; y: number }; t2: { x: number; y: number }; mid: { x: number; y: number } }
/** a connector's path: curved, straight or elbow, with the tangents its arrowheads point along */
export function geom(l: { a?: End; b?: End; style?: string }): Geom {
  const { p1, p2 } = lineEnds(l);
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const n1 = norm(p1.nx, p1.ny), n2 = norm(p2.nx, p2.ny);
  let d, t1, t2, mid;
  if (l.style === 'straight') { d = `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`; t1 = p2; t2 = p1; mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; }
  else if (l.style === 'elbow') {
    if (Math.abs(n1.x) >= Math.abs(n1.y)) { const mx = (p1.x + p2.x) / 2; d = `M${p1.x} ${p1.y} H${mx} V${p2.y} H${p2.x}`; t1 = { x: mx, y: p1.y }; t2 = { x: mx, y: p2.y }; mid = { x: mx, y: (p1.y + p2.y) / 2 }; }
    else { const my = (p1.y + p2.y) / 2; d = `M${p1.x} ${p1.y} V${my} H${p2.x} V${p2.y}`; t1 = { x: p1.x, y: my }; t2 = { x: p2.x, y: my }; mid = { x: (p1.x + p2.x) / 2, y: my }; }
  } else {
    const k = clamp(dist * .4, 24, 220);
    const c1 = { x: p1.x + n1.x * k, y: p1.y + n1.y * k }, c2 = { x: p2.x + n2.x * k, y: p2.y + n2.y * k };
    d = `M${p1.x} ${p1.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`; t1 = c1; t2 = c2;
    mid = { x: .125 * p1.x + .375 * c1.x + .375 * c2.x + .125 * p2.x, y: .125 * p1.y + .375 * c1.y + .375 * c2.y + .125 * p2.y };
  }
  return { d, p1, p2, t1, t2, mid };
}
/** an arrowhead's outline at `tip`, pointing away from `from` */
export function headPath(tip: { x: number; y: number }, from: { x: number; y: number }, sw: number) {
  const u = norm(tip.x - from.x, tip.y - from.y), s = 7 + sw * 1.7;
  const bx = tip.x - u.x * s, by = tip.y - u.y * s, px = -u.y * s * .55, py = u.x * s * .55;
  return `M${tip.x} ${tip.y} L${bx + px} ${by + py} L${bx - px} ${by - py} Z`;
}

// ---------- stamps ----------
// The classic board stamped emoji. Tessera draws them instead (no emoji in the UI); a stamp still saves the same
// value it always did (its "emoji" field), so boards made before keep their stamps and old copies of the app read new ones.
// Each drawing is 48 × 48 with an ink outline, in the board's own colours.
const K = 'stroke="#1C1C1E" stroke-width="2.4" stroke-linejoin="round"';
const STAMP_ART: [key: string, name: string, art: string][] = [
  ['\u{1F44D}', 'Thumbs up', `<rect x="5" y="21" width="9" height="20" rx="2.5" fill="#1F7BFF" ${K}/><path d="M14 22 L19 21 C21 17 23 13 23.5 8.5 C23.8 6 26 5 27.8 6 C30.5 7.5 30.5 12 29.5 16 L28.6 20 L38 20 C40.5 20 42 21.8 41.8 24 C41.6 25.6 40.6 26.6 39.4 27 C40.8 27.6 41.6 29 41.4 30.6 C41.2 32.2 40 33.2 38.6 33.4 C39.6 34.2 40.1 35.4 39.8 36.8 C39.4 38.4 38 39.2 36.6 39.3 C37.2 40 37.4 41 37 42 C36.5 43.3 35.3 44 34 44 L22 44 C18.5 44 16.5 42.5 14 41 Z" fill="#FFC94D" ${K}/><path d="M31 27 H39.4 M31 33.4 H38.6 M31 39.3 H36.6" fill="none" stroke="#1C1C1E" stroke-width="2" stroke-linecap="round"/>`],
  ['❤️', 'Heart', `<path d="M24 41 C24 41 6 30 6 17.5 C6 11.5 10.5 7 16 7 C19.6 7 22.6 9 24 12 C25.4 9 28.4 7 32 7 C37.5 7 42 11.5 42 17.5 C42 30 24 41 24 41 Z" fill="#E5484D" ${K}/><path d="M12.5 17 C12.5 14 14.6 12 17.2 12" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>`],
  ['\u{1F525}', 'Fire', `<path d="M24 4 C26 11 34 14.5 36 23 C38 32 32 43 24 43 C15.5 43 10 36 11 27.5 C11.6 22 14.5 19 16.5 15.5 C17.5 19 19 21 21 22 C20.5 15 22 9 24 4 Z" fill="#FF8A00" ${K}/><path d="M24 22 C25 26 30 28 30 33.5 C30 37.5 27.4 40 24 40 C20.6 40 18 37.5 18 34 C18 30.5 20.5 28.5 21.5 26 C22.5 27.5 23.3 28 24 28.2 C23.5 26 23.4 24 24 22 Z" fill="#FFE14D"/>`],
  ['⭐', 'Star', `<path d="M24 6 L29 18.1 L42.1 19.1 L32.1 27.6 L35.2 40.4 L24 33.5 L12.8 40.4 L15.9 27.6 L5.9 19.1 L19 18.1 Z" fill="#FFD43B" ${K}/><path d="M17.5 21.5 L21.2 21.2" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`],
  ['✅', 'Done', `<rect x="6" y="6" width="36" height="36" rx="10" fill="#22A55B" ${K}/><path d="M14.5 24.5 L21 31 L33.5 17" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`],
  ['❌', 'No', `<path d="M12 12 L36 36 M36 12 L12 36" stroke="#1C1C1E" stroke-width="10.5" stroke-linecap="round"/><path d="M12 12 L36 36 M36 12 L12 36" stroke="#E5484D" stroke-width="6" stroke-linecap="round"/>`],
  ['❓', 'Question', `<circle cx="24" cy="24" r="18" fill="#7B61FF" ${K}/><path d="M18.5 19 C18.5 15.5 21 13.5 24 13.5 C27.2 13.5 29.5 15.6 29.5 18.6 C29.5 22.8 24 23.2 24 27.5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="34" r="2.6" fill="#fff"/>`],
  ['\u{1F389}', 'Celebrate', `<path d="M7 42 L17 15 L34 32 Z" fill="#FFC94D" ${K}/><path d="M11 31.2 L17.8 38 M14 23.1 L25.9 35" stroke="#FF4F96" stroke-width="2.6" stroke-linecap="round"/><path d="M24 12 C26 9 25 6.5 28 4.5 M36 22 C39 20.5 41 22 43.5 20 M29.5 15.5 L32 13" fill="none" stroke="#7B61FF" stroke-width="2.4" stroke-linecap="round"/><circle cx="34" cy="8.5" r="2.3" fill="#22A55B"/><circle cx="41" cy="31" r="2.3" fill="#1F7BFF"/><rect x="38" y="11" width="4.2" height="4.2" rx="1" transform="rotate(20 40 13)" fill="#FF8A00"/>`],
  ['\u{1F4A1}', 'Idea', `<path d="M24 5 C16.3 5 11 10.8 11 17.8 C11 22.6 13.4 25.7 16 28.4 C17.4 29.9 18 31.5 18 33.5 L30 33.5 C30 31.5 30.6 29.9 32 28.4 C34.6 25.7 37 22.6 37 17.8 C37 10.8 31.7 5 24 5 Z" fill="#FFE14D" ${K}/><path d="M20.5 24 L22.5 27 L24 23.5 L25.5 27 L27.5 24" fill="none" stroke="#FF8A00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="17.5" y="33.5" width="13" height="5" rx="1.5" fill="#B8B8C0" ${K}/><path d="M20 38.5 L21 42.5 H27 L28 38.5" fill="#8A8A90" ${K}/><path d="M16.5 16.5 C17 13 19.5 10.6 22.5 10.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`],
  ['\u{1F440}', 'Looking', `<ellipse cx="16" cy="24" rx="9" ry="13" fill="#fff" ${K}/><ellipse cx="32" cy="24" rx="9" ry="13" fill="#fff" ${K}/><circle cx="19" cy="27" r="4.6" fill="#1C1C1E"/><circle cx="35" cy="27" r="4.6" fill="#1C1C1E"/><circle cx="20.3" cy="25.4" r="1.4" fill="#fff"/><circle cx="36.3" cy="25.4" r="1.4" fill="#fff"/>`],
];
const plain = (k?: string) => (k || '').replace(/️/g, '');
const BY_KEY = new Map(STAMP_ART.map(([k, n, a]) => [plain(k), { key: k, name: n, art: a }]));
// a value no palette ever had (from a hand-edited file) shows as a plain seal
const SEAL = { key: '', name: 'Stamp', art: `<circle cx="24" cy="24" r="17" fill="#CFC2FF" ${K}/><circle cx="24" cy="24" r="9" fill="none" stroke="#1C1C1E" stroke-width="2.4"/>` };
export const STAMPS = STAMP_ART.map(([k]) => k);
export const stampOf = (k?: string) => BY_KEY.get(plain(k)) || SEAL;
