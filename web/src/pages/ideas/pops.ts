// Tessera · Ideas board — what floats over the canvas: one pop-up card at a time (menus, the options card, comment
// threads, link and label forms), a dialog, a tool's options above the toolbar, and the boards drawer.
// Plain state plus emit('ui'); the React parts in BoardUI.tsx draw whatever is open.
import { WB, emit, toScreen } from './core';
import type { Tool } from './types';

export type PopKind = 'props' | 'nav' | 'zoom' | 'export' | 'folder' | 'cmenu' | 'thread' | 'newc' | 'link' | 'label';
export interface At { x: number; y: number }
export interface PopSpec {
  kind: PopKind; n: number;
  key?: string | null;                          // opening the same key again closes it
  x?: number; y?: number;                       // screen point, or
  anchor?: HTMLElement | null; place?: 'below' | 'below-right' | 'above';
  id?: string;                                  // the object it is about (thread, label, folder's board)
  at?: At;                                      // the world point it is about (new comment, link, paste here)
  board?: boolean;                              // the options card for the board itself
}
export type ModalSpec =
  | { kind: 'confirm'; n: number; title: string; ok: string; danger: boolean; sub: string; done: (v: boolean) => void }
  | { kind: 'ask'; n: number; title: string; value: string; ok: string; placeholder: string; done: (v: string | null) => void }
  | { kind: 'templates'; n: number };

export const UI = {
  pop: null as PopSpec | null,
  openKey: null as string | null,
  modal: null as ModalSpec | null,
  fly: null as Tool | null,                     // the tool whose options show above the toolbar
  drawer: false, dq: '',
  fmt: 'png' as 'png' | 'svg' | 'pdf', scope: 'board' as 'board' | 'sel',
  go: (page: string) => { location.hash = '#/' + page; },   // set by the page to the router's navigate
};
let n = 0;
const changed = () => emit('ui');

export function closePops() {
  if (!UI.pop && !UI.fly && !UI.openKey) return;
  UI.pop = null; UI.fly = null; UI.openKey = null; changed();
}
/** open a card; with a key, opening it again while it shows closes it instead */
export function pop(spec: Omit<PopSpec, 'n'>) {
  const again = spec.key && UI.openKey === spec.key;
  UI.pop = null; UI.fly = null; UI.openKey = null;
  if (!again) { UI.pop = { ...spec, n: ++n }; UI.openKey = spec.key || null; }
  changed();
  return !again;
}
export function closeModal() { if (UI.modal) { UI.modal = null; changed(); } }
export function confirmBox(title: string, ok = 'Delete', danger = true, sub = '') {
  return new Promise<boolean>(done => { UI.pop = null; UI.openKey = null; UI.modal = { kind: 'confirm', n: ++n, title, ok, danger, sub, done }; changed(); });
}
export function ask(title: string, value = '', ok = 'Save', placeholder = '') {
  return new Promise<string | null>(done => { UI.pop = null; UI.openKey = null; UI.modal = { kind: 'ask', n: ++n, title, value, ok, placeholder, done }; changed(); });
}
export function templates() { if (!WB.board) return; UI.pop = null; UI.openKey = null; UI.modal = { kind: 'templates', n: ++n }; changed(); }
export function toggleDrawer() { UI.drawer = !UI.drawer; changed(); }
export function setFly(t: Tool | null) { UI.fly = t; changed(); }

// ---------- the cards ----------
export const thread = (id: string) => { const o = WB.objs[id]; if (!o) return; const s = toScreen(o.x + o.w, o.y); pop({ kind: 'thread', id, x: s.x + 12, y: s.y - 8 }); };
export const newComment = (at: At, sx: number, sy: number) => pop({ kind: 'newc', at, x: sx + 14, y: sy - 22 });
export const linkInput = (at: At, sx: number, sy: number) => pop({ kind: 'link', at, x: sx, y: sy });
export const lineLabel = (id: string, sx: number, sy: number) => pop({ kind: 'label', id, x: sx - 120, y: sy + 12 });
/** the options card for what is selected: from the selection bar's "More", or a double-click */
export const more = (anchor: HTMLElement | null, x?: number, y?: number) => { if (WB.sel.size) pop({ kind: 'props', anchor, x, y, key: anchor ? 'more' : null }); };
export const boardOptions = (x: number, y: number) => pop({ kind: 'props', x, y, board: true });
export const ctxMenu = (x: number, y: number, id: string | null, at: At) => pop({ kind: 'cmenu', x, y, id: id || undefined, at });
export const navMenu = (anchor: HTMLElement) => pop({ kind: 'nav', anchor, place: 'above', key: 'nav' });
export const zoomPop = (anchor: HTMLElement) => pop({ kind: 'zoom', anchor, key: 'zoom' });
export const exportPop = (anchor: HTMLElement) => pop({ kind: 'export', anchor, place: 'below-right', key: 'export' });
export const folderPop = (anchor: HTMLElement, id: string) => pop({ kind: 'folder', anchor, id, key: 'folder' + id });
