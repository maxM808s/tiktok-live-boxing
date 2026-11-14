"""HTTP security regression tests with dummy files; never reads real secrets."""
import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest

spec = importlib.util.spec_from_file_location('arena_server', Path(__file__).parents[1] / 'server.py')
arena = importlib.util.module_from_spec(spec)
spec.loader.exec_module(arena)


class SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        arena.ROOT = Path(cls.temp.name).resolve()
        (arena.ROOT / 'index.html').write_text('<!doctype html><title>fixture</title>')
        (arena.ROOT / '.env').write_text('SECURITY_TEST_ONLY=not-a-secret')
        (arena.ROOT / '.git').mkdir()
        (arena.ROOT / '.git/config').write_text('SECURITY_TEST_ONLY')
        (arena.ROOT / 'server.py').write_text('SECURITY_TEST_ONLY')
        (arena.ROOT / 'untrusted.html').write_text('<script>not executed</script>')
        (arena.ROOT / 'app.js').symlink_to(arena.ROOT / '.env')
        class QuietHandler(arena.ArenaHandler):
            def log_message(self, *args):
                pass
        cls.server = arena.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.host = f'127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def request(self, path='/', method='GET', body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=8)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        conn.close()
        return result

    def state(self):
        return dict(language='en', phase='ready', winner=None, duration=60, remaining=60,
                    revision=int(time.time() * 1000), startedAt=0, endsAt=0, action=None,
                    blueName='BIBI', redName='EISENKOT', blueImage='', redImage='', blueHp=100,
                    redHp=100, blueVotes=0, redVotes=0, blueCoins=0, redCoins=0,
                    blueAttackGifts=['5655'], redAttackGifts=['5269'], blueHealGift='', redHealGift='')

    def post(self, state=None, headers=None):
        standard = {'Content-Type': 'application/json', 'X-Boxing-Request': '1'}
        standard.update(headers or {})
        return self.request('/api/state', 'POST', json.dumps(state if state is not None else self.state()), standard)

    def test_private_files_and_traversal(self):
        for path in ('/.env', '/.git/config', '/server.py', '/untrusted.html', '/tests/', '/%2eenv', '/%2e%2e/.env', '//.env', '/app.js'):
            for method in ('GET', 'HEAD'):
                with self.subTest(path=path, method=method):
                    self.assertEqual(self.request(path, method)[0], 404)

    def test_host_origin_and_head(self):
        for method in ('GET', 'HEAD'):
            self.assertEqual(self.request('/', method, headers={'Host': 'attacker.example'})[0], 403)
        self.assertEqual(self.request('/api/state', headers={'Origin': 'https://attacker.example'})[0], 403)
        self.assertEqual(self.post(headers={'Origin': 'null'})[0], 403)
        self.assertEqual(self.post(headers={'Origin': 'https://attacker.example'})[0], 403)
        self.assertEqual(self.post(headers={'Sec-Fetch-Site': 'cross-site'})[0], 403)
        self.assertEqual(self.post(headers={'X-Boxing-Request': ''})[0], 403)
        self.assertEqual(self.post(headers={'Content-Type': 'text/plain'})[0], 415)

    def test_headers(self):
        status, headers, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(headers['Referrer-Policy'], 'no-referrer')
        self.assertEqual(headers['X-Frame-Options'], 'SAMEORIGIN')
        self.assertIn("script-src 'self'", headers['Content-Security-Policy'])
        self.assertIn("frame-ancestors 'self'", headers['Content-Security-Policy'])

    def test_invalid_states(self):
        for patch in ({'mode': 'invalid'}, {'blueScore': 1}, {'mode': 'best3', 'phase': 'finished', 'winner': 'blue', 'blueScore': 1, 'seriesWinner': 'blue'}, {'round': 0}, {'blueScore': -1}, {'giftInfoPosition': 'invalid'}, {'blueAttackGifts': {}}, {'blueAttackGifts': ['unknown']}, {'redHealGift': '5655'},
                      {'action': {'side': 'blue', 'type': 'gift'}}, {'blueHp': float('nan')},
                      {'revision': 10**16}, {'blueHp': True}, {'blueImage': 'javascript:alert(1)'},
                      {'blueImage': 'https://user:pass@example.com/image'}, {'blueName': 'x' * 27}, {'blueName': '\ud800'}, {'blueName': '😀' * 14}):
            with self.subTest(patch=list(patch)):
                self.assertEqual(self.post({**self.state(), **patch})[0], 400)
        self.assertEqual(self.request('/api/state', 'POST', '[' * 2000, {'Content-Type': 'application/json', 'X-Boxing-Request': '1'})[0], 400)
        self.assertEqual(self.request('/api/state', 'POST', 'x' * 16385, {'Content-Type': 'application/json', 'X-Boxing-Request': '1'})[0], 413)

    def test_valid_state_and_stale_write(self):
        state = self.state()
        self.assertEqual(self.post({**state, 'unknown': 'discarded'}, {'Origin': f'http://{self.host}'})[0], 200)
        self.assertEqual(self.post(state)[0], 409)
        status, _, raw = self.request('/api/state')
        self.assertEqual(status, 200)
        self.assertNotIn('unknown', json.loads(raw)['state'])

    def test_ambiguous_request_framing(self):
        for transfer in (False, True):
            conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=8)
            conn.putrequest('POST', '/api/state')
            conn.putheader('Content-Type', 'application/json')
            conn.putheader('X-Boxing-Request', '1')
            conn.putheader('Content-Length', '2')
            if transfer:
                conn.putheader('Transfer-Encoding', 'chunked')
            else:
                conn.putheader('Content-Length', '2')
            conn.endheaders(b'{}')
            response = conn.getresponse()
            self.assertEqual(response.status, 400)
            response.read()
            conn.close()

    def test_request_body_timeout(self):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=8)
        conn.putrequest('POST', '/api/state')
        conn.putheader('Content-Type', 'application/json')
        conn.putheader('X-Boxing-Request', '1')
        conn.putheader('Content-Length', '20')
        conn.endheaders(b'{')
        response = conn.getresponse()
        self.assertEqual(response.status, 408)
        response.read()
        conn.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
