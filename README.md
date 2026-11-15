# 🥊 TikTok LIVE Boxing Arena

A browser-based 2D boxing game for TikTok LIVE, with customizable fighters, a Hebrew/English control dashboard, and a vertical 9:16 overlay for LIVE Studio. Viewers support a fighter through assigned gifts that damage the opponent or heal their fighter.

TikFinity event handling has been tested with simulated events. Actual TikFinity LIVE gift delivery and Windows LIVE Studio capture still need verification on the streaming computer.

## Getting started

Requirements: Python 3, a modern browser, and TikFinity Desktop for live gift events. The game server uses Python's standard library; no additional Python packages are required.

1. Download the repository, or pull the latest `main` updates in GitHub Desktop.
2. On Windows, double-click **Start-Boxing.cmd**. The dashboard opens automatically. If needed, open http://127.0.0.1:8766/index.html.
3. In **Match setup**, choose fighters, language, round duration, and gift assignments. Press **Save settings**. Game mode selection applies immediately.
4. In **Live control**, press **Start match**. Use the gift simulation controls to check damage and healing before connecting live events.
5. Keep the server and one dashboard open while streaming. The dashboard receives TikFinity gifts; the server manages round timing and synchronizes the overlay.

On other systems, run `python server.py` from the project folder and open the dashboard URL above. When updating, close the old server before starting the launcher again.

## Game modes

Rounds last 15–300 seconds and end at the deadline or a knockout. The fighter with more health at the deadline wins; equal health is a tie. Each win adds one point. Ties add no points.

| Mode | Behavior |
| --- | --- |
| Single timed round | The result remains visible until a new match starts. |
| Endless timed rounds | After every win or tie, the result appears for three seconds, then a fresh round starts automatically. |
| Best of 3 | First to two wins becomes champion. Tied rounds continue the series. |
| Best of 5 | First to three wins becomes champion. Tied rounds continue the series. |

Fresh rounds restore both fighters to 100 health and clear round coin totals while preserving assignments and match points. Round numbers include ties. Automatic transitions continue while the dashboard is in the background, provided the server remains running.

**Pause** stops the round timer or progression between rounds. **Resume match** continues play. **Reset** clears the match and points while retaining settings. **New match** starts a finished match over. Reset before changing modes during an active match.

## Gifts and healing

The bundled catalog contains 154 gifts with local icons, sourced from [TikTok LIVE Battle](https://github.com/maxM808s/tiktok-live-battle). Prices use the bundled catalog snapshot and may need updating when TikTok gift prices change.

In **Match setup → Gift library & healing**:

1. Assign punch gifts to the blue or red fighter using the gift library.
2. Select one healing gift per fighter using the healing selectors. Leave the selection empty to disable healing.
3. Press **Save settings** to apply the assignments.

Each gift can have only one assignment across the game. Assigning it elsewhere moves it from its previous slot. Multiple punch gifts can support each fighter. By default, Rose supports blue and TikTok supports red; neither fighter has a healing gift selected.

- **Damage:** gift coin value × completed gift count, applied to the opponent.
- **Healing:** gift coin value × completed gift count, restored to the assigned fighter.
- Health stays between 0 and 100. A 1-coin gift deals 1 damage or restores 1 health.
- Streak gifts apply when the combo completes. Duplicate native gift events are filtered.
- Unknown and unassigned gifts are ignored. Comments, likes, and follows do not affect gameplay.
- Gifts received while paused, between rounds, or after a match finishes are ignored rather than carried into the next round.

The overlay labels gifts **Punch / אגרוף** and **Heal / ריפוי**. Use **Punch & healing information position** to place this information at the bottom or above the fighter names, then save settings.

## Connect TikFinity

1. Open TikFinity Desktop on the same computer and connect it to TikTok LIVE.
2. Open the dashboard's **Connections** tab and select **TikFinity Desktop**.
3. Use `ws://localhost:21213/`, or the address documented by the installed TikFinity version, and press **Connect TikFinity**.
4. Start a round and verify an assigned gift changes the correct fighter's health. Test healing while that fighter has missing health and compare the dashboard with the overlay.

A connected socket confirms the connection, not successful live gift scoring. The connection does not automatically reconnect; connect again after restoring TikFinity. See the [TikFinity Event API documentation](https://tikfinity.zerody.one/tiktok/dapi) for its desktop event interface.

Use one dashboard as the live controller. Keep its browser storage available and do not clear gift replay history during a stream. If replay protection blocks events, check the dashboard log and [security notes](SECURITY.md). The advanced normalized test bridge is intended for development; use native TikFinity mode with TikFinity Desktop.

## Capture in TikTok LIVE Studio

Set up a **1080×1920** scene and choose either capture method:

- **Separate window:** press **Open separate game window**. On Windows, an installed Edge or Chrome browser opens the overlay in a dedicated app window. Select **Boxing Arena — Game Capture** in LIVE Studio Window Capture. Press **F** or the auto-hiding fullscreen button to toggle fullscreen. If the app browser is unavailable, allow the fallback popup.
- **Browser source:** if supported by the installed LIVE Studio version, use `http://127.0.0.1:8766/overlay.html` and fit the 9:16 overlay to the scene.

Keep the dashboard outside the captured scene. Dashboard and overlay must use the same server address and port. The server binds to this computer only; its URLs cannot be opened from another computer.

## Customization and languages

Built-in Bibi and Eisenkot fighters have distinct arcade designs. Match setup supports custom names, fighter presets, and HTTP(S) portrait URLs. Failed portraits fall back to a built-in face. Select English or Hebrew for the dashboard and overlay; Hebrew uses right-to-left layout.

## Troubleshooting

- **Launcher closes or Python is missing:** install Python 3 and enable **Add Python to PATH**, then run the launcher again.
- **Port already in use:** close the previous arena server before restarting.
- **Overlay is stale or rounds stop advancing:** ensure the current `server.py` is running, refresh the dashboard and overlay, and check that both use the same address and port.
- **Gifts have no effect:** check TikFinity's connection, saved gift assignments, and that a round is running. Streak gifts must complete before applying. Healing has no visible effect at full health.
- **Capture window does not open:** allow popups or use the browser-source URL. Confirm Edge or Chrome is installed for the dedicated Windows app window.

## Development and security

Core files: `index.html` (dashboard), `overlay.html` (capture overlay), `app.js` (rendering and controls), `style.css`, and `server.py` (local server). Use `server.py` for normal operation and cross-browser synchronization.

Core checks require Python 3 and Node.js 22 or newer. Run them from the project folder:

```sh
node tests/match.mjs
node tests/tikfinity.mjs
node tests/security.mjs
python tests/server_clock.py
python tests/security_server.py
```

Browser regression scripts are in `tests/` and require a dedicated Chromium debugging session and the server ports specified in each script. Automated tests do not establish actual TikFinity LIVE or Windows capture compatibility.

See [SECURITY.md](SECURITY.md) for the security review, local trust boundary, and replay-protection limitations.
