"""Local-only arena hosting and shared state for separate browser profiles."""
import argparse
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


class ArenaHandler(SimpleHTTPRequestHandler):
    state = None
    lock = threading.Lock()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def reply(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def allowed(self):
        # Prevent cross-site writes and DNS rebinding. No CORS access is granted.
        hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if self.headers.get('Host') not in hosts:
            return False
        origin = self.headers.get('Origin')
        return not origin or origin in {f'http://{host}' for host in hosts}

    def do_GET(self):
        if not self.allowed():
            self.reply(403, {'error': 'Local access only'})
            return
        if urlparse(self.path).path == '/api/state':
            with self.lock:
                self.reply(200, {'protocol': 'boxing-arena-v1', 'state': type(self).state})
            return
        super().do_GET()

    def do_POST(self):
        if not self.allowed():
            self.reply(403, {'error': 'Local access only'})
            return
        if self.path != '/api/state':
            self.reply(404, {'error': 'Unknown endpoint'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 16384:
                raise ValueError('Invalid size')
            state = json.loads(self.rfile.read(length))
            if not isinstance(state, dict) or state.get('phase') not in ('ready', 'running', 'finished'):
                raise ValueError('Invalid match')
            for field in ('blueHp', 'redHp'):
                value = state.get(field)
                if type(value) not in (int, float) or not 0 <= value <= 100:
                    raise ValueError('Invalid health')
            for field in ('duration', 'remaining', 'endsAt', 'revision', 'blueVotes', 'redVotes'):
                value = state.get(field)
                if type(value) not in (int, float) or not 0 <= value < 1e16:
                    raise ValueError('Invalid number')
            for field in ('blueName', 'redName', 'blueImage', 'redImage'):
                if not isinstance(state.get(field), str) or len(state[field]) > 4096:
                    raise ValueError('Invalid fighter')
            if state.get('language') not in ('en', 'he'):
                raise ValueError('Invalid language')
            with self.lock:
                current = type(self).state
                if current and state['revision'] <= current['revision']:
                    self.reply(409, {'error': 'Stale state'})
                    return
                type(self).state = state
            self.reply(200, {'ok': True})
        except (ValueError, TypeError, UnicodeDecodeError):
            self.reply(400, {'error': 'Invalid state'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    print(f'Boxing Arena: http://127.0.0.1:{args.port}/index.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), ArenaHandler).serve_forever()
