# 🥊 TikTok LIVE Boxing Arena

A local browser boxing game with a Hebrew/English dashboard, animated fighters and a 9:16 overlay. **Only gifts affect gameplay.** TikFinity protocol support is simulator-tested; a real TikFinity LIVE session still needs verification on your PC.

## Run on Windows

1. In GitHub Desktop, choose **Fetch origin → Pull origin** on `main`.
2. Close the previous arena server window, then double-click **Start-Boxing.cmd**. Python 3 is required; no additional packages are needed.
3. Open http://127.0.0.1:8766/index.html if it does not open automatically. Keep one dashboard and the server window open while streaming.
4. Open **Match setup**, customize fighters and select English/עברית, round duration and gift assignments. Press **Save settings**.
5. Start a round in **Live control**. Its gift simulation buttons use the exact same assignments and coin values as TikFinity, without sending real gifts.

The Windows launcher retains its one-click workflow, Python detection and local port. It runs `server.py` for cross-browser synchronization. On other systems run `python server.py`.

## Gift library and assignments

The bundled **154-gift catalog and all 154 local icons** come from your [TikTok LIVE Battle repository](https://github.com/maxM808s/tiktok-live-battle). `catalog.json` retains its gift IDs, names, coin values, image paths, source URLs and verification metadata. Gift assets are copied locally, so the picker does not depend on remote image hosts. Source catalog blob: `0abfbc85564fc79c4ad17a7dfe9f17d2ad6848e2`; source tree: `2f1e8a77388ed3a3231974c38fd962d5f7bec811`.

In **Match setup → Gift library & healing**:

1. Choose an assignment: **Blue · damage opponent**, **Red · damage opponent**, **Blue · healing gift**, or **Red · healing gift**.
2. Search the catalog by name, gift ID or coin value. Click a gift to assign it. Click it again in the same assignment to remove it.
3. Assign as many different damage gifts as desired, and optionally **one healing gift per fighter**. Choosing a new healing gift replaces that fighter's previous healing gift.
4. Each gift has one assignment across the whole game. Assigning an already-used gift moves it to the new slot; it cannot damage and heal, or support both fighters, at the same time.
5. Press **Save settings**. Unsaved selections remain a draft. Saved changes affect subsequent gifts immediately, including during a round.

Defaults: **Rose** supports blue and damages red; **TikTok** supports red and damages blue. Healing is disabled until a healing gift is selected. Unassigned or unknown gifts are ignored and logged. No comments are needed to choose a fighter.

## Exact damage and healing rules

- **Damage = catalog coin value × completed gift count.** A 1-coin gift deals 1 damage; three 10-coin gifts deal 30 damage to the opposing fighter.
- **Healing = catalog coin value × completed gift count.** The selected healing gift restores its assigned fighter's health instead of dealing damage. Two 5-coin healing gifts restore 10 health.
- Health stays between **0 and 100**. Extra damage beyond zero and healing beyond maximum health are naturally unused. There is no fixed 12-damage gift rule or separate 100-coin combo cap.
- Values come from the copied catalog, never an arbitrary damage/price supplied in an incoming message. Catalog prices are the battle repository's snapshot; update that catalog when gift prices change. Unknown gift IDs are never assigned an invented price.
- Streak gifts wait for `repeatEnd`. Intermediate updates do not score. Completed combos and duplicate messages are deduplicated using group/message identity. Completed combo counts must be whole numbers between 1 and 100,000.
- Every accepted gift updates health immediately. Animation recovery never drops or postpones gift damage/healing. Several fast gifts may share the latest visible reaction, but all accepted coin values are applied.
- **Comments, likes, follows, votes, punch commands and special commands never change health, scores, assignments or the winner.** Manual punch/vote/special controls were removed. Manual testing simulates an assigned gift only.
- At zero health, the opponent wins and the loser animates into a knockout. Finished rounds cannot be healed or damaged. Start or Reset clears health and received-coin totals; gift assignments remain saved.
- At the round deadline, remaining health decides the winner. Equal health is a draw; votes and received-coin totals never break ties. Received-coin totals are informational and include healing gifts.

The overlay shows the assigned gift icons: **⚔** marks gifts that damage the opponent and **♥** marks the fighter's healing gift. It shows up to three damage icons per fighter and a count for additional assignments. Green healing effects are distinct from punch reactions.

## TikFinity Desktop

The game accepts native `{event, data}` gift messages. The [official TikFinity Event API](https://tikfinity.zerody.one/tiktok/dapi) documents `ws://localhost:21213/` and requires TikFinity Desktop on the same computer.

1. Open **TikFinity Desktop**, finish its setup and connect it to your TikTok LIVE.
2. Run the arena and open **Connections**. Keep **TikFinity Desktop** selected and use `ws://localhost:21213/`, or the endpoint shown by your installed version.
3. Click **Connect TikFinity**, then confirm the socket-connected status.
4. Save gift assignments and start a round. Test a completed, assigned gift from a viewer account and verify the correct fighter's health change. No team-selection comment is needed.
5. Test the selected healing gift while that fighter has missing health. Compare dashboard, preview and external overlay health.

A connected socket confirms transport only; received events do not by themselves verify gift scoring. Adapter, Chromium WebSocket simulator and isolated-overlay tests have passed. **No real TikFinity desktop instance, live account or real gift transaction was tested here.** The existing desktop connection has no automatic reconnect; press Connect again after restoring TikFinity.

The adapter accepts flat/nested sender fields and persists both message and completed-combo identities in local browser storage. Gifts without a stable message or usable completed-combo identity are rejected. Native replay protection survives dashboard reloads and never silently evicts old identities: full, corrupt or unavailable replay storage rejects new native events and logs the issue. It is bounded to 40,000 keys / 1.5 million JSON characters; use one controller and never clear history during an active stream. Gift messages are limited to 256 KiB. Non-gift events are ignored completely. See [SECURITY.md](SECURITY.md) for the trust boundary and recovery notes.

### Advanced normalized test bridge

The developer bridge remains available under **Normalized test bridge (advanced)**. Only gift messages are processed, using the same catalog and saved assignments:

```json
{"id":"unique-event-123","type":"gift","giftId":"5655","count":3}
```

`giftId` chooses the saved assignment; `count` defaults to 1. Optional `id` values deduplicate the last 1,000 normalized messages. Incoming `side`, `power`, `diamondCount` and other price fields do not override catalog rules. Other message types are ignored. Use the native TikFinity mode for the actual desktop app.

## Live Studio and synchronization

Use `http://127.0.0.1:8766/overlay.html` as a browser/webpage source if your Live Studio version supports it. Use a 1080×1920 scene and fit the 9:16 overlay. Otherwise open the overlay in a separate browser window and capture that window. Keep the dashboard private.

`server.py` uses Python's standard library and binds only to `127.0.0.1`. It serves only allowlisted game files and rejects malformed state and cross-site writes; local applications remain trusted. The dashboard publishes state; overlays poll about every 120 ms, including from separate browser profiles. State lives in server memory and dashboard settings also persist in browser storage. Use the same hostname and port, and keep **one dashboard** open: it owns the round timer. Loopback sources cannot be reached from another computer.

For isolated development only, static hosting (`python -m http.server 8766`) retains same-profile BroadcastChannel/localStorage synchronization. Separate browser sources require `server.py`; the static fallback does not provide the hardened server's file restrictions or security headers. Isolated Chromium profile synchronization was tested; Windows launcher execution, actual Live Studio capture and streaming performance still need testing on your PC.

## Custom fighters and languages

Custom fighter names, remote HTTP(S) portraits, presets, round duration and bilingual controls remain available. Built-in Bibi/Netanyahu and Eisenkot caricatures are procedural Canvas fighters. Failed portraits fall back to a built-in face. Hebrew supports RTL layout while technical addresses stay LTR. Tabs support arrow keys, Home and End. The one-click Windows launcher is preserved.

## Verification

Tests require Node 22+ and Chromium. Run these in separate development terminals:

```sh
python -m http.server 8766 --bind 127.0.0.1
python server.py --port 8767
chromium --headless --remote-debugging-port=9222 --user-data-dir=/tmp/boxing-test-browser about:blank
node tests/tikfinity.mjs
node tests/browser.mjs
node tests/relay.mjs
```

The tests verify catalog assets, exclusive damage/healing assignments, exact coin/combo math, non-gift rejection, duplicate prevention, rapid gifts, maximum healing, knockout rules, saved customization, RTL, mobile layout and separate-profile synchronization. Screenshots are written to `/tmp`. Browser tests close existing test tabs at port 8766; relay tests close test tabs at port 8767. Windows and actual Live Studio execution are not covered.

## Security

The security review and remaining limitations are documented in [SECURITY.md](SECURITY.md). After pulling these fixes, close the previous server window and restart **Start-Boxing.cmd** so the new server protections take effect. Native TikFinity connections must be local; remote developer bridges must use WSS. Portraits accept HTTP(S) addresses without embedded credentials. Run `node tests/security.mjs`, `python tests/security_server.py`, and the dedicated hardened-server Chromium checks described in that report.
