# Mori Live OBS verification — pending Milestone E

The A endpoint is JSON, not an avatar page. Do not add it as an OBS Browser Source.
No OBS stream has been tested in this milestone.

Once the secured renderer is implemented, the operator procedure is:

1. Start the local renderer and verify the documented loopback avatar page first.
2. In OBS Sources, add Browser Source with that renderer URL (never a token or
   remote-control secret), viewport 1280 x 720 and transparent background enabled.
3. Enable Control audio via OBS for this source. In Advanced Audio Properties,
   select the intended output track; use Monitor Off when monitoring would feed
   back into Desktop Audio. Disable duplicate Desktop Audio capture of the same
   TTS output or exclude the renderer from that capture path.
4. Add the source to a test scene and make a local recording, not a public stream.
   Confirm alpha, idle animation, readable framing, voice and mouth timing.
5. Exercise Stop and Emergency Mute while speaking; confirm audio stops immediately
   and queued speech does not resume. Current A cancellation tests do not test audio.
6. Refresh the source/reconnect; verify no previous event is spoken twice. Resume
   only after the operator sees a healthy connection and matching active session.

The final renderer URL, UI controls, autoplay behavior, OBS version/device routing,
real stop latency and reconnect results must be recorded when E is implemented.
OBS WebSocket credentials are unnecessary for basic Browser Source capture.
