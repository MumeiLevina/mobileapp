# Mori public-beta release evidence tracker — 2026-11-04

**Decision: NO-GO pending proof.** This is an evidence tracker, not a release approval. Connected Android application `app.mori.companion` only. `demo-qa` must never be distributed as Connected public beta.

## Observed GitHub baseline (4 November 2026)

- Integration branch: `integration/android-closed-beta` at `b93f94557300b0f8ac2d0b07f6130319f64c4ab9`.
- [PR #15](https://github.com/MumeiLevina/mobileapp/pull/15): Draft, unmerged; head `47b81174b50e21a412bdaa0cc46a19c7c17cbade`.
- [PR #16](https://github.com/MumeiLevina/mobileapp/pull/16): Draft, unmerged; head `291ff86fcce0a7780ee332d0210c58d28bd3f2da`, contains #15 ancestry. [Exact-head CI run 40284995206](https://github.com/MumeiLevina/mobileapp/actions/runs/40284995206): completed successfully 2026-10-26. This proves only the covered checks.
- [PR #17](https://github.com/MumeiLevina/mobileapp/pull/17): Draft, unmerged; release-control documentation.
- #16 reported: 264 root tests passing with 85 intentionally skipped; 129 mobile tests; 79 offline safety cases; 23 PGlite database checks; 21 browser E2E. These are documented historical test results, **not** hosted/native/production certification.
- Recovery [Draft PR #18](https://github.com/MumeiLevina/mobileapp/pull/18), based on #16: code commit `b9772aae23c8183f61c337dd5b5fc7f897b8b7b6`. It rejects public server-role/wrong-project keys, probes Sprint 3 Memory schema, captures actual Jest exit/results, and prepares Windows release signing. It targets #16's feature branch; no merge was performed.
- Real-provider engineering evaluation now has direct passing evidence (below). Deployed provider parity and final safety sign-off remain unverified.
- No signed **Connected** APK on a final reviewed integration commit, hosted migration, physical Android QA, public privacy/deletion URLs, or validated operational rollback has been established.

## P0 evidence board

No gate below is closed by this recovery. P0-03 has a passing local real-provider subcheck; hosted parity and owner sign-off remain open. GitHub CI alone cannot close a hosted/native gate.

| Gate | Status | Required evidence to attach | Pass / fail ownership |
| --- | --- | --- | --- |
| P0-01 reviewed integration | BLOCKED | Review #16/#18 and SQL grants/RLS/client_id compatibility; merge #16 once (not #15 separately), final integration SHA and exact-head CI | maintainer |
| P0-02 staging database/API | BLOCKED | Supabase NXDOMAIN; project state/history unknown; Render health 404 and deploy SHA unknown. Restore verified isolated staging, approve migration, run hosted Auth/RLS/Memory concurrency/deletion checks | maintainer + tester |
| P0-03 real provider/safety | PARTIAL — evaluation PASS | 57/57 at baseline and recovery code; zero FP/FN/critical FN; fallback 7/13. Still require deployed model parity, fallback review and safety-owner sign-off | safety tester |
| P0-04 Connected signed APK | BLOCKED | Fixture prebuild/Gradle dry-run/signing-config check passed; no APK. Need healthy staging, reviewed version/source, owner signing, manifest/SDK/SHA and no-Metro cold start | Android builder |
| P0-05 native/device QA | NOT RUN | No Connected APK/device. AVD blocked by Windows lock permissions; no boot confirmed. Execute native checklist for keyboard, Back, accessibility, timers, privacy and switching | Android tester |
| P0-06 privacy/legal/support | NOT VERIFIED | public privacy URL, out-of-app deletion pathway, support inbox, retention/disclosure and store declarations verified | product owner |
| P0-07 operations/rollback | NOT VERIFIED | service deploy SHA, backup evidence, tested rollback/withdrawal, monitored alert routing, incident owner | operator |
| P0-08 verified distribution | NOT RUN | HTTPS download page, version+SHA-256, test download/install on distinct device, consent/feedback notices | product owner |

## Execution order (non-destructive until maintainer approval)

1. Review #16 carefully. Verify it includes #15 ancestry; do not duplicate the merge. Confirm compatibility for old manual Memory clients missing `client_id`.
2. Recheck migration `202610260001_memory_creation_idempotency.sql` for permissions, locking, fingerprints, deletion tombstones and rollback. Record approved sequence before any hosted change.
3. On a **clean checkout** of the reviewed code, execute `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run eval:safety`, `npm run test:mobile`, `npm run test:database`, `npm run build:api`, `npm run test:e2e`. Record exact commit and exit codes; avoid posting secrets/log payloads.
4. With explicit staging authorization and isolation confirmed, execute `npm run preflight:staging`, approved migration procedure, `npm run test:supabase`, `npm run verify:staging`, `npm run eval:safety:staging`. **Never point destructive staging verification at production.**
5. Build a **Connected** preview APK only from the validated candidate, using `EXPO_PUBLIC_DEMO_MODE=false`, actual HTTPS endpoints, public anon key (never service-role key). Inspect Android manifest, signing/permissions, and SHA-256; install on a physical device.
6. Sign off high-risk P0 cases and verify public privacy/deletion/support, monitoring, rollback and distribution. Stop on any unresolved P0 defect.

## Evidence record (fill only after verification)

- Release code SHA: UNVERIFIED; evaluated baseline `291ff86fcce0a7780ee332d0210c58d28bd3f2da`, recovery code `b9772aae23c8183f61c337dd5b5fc7f897b8b7b6`
- Review/merge decision: PENDING
- Migration staging identity/version and result: NOT RUN
- API SHA: UNKNOWN; observed Render `/health` 404, protected routes 401; hosted Auth/RLS NOT RUN
- Real-provider engineering: PASS 57/57, OpenAI `gpt-4o-mini`; hosted provider/model parity NOT VERIFIED
- APK package / version / source SHA / SHA-256: NOT BUILT
- Device model / Android version / native QA result: NOT RUN
- Public privacy/deletion/support links: NOT VERIFIED
- Recovery/withdrawal rehearsal result: NOT VERIFIED
- Final owner decision / time: **NO-GO**

## Recovery performed on 4 November 2026

Machine-readable sanitized evidence: [connected-recovery-20261104.json](evidence/connected-recovery-20261104.json).
Restoration, build and device procedure: [recovery runbook in PR #18](https://github.com/MumeiLevina/mobileapp/blob/fix/connected-beta-recovery-20261104/docs/CONNECTED_STAGING_RECOVERY_2026-11-04.md).

### Interrupted jobs and real provider

- `bl40a9bja` never ran Jest: Node could not find `apps/api/.env`; a pipeline hid the failure and printed exit 0. `bn8suiweh` failed shell export syntax before emulator startup. Neither old process exit certifies a gate.
- Correct baseline run: actual Jest exit 0, 1 suite, **57 PASS / 0 FAIL / 0 SKIP**, 74.559 seconds, explicitly enabled. OpenAI `gpt-4o-mini`; `text-embedding-3-small` configured but embeddings not exercised by this evaluation.
- Repeat through the new fail-closed runner at recovery code: actual Jest exit 0, **57/57**, enabled and complete. The checkout's only tracked changes during evaluation were E2E screenshots; no pending source changes. The report records `trackedChanges=true` honestly.
- Both runs: raw classification **22/22**, SafetyService **22/22**, each **FP 0 / FN 0 / critical FN 0**. All benign Vietnamese classification fixtures passed. Output guard/contextual-dependency **13/13**; **6/13** natural responses, **7/13 fallback (53.85%)**, **0/13 accepted policy violations**. One fallback is a deliberately rejected dependency fixture; summary does not distinguish individual rejection reasons.
- Each run logged **68 successful provider request events**, no non-success event, timeout, malformed-response diagnostic or rate limit. Fallback rate needs product/safety-owner review. This is synthetic engineering evidence, not clinical validation or deployed configuration proof.
- Temporary provider env was initially unignored with broad local read ACLs. It was excluded, permissions restricted, then safely removed after evaluation once confirmed to duplicate existing ignored provider configuration. Retained API env ACLs were restricted. No credential values were printed, committed or uploaded; no external disclosure was observed.

### Regressions and confirmed local defects

- Old app config accepted synthetic service-role and wrong-project JWTs as public keys; both are rejected by recovery code. Tests cover private/expired/malformed keys and extra public server-secret variables.
- Old staging probe omitted `memory_creation_requests` and `memories.client_id`; recovery checks table/identity columns and fails closed on the old schema. Hosted RPC grants/concurrency still need direct checks.
- Typecheck **PASS**, lint **PASS**, final root Jest **280 PASS / 85 intentionally SKIP** (27 passing suites, 2 skipped), mobile **129/129**, offline safety **79/79**, SQL/PGlite **23 checks**, API build **PASS**, browser E2E **21/21** (40.1 s, explicit Demo web only).
- Compiled local API with uncalled synthetic dependencies returned `/health` **200** `{"status":"ok"}` and `/profile` **401** unauthenticated. This does not validate hosted dependencies.
- Historical #16 exact-head CI remains successful. Recovery code `b9772aa` exact-head CI **PASS**: [Mori checks #119](https://github.com/MumeiLevina/mobileapp/actions/runs/41723929969). The later documentation-only head `fd11198` has a separate CI run; its full result was still pending at this snapshot. Complete regression must run again on the final reviewed integration commit.

### Supabase / Render

- Inspected main/staging mobile URLs/public JWT metadata, main API URL/service-role metadata and CLI project-ref all reference `fzptgnoxbfnfgvhpkzsv`; no newer reference found in inspected configuration/docs. Decoded JWT metadata is not live-key verification.
- At **04:25 Asia/Saigon on 4 November**, Google and Cloudflare DoH returned **NXDOMAIN**; Auth health failed **ENOTFOUND**. Root cause remains unknown: deleted, paused/unavailable or outdated project reference remain possibilities. No management token was available; CLI hit local telemetry-directory `EPERM`; dashboard access unavailable. No replacement project was created.
- Render `/`, `/health`, `/api/health` returned **404**; `/profile`, `/moods`, `/journals`, `/memories`, `/conversations` **401**. Source public health controller is registered with no global prefix; source/deployment behavior differ. Actual active deploy SHA/live health-check settings unavailable. Stale/wrong deployment is plausible, not proven. Blueprint service name differs from observed URL identity.
- Runbook requires project-state/isolation confirmation, migration-history/grant review, coordinated older-client `client_id` decision, approved migration before API deployment, synthetic cross-owner testing, secure credential handling and additive-schema-compatible rollback. No hosted mutation occurred.

### Android

- No Connected APK built/installed. Config is `app.mori.companion`, `0.1.0`, code `1`; owner must check version/signing against prior distribution.
- Fixture prebuild passed. Gradle **9.3.1**, JDK **17.0.20.101**, isolated cache: `assembleRelease --dry-run` passed. Actual `signingReport` passed with release config `moriConnectedRelease` / alias `fixture-only`. This verifies configuration using a synthetic short-lived keystore, not owner signing.
- Generated fixture min/compile/target SDK **24/36/36**, Build Tools **36.0.0**, NDK **27.1.12297006**. Final APK manifest, permissions, certificate/version/SHA remain unverified.
- Existing Gradle cache had lock access denial; separate cache resolved it. Emulator **37.1.11**, AVD `test` configured for Android **37.2 x86_64 / Google Play / 16 KB**, WHPX check passed. No running OS observed. Normal launch and separate-home read-only attempt failed existing `.android`/AVD lock creation. Newly launched processes stopped; original userdata/snapshots/ACLs untouched.
- Native cold start, Connected flows and physical-device/accessibility QA: **NOT RUN**. Executable checklist is in the runbook.

## Single next owner action

Open the intended Supabase organization and inspect **`fzptgnoxbfnfgvhpkzsv`**.
Record its actual status and confirm isolated staging. Restore the existing
project if paused; verify identity/history if a newer staging project exists;
if unrecoverable, explicitly approve a separate staging recovery. Do not paste
keys into chat/GitHub or repoint production. This decision unblocks the reviewed
migration → staging API → Connected APK → native QA chain.

## Safety and data-handling

Do not paste tokens, private journal contents, real conversations, health details or Supabase credentials into GitHub/CI artifacts. Keep actual user data out of QA captures. Never enable mock AI or automatic Demo fallback for public users. This tracker deliberately performs no merge, deploy, cloud build, live migration or publication.

See [launch gate](LAUNCH_2026-11-08.md) and [Sprint 3 stability handoff](https://github.com/MumeiLevina/mobileapp/blob/feature/wave4-sprint3-stability/docs/WAVE4_SPRINT3_STABILITY.md).
