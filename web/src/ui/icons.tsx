// Tessera · the few line icons the app uses (drawn, not emoji).
export const Check = () => <svg viewBox="0 0 14 14"><path d="M2.5 7.5 L5.8 10.5 L11.5 3.8" /></svg>;
export const Tick = () => <svg viewBox="0 0 12 12"><path d="M2.5 6.3 L5 8.6 L9.5 3.6" /></svg>;
export const XIcon = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>;
export const Star = () => <svg viewBox="0 0 16 16"><path d="M8 1.7l1.93 3.92 4.32.63-3.13 3.05.74 4.3L8 11.57l-3.86 2.03.74-4.3L1.75 6.25l4.32-.63z" /></svg>;
const line = (d: string) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
export const Left = () => line('M10 3.5 5.5 8l4.5 4.5');
export const Right = () => line('M6 3.5 10.5 8 6 12.5');
export const Plus = () => line('M8 3v10M3 8h10');
export const Del = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M3 3l6 6M9 3 3 9" /></svg>;
export const Arrow = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 3 4.5 7l4 4" /></svg>;
export const Pencil = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z" /></svg>;
export const Bin = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></svg>;
