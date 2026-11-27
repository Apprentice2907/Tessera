"""Tessera: the to-do widget on the Windows desktop.

A small borderless card at the bottom left of the desktop (under the wallpaper's quote), behind your other
windows, with no taskbar button. It shows widget.html?desk (widget/widget.js) from the local Tessera server, which it starts if it
isn't running already, so it shares the app's tasks: tick something here and it's ticked in the browser, and the
other way round.

  Move it:   drag its top edge. The spot is remembered in widget-position.json (delete that file to reset it).
  Close it:  hover it and click the x. It comes back the next time you sign in to Windows.

The "Tessera widget" shortcut in your Startup folder runs this with pythonw, so there's no console window.
Anything that goes wrong is written to widget.log next to this file.
"""
import ctypes
import json
import logging
import os
import socket
import sys
import threading
import time
import webbrowser
from ctypes import wintypes

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
logging.basicConfig(filename=os.path.join(HERE, 'widget.log'), level=logging.INFO, format='%(asctime)s %(message)s')

# physical pixels everywhere, so the widget lands in the same place at any display scale
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:  # older Windows, or already set
    pass

import serve  # noqa: E402
import webview  # noqa: E402

PORT = serve.PORT
URL = f'http://localhost:{PORT}/widget.html?desk'
TITLE = 'Tessera widget'
W, H = 330, 456              # size at 100% display scale; it grows with your scale setting
MARGIN_X, MARGIN_Y = 28, 34  # from the left edge and from the taskbar
SPOT = os.path.join(HERE, 'widget-position.json')

# a private handle on user32: the argument types set below must not leak into pywebview's own calls (they broke its window moves)
user32 = ctypes.WinDLL('user32')
HWND_BOTTOM = 1
SWP_NOSIZE, SWP_NOMOVE, SWP_NOZORDER, SWP_NOACTIVATE = 0x1, 0x2, 0x4, 0x10
GWL_EXSTYLE, WS_EX_TOOLWINDOW, WS_EX_APPWINDOW = -20, 0x80, 0x40000
user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_uint]
user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
user32.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]
user32.FindWindowW.restype = wintypes.HWND
user32.GetWindow.restype = wintypes.HWND
user32.GetWindow.argtypes = [wintypes.HWND, ctypes.c_uint]
# region handles are 64-bit: without these types they get cut to 32 bits, Windows rejects them, and the corners stay square
gdi32 = ctypes.WinDLL('gdi32')
gdi32.CreateRoundRectRgn.restype = wintypes.HRGN
gdi32.CreateRoundRectRgn.argtypes = [ctypes.c_int] * 6
user32.SetWindowRgn.restype = ctypes.c_int
user32.SetWindowRgn.argtypes = [wintypes.HWND, wintypes.HRGN, wintypes.BOOL]
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.GetDpiForWindow.argtypes = [wintypes.HWND]
RADIUS = 22  # the card's corner radius, the same as the CSS


def to_desktop(hwnd):
    """Just above the desktop (Program Manager): behind every window, but never under the wallpaper."""
    if not hwnd:
        return
    prog = user32.FindWindowW('Progman', None)
    above = user32.GetWindow(prog, 3) if prog else None  # GW_HWNDPREV: the window directly above the desktop
    if above == hwnd:
        return
    user32.SetWindowPos(hwnd, above or HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE)


def round_corners(hwnd):
    """Cut the window to the card's rounded shape, so the wallpaper shows at the corners."""
    r = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    w, h = r.right - r.left, r.bottom - r.top
    d = round(2 * RADIUS * (user32.GetDpiForWindow(hwnd) or 96) / 96)
    user32.SetWindowRgn(hwnd, gdi32.CreateRoundRectRgn(0, 0, w + 1, h + 1, d, d), True)


def server_up():
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(('127.0.0.1', PORT)) == 0


def ensure_server():
    """Use the Tessera server if it's already running (e.g. you have the app open); otherwise run one here."""
    if server_up():
        return
    srv = serve.make_server(PORT)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    for _ in range(60):
        if server_up():
            return
        time.sleep(0.05)


def work_area():
    r = wintypes.RECT()
    user32.SystemParametersInfoW(0x30, 0, ctypes.byref(r), 0)  # SPI_GETWORKAREA: the desktop minus the taskbar
    return r


def place(hwnd):
    scale = (user32.GetDpiForWindow(hwnd) or 96) / 96
    w, h = round(W * scale), round(H * scale)
    wa = work_area()
    try:
        with open(SPOT, encoding='utf-8') as f:
            s = json.load(f)
        if s.get('w') and s.get('h'):  # the size you dragged it to, kept on screen
            w, h = min(int(s['w']), wa.right - wa.left), min(int(s['h']), wa.bottom - wa.top)
    except (OSError, ValueError, KeyError, TypeError):
        s = {}
    x, y = wa.left + round(MARGIN_X * scale), wa.bottom - h - round(MARGIN_Y * scale)
    try:
        if wa.left - w // 2 <= s['x'] <= wa.right - 60 and wa.top <= s['y'] <= wa.bottom - 60:
            x, y = int(s['x']), int(s['y'])
    except (KeyError, TypeError):
        pass
    user32.SetWindowPos(hwnd, None, x, y, w, h, SWP_NOACTIVATE)
    round_corners(hwnd)
    to_desktop(hwnd)


def remember(hwnd):
    r = wintypes.RECT()
    if hwnd and user32.GetWindowRect(hwnd, ctypes.byref(r)):
        with open(SPOT, 'w', encoding='utf-8') as f:
            json.dump({'x': r.left, 'y': r.top, 'w': r.right - r.left, 'h': r.bottom - r.top}, f)


class Api:
    """What the widget page can ask for (window.pywebview.api.*). Underscored fields stay on this side."""

    def __init__(self):
        self._hwnd = None
        self._window = None

    def open_app(self, page='today'):
        webbrowser.open(f'http://localhost:{PORT}/#{page}')

    def sink(self):
        """Back behind the other windows, where a desktop widget lives."""
        if self._hwnd:
            to_desktop(self._hwnd)
            remember(self._hwnd)

    # dragging and resizing, from the page: screen pixels (the page has already multiplied by the display scale)
    def move_to(self, x, y):
        if self._hwnd:
            user32.SetWindowPos(self._hwnd, None, int(x), int(y), 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE)

    def resize(self, w, h):
        if self._hwnd:
            user32.SetWindowPos(self._hwnd, None, 0, 0, int(w), int(h), SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE)
            round_corners(self._hwnd)

    def settle_down(self):
        """A move or resize just ended: keep the new spot and size."""
        if self._hwnd:
            round_corners(self._hwnd)
            remember(self._hwnd)

    def close(self):
        remember(self._hwnd)
        self._window.destroy()


def settle(api):
    """Once the window exists: no taskbar button or Alt+Tab entry, put it in its spot, behind everything."""
    hwnd = None
    for _ in range(50):
        hwnd = user32.FindWindowW(None, TITLE)
        if hwnd:
            break
        time.sleep(0.1)
    if not hwnd:
        logging.info('widget window not found')
        return
    api._hwnd = hwnd
    user32.ShowWindow(hwnd, 0)  # hide while the style changes, so the taskbar drops its button
    ex = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
    user32.SetWindowLongW(hwnd, GWL_EXSTYLE, (ex | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW)
    place(hwnd)
    user32.ShowWindow(hwnd, 4)  # SW_SHOWNOACTIVATE
    api.sink()


def main():
    ensure_server()
    api = Api()
    window = webview.create_window(
        TITLE, URL, js_api=api, width=W, height=H,
        frameless=True, transparent=True, easy_drag=False, resizable=False, on_top=False,
    )
    api._window = window
    window.events.shown += lambda: threading.Thread(target=settle, args=(api,), daemon=True).start()

    # the page finishing loading brings the window forward again: settle it back a moment later
    def after_load():
        for wait in (0.3, 1.2, 3):
            time.sleep(wait)
            if api._hwnd:
                round_corners(api._hwnd)
                to_desktop(api._hwnd)
    window.events.loaded += lambda: threading.Thread(target=after_load, daemon=True).start()
    window.events.moved += lambda *_: remember(api._hwnd)
    webview.start(gui='edgechromium', private_mode=False, storage_path=os.path.join(HERE, '.webview'))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        logging.exception('the widget stopped')
        raise
