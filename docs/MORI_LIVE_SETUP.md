# Mori Live — Windows setup

Milestone B adds the Nest **PUBLIC_LIVE API** below. Milestone A's transport-only
fixture remains available on port 4318. Neither provides voice, a desktop avatar,
YouTube or OBS yet. MOCK uses deterministic responses, not a real safety model.

## Milestone B — public Nest API

Run a credential-free integration smoke first:

```powershell
npm run live:api:smoke
npm run test:live-api
```

This starts the actual public Nest module, sends simulated chat through the typed
bridge, closes/restarts Nest against the same public store, verifies replay and
cancellation, then deletes its own temporary test store. It does not use Supabase.

To start a persistent local API from the repository root:

```powershell
$env:MORI_LIVE_MODE = 'MOCK'
$env:MORI_LIVE_API_TOKEN = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
npm run live:api
```

Endpoint: `POST http://127.0.0.1:4319/v1/live`. Use `MoriLiveBridge` with that URL,
the dedicated API token, and `expectedMode: 'MOCK'`. Session/turn/cancel envelopes
are the same version 1 protocol as A. The bridge now defaults to a 50-second timeout
to exceed the API's default 45-second turn deadline. If changing either timeout,
keep the client timeout longer than the server deadline.

Alternatively, copy the template `apps/api/.env.live.example` to ignored
`apps/api/.env.live` and fill the token. `npm run live:api` loads that file; existing
process environment variables take precedence. The private API's `.env` is not
loaded. No private Supabase credential is required or used. `MORI_LIVE_API_TOKEN`
authenticates B; `MORI_LIVE_BRIDGE_TOKEN` authenticates only A's fixture.

The entrypoint lives in `apps/api/src/live.main.ts`, reusing Mori's existing
SafetyService, intent classification, provider abstraction and OutputGuard.
It does not register private controllers or instantiate private repository services.
The model receives empty approved memory and at most four approved public exchanges
from the same session. Request bodies cannot set a user, persona, history or memory.

### STAGING / REAL

Set `MORI_LIVE_MODE=STAGING` (or REAL after manual validation), `LLM_BASE_URL`
(HTTPS OpenAI-compatible base URL), `LLM_API_KEY`, `LLM_MODEL`, and the exact
`MORI_LIVE_INPUT_USD_PER_MILLION` / `MORI_LIVE_OUTPUT_USD_PER_MILLION` prices for
that provider/model. No default cloud price is assumed. The server refuses cloud
mode without complete configuration. Use the corresponding bridge `expectedMode`.
Persona is one of `mori-public-vi-v1` or `mori-public-en-v1`, selected on the server.
Do not change the persona/model in the middle of a session; create a new session.

Budget is a **conservative reservation**, not an invoice: each turn reserves seven
calls (including structured retries), each up to 48,000 prompt bytes plus 2,048
bytes of framing allowance and 700 output tokens. The configured per-million
prices convert that bound to USD. Input bytes assume a compatible byte-tokenized
model. No refunds on timeout, fallback or cancellation; no reset on restart or
new session. A provider with extra fees, different tokenization or ignoring
`max_tokens` needs an adjusted policy before use. Set the vendor's own account cap.
Cloud credentials, billing and quality have not been tested with a paid service.

### Storage, limits and recovery

Default store: `.mori-live/public-api/public-live.json` relative to the launching
working directory (repo root for `npm run live:api`). It contains **public input and
validated responses**, session/turn IDs, owner, model/persona provenance, safety
status and cost reservations. It is not an operational log or a training dataset;
eligibility is always prohibited. It does not contain API keys or private app data.
Restrict the folder's Windows ACL to the operator account; POSIX mode bits alone do
not configure Windows ACLs. Do not commit, share or enter private information here.

One process owns `writer.lock`. Writes use a flushed temporary file plus atomic
rename. Graceful Ctrl+C closes the store. After a crash, inspect the lock's PID and
verify no process uses this store before manually removing **only `writer.lock`**;
never delete `public-live.json` to reset a budget. On restart, pending turns become
cancelled and completed turns remain replayable. A corrupt store fails closed;
preserve it and restore a trusted backup rather than replacing it with empty data.

Bounds: one generation globally, 90 normal requests/minute by default, a separate
120 cancel requests/minute allowance, 100 turns/session by default, 64 retained
sessions, 4,096 total retained turns, 64MB store, and four-hour sessions by default.
Unknown/expired sessions fail closed. At capacity the server stops accepting new
work; no automatic data deletion is implemented in B. Retention/redaction/review
and deletion/export workflows belong to G. Do not deploy unattended with real
viewer data until those controls are ready. Multi-replica deployments require a
transactional public-only database implementation, not this single-writer file.

Manual cloud validation: send harmless Vietnamese text, an instruction to reveal
private memories, and a simulated safety-risk test; verify no private data access,
appropriate safety fallback, correct output status and no raw text in logs. Stop
a slow turn with `turn.cancel`, retry its IDs and verify empty cancelled output.
Use a small test budget and confirm 429 responses once reservations reach it.

## Milestone A — transport fixture

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
The private API still uses Supabase JWTs. The public Nest entrypoint uses a separate
desktop token, and does not expose private routes. Never give the desktop a
Supabase service-role credential.

## Assets, voice and platforms

The locally known model is Snow Neko. Confirm whether Fluffy Wintery Kitty refers
to that package or supply its manifest/assets privately before Milestone C. Verify
licensing separately. Compatibility with upstream's bundled Cubism Core is pending.
Vietnamese TTS, playback-driven mouth movement and device selection belong to D.
YouTube OAuth ingestion belongs to F; no credentials are needed for A simulation.
Facebook remains a future adapter. No automatic training/export exists in A;
all protocol responses are marked training prohibited.
