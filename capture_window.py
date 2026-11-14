"""Open a fixed local overlay in its own Windows browser-app profile/window."""
import os
from pathlib import Path
import subprocess
import sys


def launch_capture_window(port):
    if sys.platform != 'win32':
        return False
    candidates = []
    for root in (os.environ.get('PROGRAMFILES(X86)'), os.environ.get('PROGRAMFILES'), os.environ.get('LOCALAPPDATA')):
        if root:
            candidates.extend((Path(root) / 'Microsoft/Edge/Application/msedge.exe',
                               Path(root) / 'Google/Chrome/Application/chrome.exe'))
    browser = next((path for path in candidates if path.is_file()), None)
    if browser is None:
        return False
    profile = Path(os.environ.get('LOCALAPPDATA') or Path.home()) / 'TikTokLiveBoxing' / 'CaptureProfile'
    profile.mkdir(parents=True, exist_ok=True)
    # No URL/executable/argument comes from an HTTP request or a viewer event.
    url = f'http://127.0.0.1:{int(port)}/overlay.html?capture=1'
    subprocess.Popen([str(browser), f'--app={url}', f'--user-data-dir={profile}',
                      '--start-fullscreen', '--no-first-run', '--no-default-browser-check'], shell=False)
    return True
