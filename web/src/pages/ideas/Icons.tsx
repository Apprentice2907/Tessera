// Tessera · Ideas board — its line icons (20 × 20, drawn, not emoji), shape icons and the drawn stamps.
// The icon outlines are fixed strings from this file, so they go in as markup.
import { shapePath, stampOf } from './draw';

export function Ic({ d, s = 20 }: { d: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />;
}
export const ICON = {
  select: '<path d="M5 3 L16 9 L10.6 10.6 L9 16 Z"/>',
  hand: '<path d="M7 10V5a1.3 1.3 0 0 1 2.6 0v4.5M9.6 9V3.8a1.3 1.3 0 0 1 2.6 0V9M12.2 9.5V5.5a1.3 1.3 0 0 1 2.6 0V12a5 5 0 0 1-5 5h-.6a5 5 0 0 1-4-2l-2.3-3.2a1.3 1.3 0 0 1 2-1.6L7 11"/>',
  text: '<path d="M4 5h12M10 5v11M7.5 16h5"/>',
  shape: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="13.5" cy="13.5" r="3.8"/>',
  line: '<path d="M4 16 C4 9 9 5 16 5"/><path d="M12.5 2.5 16 5l-3 3"/>',
  pen: '<path d="M13.5 3.5l3 3L7 16H4v-3z"/><path d="M11.5 5.5l3 3"/>',
  hl: '<path d="M12 3l5 5-6.5 6.5-5-5z"/><path d="M5.5 9.5 3 15h3l2-2"/><path d="M3 18h14"/>',
  section: '<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h6V4"/>',
  stamp: '<circle cx="10" cy="5.5" r="2.7"/><path d="M8.6 8.2 8 11.5h4l-.6-3.3M4 11.5h12V14H4zM5.5 17h9"/>',
  comment: '<path d="M10 3.5a6.5 6.5 0 1 1-5.6 9.8L3 17l3.6-1.2A6.5 6.5 0 0 1 10 3.5z"/>',
  link: '<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/>',
  upload: '<path d="M10 13V3.5M6 7l4-4 4 4"/><path d="M3.5 13v2.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V13"/>',
  templates: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/>',
  undo: '<path d="M7 5 3.5 8.5 7 12"/><path d="M3.5 8.5H12a4.5 4.5 0 0 1 0 9H9"/>',
  redo: '<path d="M13 5l3.5 3.5L13 12"/><path d="M16.5 8.5H8a4.5 4.5 0 0 0 0 9h3"/>',
  boards: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12"/>',
  minus: '<path d="M5 10h10"/>', plus: '<path d="M10 5v10M5 10h10"/>', fit: '<path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4"/>',
  dup: '<rect x="7" y="7" width="9" height="9" rx="2"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/>',
  trash: '<path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6"/>',
  more: '<circle cx="5" cy="10" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/>',
  x: '<path d="M5 5l10 10M15 5 5 15"/>', check: '<path d="M4.5 10.5 8 14l7.5-8"/>', send: '<path d="M3.5 10 16.5 4l-4 13-3-5.5z"/>',
  export: '<path d="M10 3v10M6 9l4 4 4-4"/><path d="M3.5 14v1.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V14"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.5 2h6A1.5 1.5 0 0 1 17 8.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"/>',
  edit: '<path d="M12.5 4.5l3 3L8 15H5v-3z"/>', open: '<path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8"/>',
  arrowNone: '<path d="M3.5 10h13"/>', arrowEnd: '<path d="M3.5 10h12.5M12 6l4 4-4 4"/>', arrowBoth: '<path d="M4 10h12M8 6l-4 4 4 4M12 6l4 4-4 4"/>',
  up: '<path d="M6 12.5 10 8.5l4 4"/>',
};
export const AL: Record<string, string> = {
  l: '<path d="M3 3v14M6 6h9M6 12h6"/>', c: '<path d="M10 3v14M5 6h10M7 12h6"/>', r: '<path d="M17 3v14M5 6h9M8 12h6"/>',
  t: '<path d="M3 3h14M6 6v9M12 6v6"/>', m: '<path d="M3 10h14M6 5v10M12 7v6"/>', b: '<path d="M3 17h14M6 5v9M12 8v6"/>',
  dh: '<path d="M3 3v14M17 3v14M8 7v6M12 7v6"/>', dv: '<path d="M3 3h14M3 17h14M7 8h6M7 12h6"/>',
};
export function ShapeIcon({ k }: { k?: string }) {
  const p = ({ rect: '<rect x="3" y="4" width="14" height="12"/>', round: '<rect x="3" y="4" width="14" height="12" rx="4"/>', ellipse: '<ellipse cx="10" cy="10" rx="7" ry="6"/>' } as Record<string, string>)[k || 'rect'];
  return <Ic d={p || `<path d="${shapePath(k, 14, 13)}" transform="translate(3 3.5)"/>`} />;
}
/** a stamp, drawn; s is its size in px (or 100% to fill its box) */
export function StampArt({ k, s = 24 }: { k?: string; s?: number | string }) {
  const st = stampOf(k);
  return <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: st.art }} />;
}
// the app's pages: the first toolbar button lists them (keys 1–7 go there too)
export const APP: [id: string, name: string, icon: string][] = [
  ['home', 'Home', '<path d="M3.5 9 10 3.5 16.5 9v7.5h-13z"/><path d="M8 16.5v-4h4v4"/>'],
  ['today', 'Today', '<rect x="3.5" y="3.5" width="13" height="13" rx="3"/><path d="M7 10.2 9.2 12.4 13.2 7.8"/>'],
  ['hours', 'Hours', '<circle cx="10" cy="10" r="6.8"/><path d="M10 6.3V10l2.6 1.7"/>'],
  ['calendar', 'Calendar', '<rect x="3.5" y="4.5" width="13" height="12" rx="2.5"/><path d="M3.5 8.5h13M7 3v3M13 3v3"/>'],
  ['ideas', 'Ideas board', '<path d="M4 4h12v8l-4 4H4z"/><path d="M12 16v-4h4"/>'],
  ['wall', 'Memory wall', '<path d="M10 11.5v6M6.5 3.5h7l-1 4 2.5 3h-10l2.5-3z"/>'],
  ['review', 'Review files', '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.5 2h6A1.5 1.5 0 0 1 17 8.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"/>'],
];
