# Mori Live delivery status

Date: 2026-10-11. Scope delivered in this change: **Milestone A**.
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
- Existing private API, mobile source and database migrations are unchanged.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, all five workspaces |
| `npm run lint` | PASS |
| `npm test` | PASS: 24 suites, 184 tests; 2 suites / 53 tests intentionally skipped by existing service-credential gates |
| `npm run test:live` | PASS: 10 transport/security tests, included in root total |
| `npm run test:mobile` | PASS: 18 suites / 47 tests |
| `npm run live:smoke` | PASS: actual loopback HTTP roundtrip, replay after client reconnect, cancellation |
| `npm run export:web` | PASS; Metro compiled 1,618 modules |
| `npm run build:api` | PASS |
| `node scripts/verify-mori-live-baseline.mjs` | PASS: existing Nest process starts, private route returns 401; synthetic config, not real Supabase integration |
| `npx playwright test` | PASS: 15 existing app workflows on exported web/demo mode |
| PowerShell setup parsing | PASS |
| `./scripts/setup-mori-live.ps1 -FetchUpstream` | PASS: clean npm ci, WebView patch applied, mock smoke, runtime/frontend commits and uv.lock hash verified |
| Python tests/lint | NOT RUN: no Python adapter implemented in A |
| Real provider/Supabase integration | NOT RUN; credential-gated tests remain skipped |
| Native device regression | NOT RUN in this change |
| Python runtime / TTS / lip-sync / OBS / YouTube | NOT IMPLEMENTED or TESTED in A |

The first bridge test run exposed a test transport issue: Node fetch did not send
the overridden Host. The test now uses node:http and verifies a real hostile Host
is rejected with 403. Final regression run is green. Expo notification tests emit
the existing Expo Go remote-push warning; local tests pass.

## Limitations and next milestones

The mock fixture cannot access any private repository because it has no database
or LLM dependency, but this does **not** prove the future public Nest API's
isolation. B must implement and test that boundary independently.

No public AI endpoint, Python agent adapter, TTS, avatar page, dashboard, archive,
dataset exporter, YouTube OAuth or OBS connection is implemented yet. No mock
transport event is a record of actual spoken audio. Training eligibility is always
prohibited and no export is offered.

Mock auth supports one operator credential, not multi-tenant identities. Sessions
are volatile; restart invalidates them. Create-event tombstones are bounded to 128
per process; restart the fixture for a fresh test run. Client cancellation stops
waiting; an explicit cancel request creates a terminal server tombstone. There is
no playback to mute at this milestone. No auto-retry or automatic session recovery.

Next: Milestone B's separate PUBLIC_LIVE Nest module/principal, public-only
repository, shared fail-closed pipeline, quotas/cost reservations and persistence.
Do not wire the fixture into production or call it a public AI backend.

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
