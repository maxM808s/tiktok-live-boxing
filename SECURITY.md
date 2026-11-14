# Security review

Review date: 2026-11-14. Baseline: `b7e20538b94aae99fa7494ab1a18b3a1303ae259`.

Scope: the tracked dashboard, Canvas overlay, Python launcher/server, TikFinity adapter, gift rules/catalog and synchronization paths. Included source inspection, token/private-key pattern checks, isolated HTTP probes, adversarial fixtures and Chromium checks. This was not a review of Git history, the user's Windows PC, TikFinity's application, TikTok accounts, or an actual LIVE session.

## Confirmed findings and fixes

| Severity | Finding | Reproduction before the fix | Resolution |
| --- | --- | --- | --- |
| Medium | The local server exposed unintended project files. | A dummy `.env` file returned HTTP 200; `HEAD` also bypassed Host checks. No real secret was accessed. | Exact public-file allowlist for GET and HEAD; no directory listings, traversal, symlinks, `.git`, `.env`, Python source, tests or other arbitrary files. Host/Origin checks cover both methods. |
| Medium | HTTP/tab state was incompletely validated and could break rendering or poison revisions. | The API accepted an object instead of a gift assignment list and a malformed action. The browser trusted incoming tab/relay state. | Bounded, canonical validation for assignments, fighters, URLs, actions, flags, timestamps, safe integers and revisions at storage, tab and relay boundaries. Unknown fields are stripped. The relay rejects malformed/oversized/non-finite/deep JSON and lone Unicode surrogates that could break response encoding. |
| Medium | Gift replay checks could be bypassed by removing a combo field; replay history also disappeared on reload. | A gift with the same message ID was accepted again after its group ID was omitted. | Record/check both message and completed-combo identities, including new aliases learned from duplicate combo messages. Native replay keys persist in browser storage before health is awarded. History is never silently evicted; corrupt, unavailable or full storage rejects new native gifts rather than bypassing protection. |
| Low | Browser writes and HTTP parsing lacked defense in depth. | The API accepted a JSON body labeled `text/plain` with no application request header. Existing Origin checks already rejected normal cross-origin browser POSTs. | Require JSON and `X-Boxing-Request: 1`; reject cross-site writes, wrong origins, duplicate lengths and transfer encoding. Limit bodies to 16 KiB and read time to five seconds. This header is CSRF defense, not authentication. |
| Low | Security headers and URL policies were missing. | No CSP/frame restrictions or response MIME protection; URLs could contain embedded credentials or select a remote plaintext bridge. | CSP blocks inline/remote scripts and third-party framing, with the same-origin preview preserved. Add nosniff, no-referrer and same-origin resource headers. Reject unsafe/credential-bearing image and socket URLs; native TikFinity is loopback-only, remote test bridges require WSS. |

Custom fighter text and activity entries use textContent/Canvas instead of HTML injection. No production `eval`, dynamically compiled code, remote JavaScript dependency or shell invocation from viewer events was found. The source credential-pattern scan found no matching private keys, GitHub tokens, AWS access-key IDs or OpenAI keys; this is a limited pattern scan, not proof that every possible secret is absent.

## Verified behavior

- HTTP regression tests use a temporary folder and dummy private files. They verify private-file/traversal/symlink denial, GET/HEAD Host enforcement, Origin/CSRF/content-type enforcement, security headers, malformed state, stale writes, size/framing limits and slow-body timeout.
- JavaScript tests exercise malformed/oversized state, poisoned revisions, invalid assignments/URLs, replay shape changes, reload persistence and unavailable/corrupt/full replay storage.
- Chromium on the hardened server verifies that modules, gift icons and the iframe preview still load; inline script injection is blocked; malformed tab state is rejected; portrait requests omit referrers; and a simulated native gift cannot score twice across reload.
- Existing gameplay tests verify catalog-priced damage/healing, combos, knockout, saved customization, Hebrew/RTL, mobile layout and overlay updates. Separate-profile relay tests pass against the hardened server.

These tests use synthetic local events. They do not authenticate an actual TikTok gift or verify the installed TikFinity application.

## Remaining trust boundaries

- Run **Start-Boxing.cmd** / `server.py` on loopback only. Do not expose the port through a public reverse proxy, forwarding rule or LAN binding. This is a local control room, not an authenticated multiuser service.
- Programs/users able to access the local port can construct well-formed requests, and software able to impersonate the local TikFinity endpoint can forge events. Host/Origin checks and the custom header defend browser request boundaries; they are not operating-system isolation or cryptographic proof of a gift.
- Keep **one dashboard** as the controller. Simultaneous controllers, separate browser profiles running their own adapters, restored browser backups and manually cleared replay history are outside the replay guarantee. Replay persistence is an at-most-once guard, not a transactional payment ledger.
- Native replay history is bounded to 40,000 keys and 1.5 million serialized JSON characters. It contains provider message IDs and, for combos, sender/gift/group IDs. It stays in local browser storage and is not sent to the state relay. When full/corrupt/unavailable, native events are rejected and the activity log reports the storage problem. Do not clear this history during an active stream: doing so permits old messages to be replayed. Back it up and clear `boxing-gift-replay-v1` only after ending the old stream and disconnecting its event source.
- Google Fonts and optional remote portrait hosts receive ordinary network metadata such as IP address. Portrait URLs are operator-selected; embedded credentials are rejected and referrers are omitted. Use trusted image hosts.
- Python's generic `http.server` fallback does not supply this server's allowlist, schema enforcement or security headers. Use it only for isolated development tests, never to serve a folder containing secrets. The launcher uses the hardened server.
- No Windows/Live Studio execution, installed-app penetration test, dependency/CVE service scan or formal independent audit was performed. Keep Python, Chromium/Live Studio and TikFinity updated. The project has no third-party Python/npm runtime packages to audit through a lockfile.

## Run the checks

```sh
node tests/security.mjs
python tests/security_server.py
node tests/tikfinity.mjs
# Start Chromium with its debug port, as in README, then start the hardened test server:
python server.py --port 8768
# Run sequentially; both tests below control their own test tabs on port 8768:
node tests/security-browser.mjs
BOXING_RELAY_URL=http://127.0.0.1:8768 node tests/relay.mjs
# Run tests/browser.mjs against the separate static development fixture at port 8766.
```

Use a dedicated headless browser/test profile. The HTTP dummy-file tests never read the user's real `.env` or Git configuration.

## Server clock and capture window

The local server now owns match timing and validates explicit start/reset/pause/settings/gift commands. Snapshot replacement requires the current revision; stale snapshots cannot overwrite a transition. The capture endpoint uses the existing same-origin JSON checks, accepts only an empty object, and launches only a fixed installed Edge/Chrome path with a fixed loopback overlay URL and shell disabled. Browser capture profiles are separate from the dashboard. These endpoints retain the existing trusted-local-application boundary.
