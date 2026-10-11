# Mori Live — Windows setup

Milestone A is a working **MOCK transport fixture**. It does not yet run a public
LLM, speak, render an avatar, connect YouTube or stream to OBS. Never present its
deterministic responses as safety-reviewed production output.

Requirements: Windows PowerShell, Git, Node.js >=22 and npm. Python is optional in
A; upstream requires Python >=3.10,<3.13, with 3.11 selected in the pin file.

From the repository root:

```powershell
npm ci
npm run live:smoke
npm run test:live
```

The smoke command builds both new workspaces, starts an ephemeral loopback mock
server, sends simulated Vietnamese input, verifies dedup after reconnect and
cancellation, then closes the server. It needs no external credentials.

For a persistent mock fixture:

```powershell
$env:MORI_LIVE_MODE = 'MOCK'
$env:MORI_LIVE_BRIDGE_TOKEN = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
npm run live:mock
```

Default endpoint: `POST http://127.0.0.1:4318/v1/live`. The CLI does not load `.env`
automatically; use process environment variables. See `apps/live-desktop/.env.example`.
Do not use an LLM key, Supabase token or stream key as the bridge token. It is not
printed. Press Ctrl+C to stop; all mock sessions are in memory and expire in 30
minutes. Eight concurrent sessions, 100 turns/session and 120 requests/minute are
fixture bounds, not production billing controls.

Every request has version 1, context PUBLIC_LIVE, a UUID requestId and eventId.
Create a session with type `session.create`; server returns sessionId. Send
`turn.request` with sessionId, turnId, source simulated and input
`{type: 'viewer_chat', text: 'Xin chào Mori'}`. Use `MoriLiveBridge` for schema and
identity validation. Keep turnId/eventId stable on retry, refresh requestId. Do not
automatically retry 4xx errors or silently create a session after an expired one.
Consumers must deduplicate response eventId before playback. `turn.cancel` is a
terminal tombstone; client AbortSignal aborts waiting but does not replace the
explicit cancellation request. No browser or WebSocket access is supported in A.

## Upstream checkout

```powershell
./scripts/setup-mori-live.ps1 -FetchUpstream
# Optional large Python dependency installation; requires uv installed locally:
./scripts/setup-mori-live.ps1 -SyncPython
```

The script runs npm ci and mock smoke, clones upstream into ignored `.mori-live`,
checks runtime commit, frontend gitlink and uv.lock hash, and optionally runs
`uv sync --frozen --python 3.11`. It refuses a dirty checkout. It does not run
upstream's unauthenticated stock server. No source/model binaries are vendored.
Retain upstream license files. Do not publish `.mori-live`, `.private`, model
packages, caches or tokens. Upstream integration requires Milestone C's launcher.

## Existing Mori API / App

Keep the existing `apps/api/.env` and mobile configuration described in README.
`npm run dev:api` runs Nest with existing Supabase/LLM configuration.
`npm run dev:mobile` starts Expo. Neither is needed by the A mock fixture.
The desktop token currently authenticates **only the mock fixture**; a production
public Nest endpoint is a later milestone. Never send it to private API routes or
give the desktop a Supabase service-role credential.

## Assets, voice and platforms

The locally known model is Snow Neko. Confirm whether Fluffy Wintery Kitty refers
to that package or supply its manifest/assets privately before Milestone C. Verify
licensing separately. Compatibility with upstream's bundled Cubism Core is pending.
Vietnamese TTS, playback-driven mouth movement and device selection belong to D.
YouTube OAuth ingestion belongs to F; no credentials are needed for A simulation.
Facebook remains a future adapter. No automatic training/export exists in A;
all protocol responses are marked training prohibited.
