// Tessera · upcoming contests, for the copy of the app on Vercel (where there is no serve.py).
// The same three sources serve.py reads, in the same shape: { contests: [{ plat, title, start, end, url }] }, soonest
// first, times in ms. Vercel keeps the answer for half an hour. A site that's down or changed is skipped; the others
// still show. The app picks which ones are contests (store/contests.ts).
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Tessera/1.0' };
const get = async (url, body) => {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { ...UA, ...(body ? { 'Content-Type': 'application/json', Referer: 'https://leetcode.com/contest/' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
};

const codeforces = async () => (await get('https://codeforces.com/api/contest.list?gym=false')).result
  .filter(c => c.phase === 'BEFORE')
  .map(c => ({ plat: 'CF', title: c.name, start: c.startTimeSeconds * 1000, end: (c.startTimeSeconds + c.durationSeconds) * 1000, url: `https://codeforces.com/contestRegistration/${c.id}` }));

const codechef = async () => (await get('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all')).future_contests
  .map(c => ({ plat: 'CC', title: c.contest_name, start: Date.parse(c.contest_start_date_iso), end: Date.parse(c.contest_end_date_iso), url: `https://www.codechef.com/${c.contest_code}` }));

const leetcode = async () => (await get('https://leetcode.com/graphql', { query: '{ upcomingContests { title titleSlug startTime duration } }' })).data.upcomingContests
  .map(c => ({ plat: 'LC', title: c.title, start: c.startTime * 1000, end: (c.startTime + c.duration) * 1000, url: `https://leetcode.com/contest/${c.titleSlug}` }));

export default async function handler(req, res) {
  const lists = await Promise.allSettled([codeforces(), codechef(), leetcode()]);
  const contests = lists.flatMap(l => (l.status === 'fulfilled' ? l.value : [])).sort((a, b) => a.start - b.start);
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
  res.status(200).json({ contests });
}
