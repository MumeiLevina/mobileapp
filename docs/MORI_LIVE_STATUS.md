# Mori Live delivery status

## Latest continuation — D implemented/tested in mock, E browser verified

Date: 2026-10-11. The user selected Azure Speech `vi-VN-HoaiMyNeural` and explicitly
authorized continuing local development without an Azure key. Accordingly, D/E
development proceeded with labelled mock audio; **real voice/OBS acceptance is
NOT claimed**. Branch remains `experiment/live2d-snow-neko`. On continuation HEAD
was `6e6da35` (the preceding work had been committed externally); this agent has
not created commits or merged main.

### Delivered

- C: actual pinned Python adapter and Nest roundtrip remain verified. An operator
  regression found by the end-to-end test was fixed: a cancelled preview turn no
  longer prevents a NEW dashboard-submitted turn from playing.
- D: replaceable upstream TTSInterface provider; official Azure REST transport
  reads `MORI_TTS_KEY`/`MORI_TTS_REGION`, defaults to Hoài My, escapes SSML and
  validates bounded WAV. Missing credentials explicitly choose mock; configured
  provider errors fail closed. No ElevenLabs/Fish/local implementation is claimed.
- D: one active speech, synthesis/playback deadlines, actual browser playback
  events, RMS/noise gate/smoothing, real Cubism mouth parameter override, volume,
  supported output-device selection, interruption and emergency mute. Desktop
  private renderer build is separate from the unchanged Android behavior.
- E: transparent responsive `/avatar`, `/operator` dashboard with start/pause/
  resume/stop/mute/test, connection/avatar/emotion/current text/mode/error status.
  One audio renderer prevents duplicate capture. Authenticated read-only Nest
  status shows durable reservation/budget; actual provider tokens remain explicitly
  unavailable. No changes to private memory, orchestrator, safety or output guard.
- Supervisor start/shutdown preserves public data and releases writer.lock.
  Optional Windows CI workflow tests synthetic fixtures without proprietary assets.
  Audit, Windows quick start, Azure configuration and OBS manual procedure updated.

### Executed evidence

- `npm ci`: passed (actual package manager; no dependency/integrity edits).
- `npm run typecheck`, `npm run lint`: passed.
- Root Jest: 207 tests / 25 suites passed; 53 tests / 2 suites skipped by existing
  external-integration gates. One new assertion initially matched `context` as
  `text`; it was corrected to check exact field names and provider-secret absence.
- Mobile: 47 tests / 18 suites passed. Live bridge: 10 passed. Public Live: 22 passed.
- Existing mock fixture smoke, actual Nest MOCK smoke, API build and Expo web
  export all passed. Export remains 1,618 modules.
- `npm run test:python`: 29 Python tests plus 6 browser-player logic tests passed,
  including wrong auth, mismatch, expiry, duplicates, cancellation, disconnect,
  missing assets, CSRF, controls, silent/short/long/bad audio, overlap, delayed
  synthesis, real timeout paths, mock Azure HTTP failures and SSML escaping.
- `npm run lint:python`: passed using pinned ruff 0.9.1.
- `node scripts/verify-mori-launcher.mjs`: actual Nest/Python startup and controlled
  shutdown passed; public store retained and writer.lock removed normally.
- Real Chromium + real Nest + real Python + Snow Neko, with MOCK tone: passed.
  Final sample: model ready 1,388ms, 27fps sampled, ~64MB JS heap (not RSS),
  19,324 character-colored pixels. A 1.5s tone began ~320ms after test input;
  both commanded and actual Cubism mouth parameter rose to ~0.073 then zero.
  Emergency mute, crisis expression suppression, transparent 1280×720 page
  (817,196 fully transparent pixels) and reconnect without replay passed.
  These are local observations, not cloud TTS or OBS performance claims.
  Private evidence: `.mori-live/voice-mock-verification.json` and its screenshot
  directory (`avatar-transparent.png` is beside `snow-neko.png`).

### Gates / remaining work

Azure credentials were absent from the accessible process environment; actual
Hoài My speech, pronunciation and physical audio-device output are **NOT RUN**.
OBS was not found on PATH or in standard Program Files locations. A real OBS
Browser Source/audio-routing check and local recording are **NOT RUN**; follow
MORI_LIVE_OBS.md or provide the installed OBS path. CI workflow dispatch is **NOT RUN**.
Android physical-device/regression APK testing in this desktop milestone is **NOT RUN**.

F/G have **NOT STARTED**, because the original execution policy requires a working
local OBS integration before YouTube and later archive/export. No OAuth credentials
are requested yet. No YouTube/Facebook ingestion, public event archive, reviewed
JSONL export or model training is claimed. Existing public backend storage still
lacks G's retention/redaction/review controls: use synthetic data, not unattended
real viewer chat. Keep all training eligibility prohibited. Future self-hosted
inference remains through the existing Nest provider boundary, never avatar Python.

Changed implementation groups across C–E: `apps/live-desktop/python/` (adapter,
protocol, model audit, restricted server, providers/player, dashboard and tests),
read-only status in `apps/api/src/modules/live/` and `packages/live-protocol/`,
desktop preparation/launcher/verification scripts, package scripts, live API test,
manual Python CI workflow and the four Mori Live docs plus MORI_LIVE_AUDIT.md.
No model/Core files or secrets are tracked. Dependency advisories remain triaged,
not fixed; see MORI_LIVE_AUDIT.md before any public deployment.

## Milestone C update — 2026-10-11

IMPLEMENTED / VERIFIED locally: actual upstream `AgentInterface` and
`SentenceOutput`, strict Python protocol validation, bounded at-most-once output,
cancellation/expiry/recovery, no upstream memory/history/tools/server imports.
Restricted loopback FastAPI launcher has separate HttpOnly operator session,
Host/Origin checks, one WebSocket, no microphone, exact private asset allowlist.
The stock frontend is a compiled artifact with stock-server coupling; C reuses
Mori's existing official Cubism renderer instead of rewriting it or serving stock
config/history/microphone controls. Model/Core files remain ignored/private.

Actual frozen sync installed CPython 3.11.13 and 103 packages with uv 0.8.22;
runtime/frontend commits and uv.lock SHA256 remain unchanged.
`python -m unittest discover -s apps/live-desktop/python/tests -v`: 17 passed.
`python -m ruff check apps/live-desktop/python`: passed (locked ruff 0.9.1).
`node scripts/verify-mori-python.mjs`: actual Nest MOCK → Python → Chromium
Snow Neko; 1,539ms ready, 33fps sampled, ~72.2MB JS heap (not process RSS),
19,531 character-colored screenshot pixels, zero page errors. One backend turn
after duplicate submission, allowed `cry` expression delivered, returned idle.
Evidence is private: `.mori-live/python-verification.json` and referenced image.
These are local machine observations, not audio/OBS/Android performance claims.

Snow Neko v3: all 41 references present, four textures, 33 expressions, one Idle.
Core reports 100663297 (6.0.1). Emotion mapping: neutral→idle, happy→blushing,
sad→cry, confused→sullen_face, surprised→neutral (no verified subtle expression).
Appearance expressions are excluded; fallback always neutral. Fluffy Wintery
Kitty is not identified with Snow Neko. Rights to redistribute are NOT VERIFIED.

Changed C files: `apps/live-desktop/python/{launch.py,mori_live/*,web/*,tests/*}`,
`scripts/verify-mori-python.mjs`, `scripts/setup-mori-live.ps1`, live documentation.
D is next; E/F/G remain gated. This section supersedes the A/B-only runtime
limitations in the historical baseline below, not its storage/budget warnings.

Date: 2026-10-11. Scope delivered: **Milestones A and B**.
This is not completion of the full A–G integration.

## Implemented

- Audited Mori and Open-LLM-VTuber source; recorded decision, diagram, extension
  points, public/private boundaries, licensing inventory and compatibility risks.
- Pinned runtime v1.2.1, frontend gitlink, uv.lock checksum and Python selection.
- Added `@mori/live-protocol` strict versioned schemas and `@mori/live-desktop`.
- Implemented authenticated loopback HTTP mock fixture and typed client with
  response identity/mode checks, bounded request/response bodies, timeout and
  cancellation, replay conflict detection, expiry and bounded session/turn cache.
- Added simulated roundtrip, reconnect/replay/cancel smoke and Windows setup script.
- B: separate public Nest entrypoint, dedicated credential/principal, public-only
  atomic repository, versioned persona, bounded same-session context, durable
  idempotency/cancellation and cumulative budget reservations.
- B: reused existing safety, intent, provider and output guard; classifier outages,
  elevated/crisis, provider failures and rejected outputs fail closed.
- Private controllers/auth, mobile source and migrations are unchanged. Shared
  HTTP provider gained optional cancellation and a narrower config type; mock
  provider gained only an explicit return type. Existing callers retain behavior.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, all five workspaces |
| `npm run lint` | PASS |
| `npm test` | PASS: B regression 25 suites / 206 tests; 2 suites / 53 tests skipped by existing credential gates |
| `npm run test:live` | PASS: 10 transport/security tests, included in root total |
| `npm run test:mobile` | PASS: 18 suites / 47 tests |
| `npm run live:smoke` | PASS: actual loopback HTTP roundtrip, replay after client reconnect, cancellation |
| `npm run test:live-api` | PASS: 21 B tests for orchestration, privacy boundary, fail-closed behavior, budgets, persistence, concurrent/replayed/cancelled turns, timeouts, auth, Host/Origin, body limit and quota |
| `npm run live:api:smoke` | PASS: actual Nest + typed bridge roundtrip, replay across application restart, cancellation; MOCK only |
| `npm run export:web` | A evidence: PASS; Metro compiled 1,618 modules; mobile source unchanged in B |
| `npm run build:api` | PASS |
| `node scripts/verify-mori-live-baseline.mjs` | PASS: existing Nest process starts, private route returns 401; synthetic config, not real Supabase integration |
| `npx playwright test` | A evidence: PASS, 15 existing app workflows on exported web/demo mode |
| PowerShell setup parsing | PASS |
| `./scripts/setup-mori-live.ps1 -FetchUpstream` | PASS: clean npm ci, WebView patch applied, mock smoke, runtime/frontend commits and uv.lock hash verified |
| Python tests/lint | NOT RUN: no Python adapter implemented in A/B |
| Real provider/Supabase integration | NOT RUN; credential-gated tests remain skipped |
| Native device regression | NOT RUN in this change |
| Python runtime / TTS / lip-sync / OBS / YouTube | NOT IMPLEMENTED or TESTED in A/B |

The first bridge test run exposed a test transport issue: Node fetch did not send
the overridden Host. The test now uses node:http and verifies a real hostile Host
is rejected with 403. Final regression run is green. Expo notification tests emit
the existing Expo Go remote-push warning; local tests pass.

## Limitations and next milestones

The B HTTP integration test verifies private DatabaseService, MemoriesService and
AIOrchestratorService are absent from the public Nest container. Private routes
return 404; mobile JWTs do not authenticate the public API. Service tests reject
private identifiers and other principals and verify no embedding/memory access.

The public API is implemented. Python agent adapter, TTS, avatar page, dashboard,
training archive/export/review, YouTube OAuth and OBS connection remain C–G. No mock
transport event is a record of actual spoken audio. Training eligibility is always
prohibited and no export is offered.

Both A and B support one operator credential, not multi-tenant identities. A
fixture sessions are volatile; B sessions, turns and budget reservations persist.
The B single-writer file repository is not for multi-replica deployments. Client cancellation stops
waiting; an explicit cancel request creates a terminal server tombstone. There is
no playback to mute at this milestone. No auto-retry or automatic session recovery.

Next: Milestone C's pinned Python adapter and secured runtime. Keep the A fixture
separate from B's actual backend. Cloud mode has not been tested with real keys;
the B safety tests use controlled providers, not a clinical or live safety evaluation.
Budget estimates depend on correct configured prices and max-token compliance.
Public raw inputs currently persist locally without automated retention/redaction;
G must supply those workflows before unattended real-viewer operation.

For C, local Python discovery found only Python 3.14 (unsupported by pinned
upstream) and no `uv` on PATH. Install uv and use Python 3.11 with the frozen lock
before claiming a Python runtime test. The pinned stock server also needs Host,
Origin/auth hardening and removal of raw conversation logs before launch.

The available private asset directory is Snow Neko. The identity/license and Core
compatibility of the requested Fluffy Wintery Kitty model remain unverified.
Later milestones must retain a working mock path when real services are missing.

The clean npm install reported 67 dependency advisories (15 moderate, 51 high,
1 critical). These have not been individually triaged in A and must be reviewed
before production release. No broad dependency upgrade or `audit fix --force` was
performed as part of the transport foundation.

See [architecture](MORI_LIVE_ARCHITECTURE.md), [Windows setup](MORI_LIVE_SETUP.md),
and [future OBS manual checks](MORI_LIVE_OBS.md).
