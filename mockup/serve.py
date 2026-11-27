"""Tessera: the small local server for the app.

    python serve.py          then open http://localhost:5178

It serves the app (the React build in ../web/dist: `npm install` and `npm run build` in web/) with caching turned off,
and keeps your data on this computer:

  /api/state      one JSON file per key in .data/store/: the app's state, the walls, the ideas boards
  /api/backups    a copy of everything, made before the first change of each day (and whenever you ask);
                  the last 60 are kept in .data/backups/
  /api/contests   upcoming Codeforces, CodeChef and LeetCode contests, fetched and kept for half an hour

It only listens on this computer. `python serve.py 5199 some/folder` runs a second copy on its own port with its own data.
"""
import datetime
import functools
import http.server
import json
import os
import re
import shutil
import threading
import time
import urllib.request

PORT = 5178
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, '.data')
STORE = os.path.join(DATA, 'store')
BACKUPS = os.path.join(DATA, 'backups')
KEEP = 60                                   # backups kept
KEY = re.compile(r'^tessera\.[a-z0-9._-]{1,80}$')
LIMIT = 64 * 1024 * 1024                    # walls carry photos, so a key can be a few MB
WEB = os.path.join(os.path.dirname(ROOT), 'web', 'dist')   # the app, as `npm run build` in web/ makes it
_lock = threading.Lock()
NOT_BUILT = (b'<!doctype html><meta charset="utf-8"><title>Tessera</title><body style="font:16px system-ui;margin:40px">'
             b'<b>Tessera isn\'t built yet.</b><p>In the web folder run <code>npm install</code>, then <code>npm run build</code>, '
             b'and reload. Your data is safe in mockup/.data.</p>')


# ---------- the store: one file per key ----------
def _file(key):
    return os.path.join(STORE, key + '.json')


def read(key):
    try:
        with open(_file(key), encoding='utf-8') as f:
            return f.read()
    except OSError:
        return None


def read_all(prefix='tessera.'):
    out = {}
    if os.path.isdir(STORE):
        for name in sorted(os.listdir(STORE)):
            key = name[:-5]
            if name.endswith('.json') and key.startswith(prefix) and KEY.match(key):
                out[key] = read(key)
    return out


def write(key, value):
    """Write to a temp file and swap it in, so a crash never leaves half a file. None deletes the key."""
    os.makedirs(STORE, exist_ok=True)
    daily_backup()
    path = _file(key)
    if value is None:
        if os.path.exists(path):
            os.remove(path)
        return
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(value)
    os.replace(tmp, path)


# ---------- backups: a folder per copy, named by when it was made ----------
def backups():
    if not os.path.isdir(BACKUPS):
        return []
    out = []
    for name in sorted(os.listdir(BACKUPS), reverse=True):
        path = os.path.join(BACKUPS, name)
        if os.path.isdir(path):
            files = [f for f in os.listdir(path) if f.endswith('.json')]
            out.append({'name': name, 'keys': len(files), 'bytes': sum(os.path.getsize(os.path.join(path, f)) for f in files)})
    return out


def backup(name):
    """Copy every key into backups/<name>, then drop the oldest copies past KEEP."""
    if not os.path.isdir(STORE) or not os.listdir(STORE):
        return None
    dest = os.path.join(BACKUPS, name)
    if os.path.exists(dest):
        return name
    shutil.copytree(STORE, dest, ignore=shutil.ignore_patterns('*.tmp'))
    for old in sorted(os.listdir(BACKUPS))[:-KEEP]:
        shutil.rmtree(os.path.join(BACKUPS, old), ignore_errors=True)
    return name


def daily_backup():
    """Before the first change of a day, keep a copy of how everything stood (the end of the last day you used it)."""
    today = datetime.date.today().isoformat()
    if os.path.isdir(BACKUPS) and any(n.startswith(today) for n in os.listdir(BACKUPS)):
        return
    backup(today)


# ---------- upcoming contests, from the sites' public APIs ----------
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Tessera/1.0'}
_contests = {'at': 0, 'list': []}


def _get(url, body=None):
    req = urllib.request.Request(url, data=body, headers={**UA, **({'Content-Type': 'application/json', 'Referer': 'https://leetcode.com/contest/'} if body else {})})
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read().decode('utf-8'))


def _codeforces():
    d = _get('https://codeforces.com/api/contest.list?gym=false')
    return [{'plat': 'CF', 'title': c['name'], 'start': c['startTimeSeconds'] * 1000, 'end': (c['startTimeSeconds'] + c['durationSeconds']) * 1000,
             'url': f"https://codeforces.com/contestRegistration/{c['id']}"} for c in d.get('result', []) if c.get('phase') == 'BEFORE']


def _codechef():
    d = _get('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all')
    when = lambda s: int(datetime.datetime.fromisoformat(s).timestamp() * 1000)
    return [{'plat': 'CC', 'title': c['contest_name'], 'start': when(c['contest_start_date_iso']), 'end': when(c['contest_end_date_iso']),
             'url': f"https://www.codechef.com/{c['contest_code']}"} for c in d.get('future_contests', [])]


def _leetcode():
    d = _get('https://leetcode.com/graphql', json.dumps({'query': '{ upcomingContests { title titleSlug startTime duration } }'}).encode())
    return [{'plat': 'LC', 'title': c['title'], 'start': c['startTime'] * 1000, 'end': (c['startTime'] + c['duration']) * 1000,
             'url': f"https://leetcode.com/contest/{c['titleSlug']}"} for c in d['data']['upcomingContests']]


def contests():
    with _lock:
        if time.time() - _contests['at'] < 1800:
            return _contests['list']
    out = []
    for fetch in (_codeforces, _codechef, _leetcode):
        try:
            out += fetch()
        except Exception:  # a site that's down or changed: the others still show
            pass
    out.sort(key=lambda c: c['start'])
    with _lock:
        _contests.update(at=time.time(), list=out)
    return out


# ---------- HTTP ----------
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _query(self):
        q = self.path.partition('?')[2]
        return dict(p.split('=', 1) for p in q.split('&') if '=' in p)

    def do_GET(self):
        route = self.path.split('?')[0]
        if route == '/api/state':
            q = self._query()
            if 'prefix' in q:
                with _lock:
                    return self._json(200, {'keys': read_all(q['prefix'])})
            key = q.get('key', '')
            if not KEY.match(key):
                return self._json(400, {'error': 'unknown key'})
            with _lock:
                return self._json(200, {'key': key, 'value': read(key)})
        if route == '/api/backups':
            with _lock:
                return self._json(200, {'backups': backups(), 'keep': KEEP, 'folder': BACKUPS})
        if route == '/api/contests':
            return self._json(200, {'contests': contests()})
        if not os.path.isfile(os.path.join(WEB, 'index.html')):
            self.send_response(503)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(NOT_BUILT)))
            self.end_headers()
            return self.wfile.write(NOT_BUILT)
        if route.startswith('/.data') or route.endswith(('.py', '.pyw')):
            return self._json(404, {'error': 'not found'})  # your data and the server code are never served
        return super().do_GET()

    def do_POST(self):
        route = self.path.split('?')[0]
        n = int(self.headers.get('Content-Length') or 0)
        if n > LIMIT:
            return self._json(413, {'error': 'too big'})
        try:
            msg = json.loads(self.rfile.read(n).decode('utf-8')) if n else {}
        except ValueError:
            return self._json(400, {'error': 'not json'})
        if route == '/api/state':
            key, value = msg.get('key'), msg.get('value')
            if not isinstance(key, str) or not KEY.match(key) or not (value is None or isinstance(value, str)):
                return self._json(400, {'error': 'bad request'})
            with _lock:
                write(key, value)
            return self._json(200, {'ok': True})
        if route == '/api/backups':
            label = re.sub(r'[^a-z0-9-]', '', str(msg.get('label', ''))[:24])
            name = datetime.datetime.now().strftime('%Y-%m-%d %H%M%S') + (f' {label}' if label else '')
            with _lock:
                made = backup(name)
            return self._json(200, {'ok': True, 'name': made})
        return self._json(404, {'error': 'not found'})


class Server(http.server.ThreadingHTTPServer):
    # The app loads ~20 files at once. The default backlog of 5 makes Windows refuse the rest of the burst
    # (a missing script then breaks a page), so keep a deeper queue.
    request_queue_size = 64
    daemon_threads = True
    # On Windows, address reuse lets a second server bind the same port silently; fail loudly instead.
    allow_reuse_address = False


def make_server(port=PORT):
    return Server(('127.0.0.1', port), functools.partial(Handler, directory=WEB))


if __name__ == '__main__':
    # python serve.py [port] [data folder]: a second copy for testing runs on its own port with its own data
    import sys
    if len(sys.argv) > 2:
        DATA = os.path.abspath(sys.argv[2])
        STORE, BACKUPS = os.path.join(DATA, 'store'), os.path.join(DATA, 'backups')
    make_server(int(sys.argv[1]) if len(sys.argv) > 1 else PORT).serve_forever()
