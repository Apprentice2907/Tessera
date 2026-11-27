"""Tessera: the small local server for the app.

    python serve.py          then open http://localhost:5178

Serves the folder with caching turned off, and keeps one copy of the saved state (GET/POST /api/state into
.data/state.json), so the app in the browser and the desktop to-do widget (desktop/widget.pyw) share the same
tasks. It only listens on this computer.
"""
import functools
import http.server
import json
import os
import threading

PORT = 5178
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, '.data', 'state.json')
KEYS = {'lo.state.v1'}           # the only key the server keeps
LIMIT = 4 * 1024 * 1024          # a saved state is a few KB; anything this big is a mistake
_lock = threading.Lock()


def _read():
    try:
        with open(DATA, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _write(store):
    """Write to a temp file and swap it in, so a crash never leaves half a file."""
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    tmp = DATA + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(store, f)
    os.replace(tmp, DATA)


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

    def do_GET(self):
        if self.path.split('?')[0] == '/api/state':
            key = self.path.partition('key=')[2].split('&')[0] or 'lo.state.v1'
            if key not in KEYS:
                return self._json(400, {'error': 'unknown key'})
            with _lock:
                return self._json(200, {'key': key, 'value': _read().get(key)})
        return super().do_GET()

    def do_POST(self):
        if self.path.split('?')[0] != '/api/state':
            return self._json(404, {'error': 'not found'})
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > LIMIT:
            return self._json(413, {'error': 'too big'})
        try:
            msg = json.loads(self.rfile.read(n).decode('utf-8'))
        except ValueError:
            return self._json(400, {'error': 'not json'})
        key, value = msg.get('key'), msg.get('value')
        if key not in KEYS or not (value is None or isinstance(value, str)):
            return self._json(400, {'error': 'bad request'})
        with _lock:
            store = _read()
            if value is None:
                store.pop(key, None)
            else:
                store[key] = value
            _write(store)
        return self._json(200, {'ok': True})


class Server(http.server.ThreadingHTTPServer):
    # The app loads ~20 files at once. The default backlog of 5 makes Windows refuse the rest of the burst
    # (a missing script then breaks a page), so keep a deeper queue.
    request_queue_size = 64
    daemon_threads = True
    # On Windows, address reuse lets a second server bind the same port silently; fail loudly instead.
    allow_reuse_address = False


def make_server(port=PORT):
    return Server(('127.0.0.1', port), functools.partial(Handler, directory=ROOT))


if __name__ == '__main__':
    make_server().serve_forever()
