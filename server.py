"""Loopback-only arena server. Serves an explicit public-file list, never the folder."""
import argparse
import json
import socket
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
CATALOG = {g['id']: g for g in json.loads((ROOT / 'catalog.json').read_text(encoding='utf-8'))}
PUBLIC_FILES = {'index.html', 'overlay.html', 'style.css', 'app.js', 'tikfinity.mjs',
                'gift-rules.mjs', 'security.mjs', 'catalog.json'} | {g['image'] for g in CATALOG.values()}
MAX_BODY = 16384
MAX_INTEGER = 9007199254740991


def number(value, low, high):
    return type(value) is int and low <= value <= high


def text(value, limit):
    if not isinstance(value, str):
        return False
    try:
        value.encode('utf-8')  # Reject lone JSON surrogate escapes before persisting.
        return len(value.encode('utf-16-le')) // 2 <= limit
    except UnicodeEncodeError:
        return False


def portrait(value):
    if value == '':
        return True
    if not text(value, 2048) or any(ord(c) <= 32 for c in value):
        return False
    try:
        url = urlparse(value)
        return url.scheme in ('http', 'https') and bool(url.hostname) and not url.username and not url.password
    except ValueError:
        return False


def validate_state(value):
    if not isinstance(value, dict):
        raise ValueError('Invalid state')
    now = int(time.time() * 1000)
    keys = {'language', 'phase', 'winner', 'duration', 'remaining', 'revision', 'startedAt', 'endsAt', 'action'}
    for side in ('blue', 'red'):
        keys.update(side + field for field in ('Name', 'Image', 'Hp', 'Coins', 'Votes', 'AttackGifts', 'HealGift'))
    if not keys.issubset(value):
        raise ValueError('Missing state fields')
    out = {key: value[key] for key in keys}
    out['giftInfoPosition'] = value.get('giftInfoPosition', 'bottom')
    if out['giftInfoPosition'] not in ('bottom', 'aboveNames'):
        raise ValueError('Invalid gift information position')
    if out['language'] not in ('en', 'he') or out['phase'] not in ('ready', 'running', 'finished'):
        raise ValueError('Invalid flags')
    if out['winner'] not in (None, 'blue', 'red', 'draw') or (out['phase'] == 'finished') != bool(out['winner']):
        raise ValueError('Invalid winner')
    used = set()
    for side in ('blue', 'red'):
        if not text(out[side + 'Name'], 26) or not portrait(out[side + 'Image']):
            raise ValueError('Invalid fighter')
        if not number(out[side + 'Hp'], 0, 100) or not number(out[side + 'Coins'], 0, MAX_INTEGER) or type(out[side + 'Votes']) is not int or out[side + 'Votes'] != 0:
            raise ValueError('Invalid fighter numbers')
        attacks, heal = out[side + 'AttackGifts'], out[side + 'HealGift']
        if not isinstance(attacks, list) or len(attacks) > len(CATALOG) or not isinstance(heal, str):
            raise ValueError('Invalid assignments')
        for gift_id in attacks + ([heal] if heal else []):
            if not isinstance(gift_id, str) or gift_id not in CATALOG or gift_id in used:
                raise ValueError('Duplicate or unknown gift')
            used.add(gift_id)
    for key, low, high in [('duration', 15, 300), ('remaining', 0, 300), ('revision', 0, now + 60000),
                           ('startedAt', 0, now + 60000), ('endsAt', 0, now + 360000)]:
        if not number(out[key], low, high):
            raise ValueError('Invalid match number')
    if out['phase'] == 'running' and (not out['startedAt'] or not out['endsAt']):
        raise ValueError('Missing deadline')
    action = out['action']
    if action is not None:
        if not isinstance(action, dict) or action.get('side') not in ('blue', 'red') or action.get('type') not in ('gift', 'heal'):
            raise ValueError('Invalid action')
        if not number(action.get('power'), 1, MAX_INTEGER) or not number(action.get('amount'), 0, 100) or not number(action.get('at'), 0, now + 60000):
            raise ValueError('Invalid action numbers')
        if not isinstance(action.get('giftId'), str) or action['giftId'] not in CATALOG or not text(action.get('name'), 120) or not text(action.get('id'), 200) or not action['id']:
            raise ValueError('Invalid action identity')
        out['action'] = {key: action[key] for key in ('side', 'type', 'power', 'amount', 'giftId', 'name', 'at', 'id')}
    return out


class ArenaHandler(SimpleHTTPRequestHandler):
    state = None
    lock = threading.Lock()
    server_version = 'BoxingArena'
    sys_version = ''
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp'}

    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' http: https:; connect-src 'self' ws: wss:; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'")
        super().end_headers()

    def reply(self, status, body):
        data = json.dumps(body, ensure_ascii=True, allow_nan=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def allowed(self, write=False):
        hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        host = self.headers.get('Host')
        if len(self.headers.get_all('Host', [])) != 1 or host not in hosts:
            return False
        if len(self.headers.get_all('Origin', [])) > 1:
            return False
        origin = self.headers.get('Origin')
        if origin is not None and origin != f'http://{host}':
            return False
        if write and (self.headers.get('Sec-Fetch-Site') == 'cross-site' or self.headers.get('X-Boxing-Request') != '1'):
            return False
        return True

    def serve_public(self):
        if not self.allowed():
            self.reply(403, {'error': 'Local same-origin access only'})
            return
        try:
            parsed = urlparse(self.path)
        except ValueError:
            self.reply(400, {'error': 'Invalid URL'})
            return
        if parsed.scheme or parsed.netloc:
            self.reply(404, {'error': 'Not found'})
            return
        path = unquote(parsed.path)
        if path == '/api/state':
            with self.lock:
                snapshot = type(self).state
            self.reply(200, {'protocol': 'boxing-arena-v1', 'state': snapshot})
            return
        name = 'index.html' if path == '/' else (path[1:] if path.startswith('/') else path)
        if name not in PUBLIC_FILES or path not in ('/', '/' + name):
            self.reply(404, {'error': 'Not found'})
            return
        target = ROOT / name
        if target.resolve() != target or not target.is_file():
            self.reply(404, {'error': 'Not found'})
            return
        # Use only the canonical allowlisted path with SimpleHTTPRequestHandler.
        self.path = '/' + name
        super().do_GET() if self.command == 'GET' else super().do_HEAD()

    def do_GET(self):
        self.serve_public()

    def do_HEAD(self):
        self.serve_public()

    def do_POST(self):
        self.close_connection = True
        if not self.allowed(write=True):
            self.reply(403, {'error': 'Local same-origin JSON requests only'})
            return
        if self.path != '/api/state':
            self.reply(404, {'error': 'Unknown endpoint'})
            return
        if len(self.headers.get_all('Content-Type', [])) != 1 or self.headers.get_content_type() != 'application/json':
            self.reply(415, {'error': 'JSON content type required'})
            return
        if self.headers.get('Transfer-Encoding') or len(self.headers.get_all('Content-Length', [])) != 1:
            self.reply(400, {'error': 'Invalid request framing'})
            return
        try:
            length = int(self.headers['Content-Length'])
            if not 0 < length <= MAX_BODY:
                self.reply(413, {'error': 'State exceeds 16 KiB'})
                return
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError('Incomplete body')
            state = validate_state(json.loads(raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Non-finite number'))))
            with self.lock:
                current = type(self).state
                if current and state['revision'] <= current['revision']:
                    self.reply(409, {'error': 'Stale state'})
                    return
                type(self).state = state
            self.reply(200, {'ok': True})
        except (ValueError, TypeError, UnicodeDecodeError, RecursionError, OverflowError):
            self.reply(400, {'error': 'Invalid state'})
        except socket.timeout:
            self.reply(408, {'error': 'Request timed out'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    print(f'Boxing Arena: http://127.0.0.1:{args.port}/index.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), ArenaHandler).serve_forever()
