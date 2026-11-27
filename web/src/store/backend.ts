// Tessera · where a copy of your data lives besides the page itself, and where contests come from.
//   In the desktop app (Tauri): the app's own side (src-tauri/src/lib.rs), through its commands.
//   In a browser on this computer: serve.py, through /api/... (the same calls, the same answers).
//   Anywhere else (the copy on Vercel): no copy, only contests (web/api/contests.js).
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

export const inApp = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
// serve.py only ever listens on this computer, so a copy opened from anywhere else doesn't ask it
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
/** is there somewhere to keep a copy */
export const hasStore = inApp || LOCAL;

/** in the desktop app, a link to the web (a contest, a site) opens in your browser instead of inside the app */
export function openLinksOutside() {
  if (!inApp) return;
  document.addEventListener('click', e => {
    const a = (e.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || !/^(https?:|mailto:)/.test(a.href) || a.origin === location.origin) return;
    e.preventDefault();
    openUrl(a.href);
  }, true);
}

export interface BackupList { backups: { name: string; keys: number; bytes: number }[]; keep: number; folder: string }
export interface RawContest { plat: string; title: string; start: number; end: number; url: string }

async function getJSON<T>(url: string): Promise<T> { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
async function postJSON<T>(url: string, body: unknown, keepalive = false): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export const backend = {
  /** one key's saved text, or null */
  get: (key: string) => (inApp ? invoke<string | null>('state_get', { key }) : getJSON<{ value: string | null }>('api/state?key=' + key).then(j => j.value)),
  /** every key that starts with prefix */
  all: (prefix: string) => (inApp ? invoke<Record<string, string | null>>('state_all', { prefix }) : getJSON<{ keys: Record<string, string | null> }>('api/state?prefix=' + prefix).then(j => j.keys)),
  /** save one key (null deletes it) */
  set: (key: string, value: string | null) => (inApp ? invoke<void>('state_set', { key, value }) : postJSON('api/state', { key, value }, !value || value.length < 60000).then(() => {})),
  backups: () => (inApp ? invoke<BackupList>('backups_list') : getJSON<BackupList>('api/backups')),
  /** a copy of everything now; the name of the copy */
  backupNow: (label?: string) => (inApp ? invoke<string | null>('backup_now', { label: label ?? null }) : postJSON<{ name: string | null }>('api/backups', label ? { label } : {}).then(j => j.name)),
  contests: () => (inApp ? invoke<RawContest[]>('contests') : getJSON<{ contests: RawContest[] }>('api/contests').then(j => j.contests)),
};
