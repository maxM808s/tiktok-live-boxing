# 🥊 TikTok LIVE Boxing Arena

A local browser boxing game with a bilingual control dashboard and a 9:16 overlay. **TikFinity protocol support is implemented and simulator-tested. A real TikFinity/TikTok LIVE session still needs verification on your PC.**

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
- Attacks share a 660 ms recovery period. Manual and normalized test attacks during recovery are ignored; their votes still count. Native TikFinity attacks queue through recovery, subject to the limits below.
- At zero health the loser animates into a knockout. At the time limit, health decides the winner, then votes break ties. A points loss leaves the fighter standing.
- Start is disabled during a running round; Reset ends it. Settings saved during a round change its next duration, not the current deadline.
- Built-in procedural arcade caricatures recognize Bibi/Netanyahu and Eisenkot in English/Hebrew. Custom names and HTTP(S) portrait URLs remain supported; unavailable portraits fall back to the built-in face. These are Canvas vector fighters, not commissioned sprite artwork.
- Hebrew covers controls, presets, status, event logs and overlay text, with RTL layout and LTR technical URLs. Tabs support arrow keys, Home and End.

## Synchronization

`server.py` uses only Python's standard library and listens on `127.0.0.1`. The dashboard publishes match state; overlays poll approximately every 120 ms. State is held in memory until the server stops, and dashboard settings also persist in browser storage. Keep **one dashboard** open as the controller. The dashboard owns round expiry; close it only after stopping the match.

Static hosting (`python -m http.server 8766`) still supports the original BroadcastChannel/localStorage synchronization within the same origin and browser profile. Separate Live Studio browser profiles require `server.py`. Use the exact same hostname and port for dashboard and overlay. The relay rejects cross-site, stale and invalid writes and has no external dependencies.

## Connect TikFinity Desktop

The game now accepts TikFinity's native `{event, data}` messages directly. No intermediate adapter app is needed. [Official TikFinity Event API documentation](https://tikfinity.zerody.one/tiktok/dapi) specifies `ws://localhost:21213/` and requires TikFinity Desktop on the same computer. Payload fields follow the linked [TikTok-Live-Connector documentation](https://github.com/zerodytrash/TikTok-Live-Connector).

1. Open **TikFinity Desktop** on your streaming PC, finish its setup, and connect it to your TikTok LIVE. Use the desktop app, not just the TikFinity website.
2. Run **Start-Boxing.cmd** and open **Connections** on the dashboard.
3. Keep **TikFinity Desktop** selected and use `ws://localhost:21213/` (or the endpoint shown by your installed version). Click **Connect TikFinity**.
4. Confirm **TikFinity socket connected**, then start a round. From another viewer account, comment `1` for blue or `2` for red. The vote counter must increase. Every three votes queue a 4-damage punch.
5. Send likes from that viewer. Every **10 received likes** count as one additional vote for the chosen team. Partial batches accumulate. The game uses `likeCount`, not the stream's total likes; it can only count events TikFinity actually delivers.
6. After choosing a team, send a gift. Non-streak gifts apply immediately through the attack queue. Streak gifts wait for `repeatEnd` and apply **12 × repeatCount damage**, capped at **100 per combo**. Intermediate updates and duplicate completed combos do not cause extra damage. Gift prices do not affect damage.
7. Confirm the health, votes and timer agree in the dashboard preview and Live Studio overlay.

Team choices last for the current dashboard session; reloading the dashboard requires viewers to choose again. A viewer may switch teams by commenting the other number. Likes and gifts from viewers who have not chosen a team are ignored. Team selections can be made before the round, but votes and damage only apply while it runs. Every gift uses the selected team; there is no gift-name/coin-price mapping.

Live attacks wait through the 660 ms recovery period in a queue of at most 100 pending attacks. Excess attacks are dropped with an activity-log message. Start, Reset, a finished round, and manual disconnect clear pending actions. The native adapter retains up to 5,000 event IDs and 10,000 viewer selections in memory. Deduplication uses message IDs or completed gift-group IDs when supplied; it cannot guarantee replay protection for events without IDs or across reloads. Incoming messages are limited to 256 KiB, with like/gift batch counts capped at 1,000 before applying game rules.

A connected socket confirms transport only. The event count shows valid provider messages received, including non-game events; game counters confirm that chat/likes/gifts were mapped. **No real TikFinity desktop instance, account, or live gift has been tested here.** The automated tests use a local simulator shaped according to the documented API. To finish verification, perform steps 4–7 on your PC. Do not purchase gifts just to debug basic connectivity: test comments first. If connection fails, verify the desktop app is running on the same PC, its local Event API endpoint is available, and that the address matches your version. There is no automatic reconnect; press Connect again after restoring TikFinity.

### Advanced normalized test bridge

The previous generic protocol remains available under **Normalized test bridge (advanced)** for development fixtures:

```json
{"id":"unique-event-123","type":"vote","side":"blue"}
```

Supported types: `vote`, `comment`, `like`, `gift`, `punch`, `special`. Sides: `blue`, `red`. In this test mode each vote/comment/like is one vote, gifts cause 12 damage, and specials cause 20. Optional string IDs (up to 128 characters) deduplicate the last 1,000 IDs. Generic test attacks retain the original recovery behavior (attacks during recovery are ignored). Select **TikFinity Desktop** for actual TikFinity messages.

## Verification

The included dependency-free tests require Node 22+ and Chromium with its debugging port enabled. In separate terminals on a development machine:

```sh
python -m http.server 8766 --bind 127.0.0.1
python server.py --port 8767
chromium --headless --remote-debugging-port=9222 --user-data-dir=/tmp/boxing-test-browser about:blank
node tests/tikfinity.mjs
node tests/browser.mjs
node tests/relay.mjs
```

`browser.mjs` closes existing test tabs at port 8766. It checks controls, recovery, saved-match reloads, voting, language sync, clipboard label preservation, expiry, mobile layout, synthetic WebSocket validation/deduplication, native TikFinity chat/like/gift combos, queued damage, and knockouts. `tikfinity.mjs` tests the native adapter separately with flat/nested viewer payloads, batched likes and streak deduplication. It writes screenshots under `/tmp`. `relay.mjs` checks separate storage contexts and cross-site/stale/invalid write rejection. Tests do not exercise Windows batch execution or the Live Studio application.

Manual release check: switch Hebrew → English; save custom fighter names and a valid portrait; open an external overlay; start a round; compare health, votes and timer across dashboard, preview and overlay; test special attacks and a knockout; restart the server using the Windows launcher; finally test the captured 9:16 source in Live Studio.
