# 🥊 TikTok LIVE Boxing Arena

A local browser boxing game with a bilingual control dashboard and a 9:16 overlay. **S2E/TikTok is not connected or verified.**

## Run on Windows

1. In GitHub Desktop, select this repository and choose **Fetch origin → Pull origin** on `main`.
2. Close any previous arena server window, then double-click **Start-Boxing.cmd**. Python 3 must be installed; no additional packages are required.
3. Open http://127.0.0.1:8766/index.html if the dashboard does not open automatically. Keep its server window and one dashboard open while streaming.
4. In **Match setup**, choose a preset, edit fighter names or portrait URLs, select English/עברית and a 15–300 second duration, then **Save settings**.
5. In **Live control**, start a round. Try punches, specials, simulated comments and gifts. Reset to clear the match.

The Windows launcher retains the existing Python detection, local port and one-click workflow. It now runs `server.py` to synchronize isolated browser sessions. On other systems run `python server.py` from this folder.

## TikTok Live Studio

Use `http://127.0.0.1:8766/overlay.html` as a browser/webpage source if your Live Studio version supports it. Use a 1080×1920 scene and fit the 9:16 overlay. Otherwise open **Open 9:16 overlay** and capture that browser window. Keep the dashboard private.

The local relay shares state even when the overlay uses a separate browser profile. The canvas is 540×960 and scales to the source size. This transport was tested with isolated Chromium profiles; actual Live Studio capture, Windows execution and performance must still be checked on your PC. A browser source cannot reach this loopback URL from a different computer.

## Controls and rules

- Punch: 6 damage; every third vote: 4 damage; gift: 12; special: 20.
- Attacks share a 660 ms recovery period. Attacks during recovery are ignored; votes still count, but their triggered punch may be ignored. The future live adapter must aggregate/rate-limit events with these rules in mind.
- At zero health the loser animates into a knockout. At the time limit, health decides the winner, then votes break ties. A points loss leaves the fighter standing.
- Start is disabled during a running round; Reset ends it. Settings saved during a round change its next duration, not the current deadline.
- Built-in procedural arcade caricatures recognize Bibi/Netanyahu and Eisenkot in English/Hebrew. Custom names and HTTP(S) portrait URLs remain supported; unavailable portraits fall back to the built-in face. These are Canvas vector fighters, not commissioned sprite artwork.
- Hebrew covers controls, presets, status, event logs and overlay text, with RTL layout and LTR technical URLs. Tabs support arrow keys, Home and End.

## Synchronization

`server.py` uses only Python's standard library and listens on `127.0.0.1`. The dashboard publishes match state; overlays poll approximately every 120 ms. State is held in memory until the server stops, and dashboard settings also persist in browser storage. Keep **one dashboard** open as the controller. The dashboard owns round expiry; close it only after stopping the match.

Static hosting (`python -m http.server 8766`) still supports the original BroadcastChannel/localStorage synchronization within the same origin and browser profile. Separate Live Studio browser profiles require `server.py`. Use the exact same hostname and port for dashboard and overlay. The relay rejects cross-site, stale and invalid writes and has no external dependencies.

## Future S2E adapter: normalized test protocol

In **Connections**, supply the URL of a WebSocket bridge you control. Connected status says **TEST BRIDGE**, never TikTok connected. A bridge must translate actual provider payloads into one of these messages:

```json
{"id":"unique-vote-123","type":"comment","side":"blue"}
{"id":"unique-like-456","type":"like","side":"red"}
{"id":"unique-gift-789","type":"gift","side":"blue"}
```

Supported types: `vote`, `comment`, `like`, `gift`, `punch`, `special`. Sides: `blue`, `red`. `vote`, `comment` and `like` each count as one vote. The adapter must resolve comment 1/2, viewer team selection, gift mappings and combo completion before sending events. Provider counts and gift prices are not interpreted by the game. Extra fields do not change damage.

Optional string `id` values (up to 128 characters) suppress duplicates across the last 1,000 IDs in the current dashboard session. Invalid JSON, invalid types/sides and messages over 4 KB are rejected. Recovery drops attacks instead of queuing them. Disconnect is explicit; there is no automatic reconnect or persistent replay protection. The bridge must handle authentication, burst aggregation, provider reconnects and replay safely.

**No real S2E payloads, TikTok comments, likes, gifts or account connection have been tested.** The included WebSocket tests use a synthetic local fixture. Native integration needs real event samples and end-to-end verification.

## Verification

The included dependency-free tests require Node 22+ and Chromium with its debugging port enabled. In separate terminals on a development machine:

```sh
python -m http.server 8766 --bind 127.0.0.1
python server.py --port 8767
chromium --headless --remote-debugging-port=9222 --user-data-dir=/tmp/boxing-test-browser about:blank
node tests/browser.mjs
node tests/relay.mjs
```

`browser.mjs` closes existing test tabs at port 8766. It checks controls, recovery, saved-match reloads, voting, language sync, clipboard label preservation, expiry, mobile layout, synthetic WebSocket validation/deduplication and knockouts. It writes screenshots under `/tmp`. `relay.mjs` checks separate storage contexts and cross-site/stale/invalid write rejection. Tests do not exercise Windows batch execution or the Live Studio application.

Manual release check: switch Hebrew → English; save custom fighter names and a valid portrait; open an external overlay; start a round; compare health, votes and timer across dashboard, preview and overlay; test special attacks and a knockout; restart the server using the Windows launcher; finally test the captured 9:16 source in Live Studio.
