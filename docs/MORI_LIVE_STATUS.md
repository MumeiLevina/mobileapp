# Mori Live delivery status

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
