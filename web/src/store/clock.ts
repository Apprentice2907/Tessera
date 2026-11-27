// Tessera · the clock: today, its day number, and the time now in hours (14.5 is 2:30 PM).
// It reads this device's clock, which Windows keeps in step with internet time. Pages subscribe to what they show:
// T (moves on at midnight) or the minute (pages that show the time of day).
import { create } from 'zustand';
import { dayIdx, midnight } from '../lib/dates';

interface Clock { today: Date; T: number; nowH: number; minute: number }
const read = (): Clock => {
  const now = new Date(), today = midnight(now), nowH = now.getHours() + now.getMinutes() / 60;
  return { today, T: dayIdx(today), nowH, minute: Math.floor(nowH * 60) };
};
export const useClock = create<Clock>(() => read());
export const clock = () => useClock.getState();

/** reads the clock again; returns true when the day changed */
export function tickClock() {
  const was = clock(), next = read();
  if (next.minute === was.minute && next.T === was.T) return false;
  useClock.setState(next.T === was.T ? { nowH: next.nowH, minute: next.minute } : next);
  return next.T !== was.T;
}

/** day numbers of this month so far: the 1st up to today */
export const monthSoFar = (T: number, today: Date) => Array.from({ length: today.getDate() }, (_, i) => T - today.getDate() + 1 + i);
