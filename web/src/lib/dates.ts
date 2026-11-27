// Tessera · dates and the calendar helpers.
//
// Days are numbered from a fixed Monday, EPOCH: day 0 is Mon 16 Nov 2026, day 11 is Fri 27 Nov 2026, day −1 is the
// Sunday before. A number always means the same date, so saved ticks and notes stay on their day, and every week
// starts on a multiple of 7.
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MON3 = MONTHS.map(m => m.slice(0, 3));

export const EPOCH = new Date(2026, 10, 16);
export function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const dateOf = (D: number) => addDays(EPOCH, D);
// rounding absorbs the 23- and 25-hour days of clock changes
export const dayIdx = (d: Date) => Math.round((+midnight(d) - +EPOCH) / 864e5);
export const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const keyOf = (D: number) => dkey(dateOf(D));
export const fromKey = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const weekStart = (D: number) => D - (((D % 7) + 7) % 7); // the Monday of D's week
export const shortDate = (D: number) => { const d = dateOf(D); return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MON3[d.getMonth()]}`; };
export const dayLabel = (D: number) => { const d = dateOf(D); return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`; };

export function fmtHour(h: number) { const hh = ((h + 11) % 12) + 1; return `${hh} ${h < 12 || h === 24 ? 'AM' : 'PM'}`; }
export function fmtTime(t: number) { const h = Math.floor(t), m = Math.round((t - h) * 60), hh = ((h + 11) % 12) + 1; return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; }
export const toHHMM = (t: number) => String(Math.floor(t)).padStart(2, '0') + ':' + String(Math.round((t % 1) * 60)).padStart(2, '0');
export const fromHHMM = (v: string) => { const [h, m] = v.split(':').map(Number); return h + (m || 0) / 60; };

export function monthKey(d: Date) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
export function monthLabel(k: string) { const [y, m] = k.split('-'); return MONTHS[+m - 1] + ' ' + y; }
export function daySummary(arr: number[]) { if (arr.length === 7) return 'Every day'; if (!arr.length) return 'Off'; return [1, 2, 3, 4, 5, 6, 0].filter(x => arr.includes(x)).map(x => DAY_NAMES[x]).join(', '); }

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// "1 h 20 min", "45 min"
export const inHM = (h: number) => { const m = Math.max(0, Math.round(h * 60)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`; };
