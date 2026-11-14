# 🥊 TikTok LIVE Boxing Arena

A browser-based 2D boxing battle with a 9:16 overlay and a local dashboard. **Current status: playable demo; S2E is not yet integrated.**

## Run locally

1. Clone the repository using GitHub Desktop.
2. Open the folder in VS Code.
3. Run a local HTTP server, for example `python -m http.server 8080` (Python 3), then open http://localhost:8080 .
4. Open `overlay.html` in a second tab or use the dashboard preview.
5. Set up names, portraits and round duration, then click **Save matchup** and **Start round**.
6. Use **Comment 1/2**, **gift**, punch and special buttons to test. The game runs without TikTok.

**TikTok Live Studio:** Add a browser/webpage source pointing to your locally served `overlay.html` URL if your Live Studio version supports browser sources. Otherwise capture the overlay window. Set the scene to 1080×1920 and fit the portrait overlay. Keep the dashboard private.

## Existing features

- Custom fighter names, remote portrait URLs, Hebrew/English labels.
- Canvas-rendered 2D fighters, punch motion, special effects, hit reactions and health bars.
- Round timer, knockout/winner, comment vote counters.
- Demo gift and comment events.
- Cross-tab synchronization via BroadcastChannel and localStorage.
- Optional generic WebSocket event bridge.

## Bridge protocol (not a native S2E adapter)

The dashboard can connect to a WebSocket server you control. Send JSON messages:

```json
{"type":"vote","side":"blue"}
```

Valid types: `vote`, `gift`, `punch`, `special`. Valid sides: `blue`, `red`. The bridge must map actual S2E events into these messages. **Do not claim live S2E compatibility until tested with real event samples.** Never expose local bridge ports publicly without authentication.

## Limitations / next milestones

This is an initial functional prototype, not a finished production release. The current fighters are procedural Canvas drawings, not polished sprite-sheet animations. Portrait URLs may fail if the image host blocks cross-origin display. The round timer is controlled by the dashboard tab; keep it open. The current bridge has no event identity, replay protection, spam limits, reconnection or authentication. No actual TikTok gifts, gift catalog, S2E schema or gift prices have been verified. Browser audio, configurable gift mapping, production-grade moderation and robust automated tests remain to be implemented.

Recommended next steps: create a sprite animation pipeline; implement a local authenticated S2E adapter after inspecting real payloads; add cooldowns, gift combo handling, anti-replay and telemetry; test full-screen capture and performance in Live Studio.

## Updates

In GitHub Desktop choose **Fetch origin → Pull origin** to receive future changes, then refresh the browser. No repeated ZIP downloads needed.
