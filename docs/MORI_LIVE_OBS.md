# Mori Live OBS setup — local page verified, OBS acceptance pending

The secured avatar page is `http://127.0.0.1:4320/avatar`. No token belongs in
this URL. Dashboard: `http://127.0.0.1:4320/operator`. Optional numeric layout
query: `/avatar?x=0&y=0&scale=1` (x/y clamped ±50%, scale 0.25–2).
The JSON API on 4319 is NOT an OBS source.

Automated Chromium tests verified a 1280×720 transparent page, actual playback
events using a mock tone, Cubism mouth parameter movement, emergency mute,
crisis suppression and no reconnect replay. They do NOT verify OBS audio routing,
physical speakers, Azure voice quality or a recording. OBS was not found via PATH
or the standard Program Files install paths; provide its path if installed elsewhere.

## Windows manual acceptance

1. Follow MORI_LIVE_SETUP.md. Start `./scripts/start-mori-live.ps1 -Voice mock`
   (or azure after configuring its key/region). Open `/operator`, log in, and
   leave this dashboard open. Close any `/` combined preview or `/avatar` tab:
   exactly one renderer/audio connection is allowed, to prevent double playback.
2. In OBS Sources add Browser Source using the avatar URL, width 1280, height 720.
   Right-click the source → Interact, enter the separate operator code and click
   Connect. This user gesture unlocks audio; the login UI disappears when ready.
   OBS has its own cookie store, separate from your normal browser. If a source
   reload loses authentication, interact and log in again; never append tokens.
   Confirm transparency in a scene with a colored background.
3. Enable Control audio via OBS for this source. In Advanced Audio Properties,
   select the intended output track; use Monitor Off when monitoring would feed
   back into Desktop Audio. Disable duplicate Desktop Audio capture of the same
   TTS output or exclude the renderer from that capture path.
4. Add the source to a test scene and make a local recording, not a public stream.
   Confirm alpha, idle animation, readable framing, voice and mouth timing.
5. From `/operator`, Send Test Message, then exercise Pause, Stop and Emergency
   Mute during playback. Confirm both audio and mouth stop, and Resume does not
   replay. Check backend/TTS mode and reservation telemetry. Repeat with real
   Hoài My voice when configured; MOCK is only an audible test tone.
6. Refresh the source/reconnect; verify no previous event is spoken twice. Resume
   only after the operator sees a healthy connection and matching active session.

Record OBS version, selected audio device/track, local clip path, alpha result,
stop latency and reconnect result in MORI_LIVE_STATUS.md. Keep the clip private
because model redistribution rights have not been confirmed. Do not start a
public stream for this test. OBS WebSocket is not implemented or required.

## Remote deployment is a separate transport

Keep Nest and Python on loopback. For any future cloud backend, add a dedicated
authenticated TLS gateway with a fixed upstream allowlist, limited ingress,
separate credentials, request bounds and audited Host/Origin handling. The Python
adapter currently refuses non-loopback API URLs. Do not change it or Nest to
`0.0.0.0` to bypass that restriction. A secure gateway requires its own tests and
deployment configuration; it is not claimed implemented here.

E's actual OBS clip/routing gate is still open. F (YouTube) and G (archive/export)
have not started; simulated playback is not proof that OBS integration works.
