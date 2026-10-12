# Mori Live audit — 2026-10-11

Initial branch: `experiment/live2d-snow-neko`, clean HEAD
`c738f7f50e67514f6a89da921b9630bd8efe5fdc`. On continuation, the working changes
were already committed externally as `6e6da35 TTS API test`; the agent did not
commit or merge. Subsequent fixes preserve that baseline.

## Boundaries and pins

- Zod protocol v1 is strict PUBLIC_LIVE; UUID request/event/session/turn identity,
  mode, response status, emotion and animation are validated. Python mirrors it
  with strict Pydantic and bounded response reads. New read-only status telemetry
  has no text/history/token fields and does not change budget reservations.
- Existing bridge has 50s timeout vs default Nest 45s; authenticated loopback,
  redirects disallowed, no browser Origin accepted by Nest. The Python browser
  boundary uses a separate operator cookie with same-origin/Host/CSRF checks.
- Public module contains no DatabaseService, MemoriesService or private
  AIOrchestratorService. MOCK is deterministic, not a real safety model.
  STAGING/REAL retain provider configuration, output guard and pricing gates.
- Cancellation produces terminal tombstones; persistent API replay does not
  reserve again. Python delivery consumes attempted IDs at most once (including
  uncertain failures), so retry does not cause repeated speech. Explicit operator
  restart is required for expired/blocked sessions; no automatic recovery loop.
- Atomic public-only repository retains cumulative conservative reservations,
  not actual token invoices. Raw public text still lacks G retention/redaction;
  do not run unattended on real viewer data.
- Upstream runtime `3afa41014b4548a0842e9ee2f576f4b164b48886`, frontend
  `06a659b114fff788cf0daaa86e484576db4975bf`, Python 3.11 and lock hash unchanged.
  Stock factory has no generic plugin; use real AgentInterface/SentenceOutput
  directly. Stock server permits unauthenticated controls, wildcard CORS, history,
  proactive speech and mic startup; it is NOT used.
- TTS manager logs text and its clear() does not cancel all synthesis tasks.
  Mori uses the real TTSInterface and existing WAV/base64/display/actions shape
  with a bounded single-turn owner and playback acknowledgments instead.
- Existing Expo/Android controllers and private renderer pipeline were inspected.
  Desktop preparation is explicitly separate; no mobile state/safety changes.

## npm advisory triage (not remediation)

`npm ci` recorded 67 advisories: 15 moderate, 51 high, 1 critical. A later audit
briefly reported 68; the final repeat returned 67. Counts reflect registry data,
including inherited vulnerable parent packages, not 67 independently exploitable
runtime bugs. `npm audit --workspace=@mori/api --omit=dev --json` reported **0**
for the API production dependency graph. This is not proof of application security.

| Finding group | Observed path / relevance | Action |
| --- | --- | --- |
| Handlebars critical compile/AST/property issues | ts-jest dev dependency; not a Nest PUBLIC_LIVE runtime import | Upgrade test toolchain separately; do not process untrusted templates in CI |
| braces/micromatch nested-pattern DoS | Metro/Jest/patch-package build and globbing paths; Expo dependency placement can retain tooling in prod installs | Keep build inputs trusted and dev servers local; scoped compatible upgrade needed |
| node-forge signature validation | Expo CLI/code-signing certificates | Relevant to build/signing verification, not the desktop bridge HTTP handler; coordinated Expo upgrade |
| decode-uri-component malformed input DoS | Expo router/server stack | Potential web routing relevance; current static web export is not an SSR server; inspect before any SSR deployment |
| sprintf-js precision DoS | argparse/tooling chains | Avoid untrusted format strings; test-tooling upgrade |
| uuid buffer bounds issue | xcode/config plugins, old uuid | iOS build tooling; desktop IDs use native crypto UUIDs |

No `npm audit fix --force`, dependency downgrade, fabricated integrity hash or
automatic major upgrade was performed. Private SDK sample build separately
reports 7 advisories (1 moderate, 6 high); it builds local static assets and no Vite
dev server is exposed. Locked Python packages are old; this work did not conduct
a full Python vulnerability-remediation migration. Loopback/auth restrictions are
defense in depth, not a substitute for a dependency update before public release.

## Verification and outstanding gates

See MORI_LIVE_STATUS.md for executed checks and private evidence paths. Azure
provider implementation is testable without a key; user explicitly authorized
continuing local/OBS development in mock mode. Actual Vietnamese speech and OBS
recording must not be represented by those mocks. F/G remain gated on local OBS
acceptance; no OAuth/platform ingestion or training export is claimed.
