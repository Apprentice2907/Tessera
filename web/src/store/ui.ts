// Tessera · what the pages remember between visits (not saved), the toast, and the card that opens beside a click.
import type { ReactNode } from 'react';
import { create } from 'zustand';

// ---------- the toast: a short message above the page switcher ----------
export const useToast = create<{ msg: string; n: number }>(() => ({ msg: '', n: 0 }));
export const toast = (msg: string) => useToast.setState(s => ({ msg, n: s.n + 1 }));

// ---------- the card that opens next to what you clicked; Esc or a click outside closes it ----------
export interface PopState { anchor: HTMLElement | null; body: ReactNode; below: boolean; key: number }
export const usePop = create<PopState>(() => ({ anchor: null, body: null, below: false, key: 0 }));
export const openPop = (anchor: HTMLElement, body: ReactNode, below = false) => usePop.setState(s => ({ anchor, body, below, key: s.key + 1 }));
export const closePop = () => usePop.setState({ anchor: null, body: null });

// ---------- what each page remembers ----------
export interface UIMemory {
  // Today: the day shown, counted from today; the task just added or starred; New task's star and mode
  day: number; fresh: string | null; ntStar: boolean; ntMode: 'task' | 'update';
  // Hours: the brush, the new-category form (its colour), the category asking to be deleted
  brush: string; newCat: { pi: number } | null; catDel: string | null;
  // Calendar: the week shown, counted from this week; the small month, counted from this month; just added
  wk: number; mmOff: number; calFresh: string[] | null;
}
export const useUI = create<UIMemory>(() => ({
  day: 0, fresh: null, ntStar: false, ntMode: 'task',
  brush: 'code', newCat: null, catDel: null,
  wk: 0, mmOff: 0, calFresh: null,
}));
export const ui = () => useUI.getState();
export const setUI = (p: Partial<UIMemory>) => useUI.setState(p);

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
