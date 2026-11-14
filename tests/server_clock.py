"""Regression: a frozen dashboard must not stop tie/win auto-advance."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
import capture_window
from match_server import clock_tick, command
spec = importlib.util.spec_from_file_location('clock_server', Path(__file__).parents[1] / 'server.py')
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)


def ready(mode='endless'):
    return dict(language='en', phase='ready', winner=None, duration=15, remaining=15,
                revision=int(time.time()*1000), startedAt=0, endsAt=0, action=None,
                blueName='BIBI', redName='EISENKOT', blueImage='', redImage='', blueHp=100,
                redHp=100, blueVotes=0, redVotes=0, blueCoins=0, redCoins=0,
                blueAttackGifts=['5655'], redAttackGifts=['5269'], blueHealGift='', redHealGift='',
                mode=mode, round=1, blueScore=0, redScore=0, nextRoundAt=0,
                remainingMs=15000, seriesWinner=None, giftInfoPosition='bottom')


class ClockTests(unittest.TestCase):
    def test_win_tie_and_recovery(self):
        s=command(ready(), {'type':'start'}, 1000, server_module.CATALOG)
        s=command(s, {'type':'gift','giftId':'5655','count':100}, 1100, server_module.CATALOG)
        self.assertEqual((s['phase'],s['winner'],s['blueScore']),('intermission','blue',1))
        s=clock_tick(s,4100)
        self.assertEqual((s['phase'],s['round'],s['redHp']),('running',2,100))
        s=clock_tick(s,s['endsAt'])
        self.assertEqual((s['phase'],s['winner'],s['blueScore']),('intermission','draw',1))
        s=clock_tick(s,s['nextRoundAt'])
        self.assertEqual((s['phase'],s['round'],s['blueScore']),('running',3,1))
        stuck={**s,'phase':'finished','winner':'draw','endsAt':0}
        recovered=clock_tick(stuck,30000)
        self.assertEqual(recovered['phase'],'intermission')
        self.assertEqual(recovered['blueScore'],1)

    def test_background_clock_without_browser_or_http_reads(self):
        class Quiet(server_module.ArenaHandler):
            state=None
            def log_message(self,*args):
                pass
        server=server_module.ArenaHTTPServer(('127.0.0.1',0),Quiet)
        thread=threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        try:
            now=int(time.time()*1000)
            state=command(ready(),{'type':'start'},now,server_module.CATALOG)
            state.update(endsAt=now+80)
            with Quiet.lock: Quiet.state=state
            deadline=time.time()+1
            while time.time()<deadline:
                with Quiet.lock: current=Quiet.state.copy()
                if current['phase']=='intermission': break
                time.sleep(.02)
            self.assertEqual((current['phase'],current['winner']),('intermission','draw'))
            with Quiet.lock: Quiet.state['nextRoundAt']=int(time.time()*1000)+80
            deadline=time.time()+1
            while time.time()<deadline:
                with Quiet.lock: current=Quiet.state.copy()
                if current['phase']=='running': break
                time.sleep(.02)
            self.assertEqual((current['round'],current['blueScore'],current['redScore']),(2,0,0))
        finally:
            server.shutdown();server.server_close();thread.join()

    def test_settings_commands_cannot_set_health_or_scores(self):
        with self.assertRaises(ValueError):
            command(ready(),{'type':'settings','patch':{'blueHp':0}},1000,server_module.CATALOG)
        s=command(ready(),{'type':'settings','patch':{'mode':'best3'}},1000,server_module.CATALOG)
        self.assertEqual((s['mode'],s['round'],s['blueScore']),('best3',1,0))

    def test_windows_capture_is_separate_app_not_a_shell_command(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);edge=root/'Microsoft/Edge/Application/msedge.exe'
            edge.parent.mkdir(parents=True);edge.write_bytes(b'test executable placeholder')
            with patch.object(capture_window.sys,'platform','win32'), patch.dict(capture_window.os.environ,{'PROGRAMFILES':folder,'PROGRAMFILES(X86)':folder,'LOCALAPPDATA':folder}), patch.object(capture_window.subprocess,'Popen') as launch:
                self.assertTrue(capture_window.launch_capture_window(8766))
                args=launch.call_args.args[0]
                self.assertIn('--app=http://127.0.0.1:8766/overlay.html?capture=1',args)
                self.assertIn('--start-fullscreen',args)
                self.assertTrue(any(x.startswith('--user-data-dir=') for x in args))
                self.assertIs(launch.call_args.kwargs['shell'],False)


if __name__=='__main__':
    unittest.main(verbosity=2)
