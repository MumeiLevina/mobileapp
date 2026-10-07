# Real environment validation record

Record only observed results. Never paste credentials, tokens, private test
content or production data. `NOT RUN` means there is no execution evidence.

## Candidate

| Field                  | Recorded value                             |
| ---------------------- | ------------------------------------------ |
| Commit SHA             | NOT RECORDED — real validation has not run |
| Date                   | 2026-10-08                                 |
| Environment            | Local credential-free preparation only     |
| API deployment         | NOT RUN                                    |
| Supabase project alias | NOT RUN                                    |
| LLM provider           | NOT RUN                                    |
| LLM model              | NOT RUN                                    |
| Embedding model        | NOT RUN                                    |
| Android build          | NOT RUN                                    |

## Results

| Gate                                     | Result   | Evidence                                                                   |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------- |
| Default CI                               | NOT RUN  | Run the full sequence on the final commit.                                 |
| Dependency audit                         | REVIEWED | 64 findings: 49 high, 15 moderate, 0 critical; no forced incompatible fix. |
| Configuration preflight with real values | NOT RUN  | Required variables are absent in this workspace.                           |
| Hosted Supabase integration              | NOT RUN  | No staging URL or credentials are available.                               |
| Deployed HTTPS API health                | NOT RUN  | No staging API URL is available.                                           |
| Real provider text/structured/embedding  | NOT RUN  | No provider configuration is available.                                    |
| Provider-backed safety evaluation        | NOT RUN  | Critical false negative count: NOT RUN.                                    |
| Android preview APK                      | NOT RUN  | Expo project is not linked; `extra.eas.projectId` is absent.               |
| Physical Android QA                      | NOT RUN  | No APK/device session was performed.                                       |
| iOS QA                                   | NOT RUN  | Android is prioritized first.                                              |

## Credential-free evidence

Repository tooling now includes full Wave 1–3 hosted RLS/cascade coverage,
schema compatibility probes, real API smoke checks, Private Conversation
non-persistence and idempotent-save checks, export v6 checks, provider checks,
and supported-path account deletion. These checks being present is not a hosted
PASS. Record final local CI and dependency audit results here only after they
are executed on the final commit.

## Known issues and blockers

- P0: none found by credential-free checks; real P0 status remains unverified.
- P1: none open from local testing; real service/device status remains unverified.
- P2: none recorded in this validation pass.
- Hosted service credentials and deployment identifiers are unavailable.
- EAS project linkage and preview environment are unavailable.
- No Android APK has been built or installed on a physical device.

## Required execution

With staging values loaded in the shell, run:

```sh
npm run preflight:staging
npm run test:supabase
npm run verify:staging
npm run eval:safety:staging
```

Run the protected GitHub `Mori staging verification` workflow with
`workflow_dispatch` after the same values are configured in its `staging`
environment. Record the run URL, exact commit and non-secret provider/model
identifiers above.

To link EAS, review the generated project ID before committing it:

```sh
cd apps/mobile
npx eas-cli login
npx eas-cli init
```

Then configure the EAS `preview` environment with only
`EXPO_PUBLIC_DEMO_MODE=false`, the staging HTTPS API URL, the staging Supabase
URL and the anon/public key. Build without submission:

```sh
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

Install the resulting internal APK and complete `NATIVE_QA.md`, Android first.

## Wave 4 readiness

**NOT READY — MANUAL VALIDATION REMAINS**

Hosted Supabase/API, the real provider and provider safety suite, EAS preview
build, and physical Android QA have not actually run. Wave 4 stays frozen until
all required gates pass with no open P0/P1 issue.
