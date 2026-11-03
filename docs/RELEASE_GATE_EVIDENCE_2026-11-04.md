# Mori public-beta release evidence tracker — 2026-11-04

**Decision: NO-GO pending proof.** This is an evidence tracker, not a release approval. Connected Android application `app.mori.companion` only. `demo-qa` must never be distributed as Connected public beta.

## Observed GitHub baseline (4 November 2026)

- Integration branch: `integration/android-closed-beta` at `b93f94557300b0f8ac2d0b07f6130319f64c4ab9`.
- [PR #15](https://github.com/MumeiLevina/mobileapp/pull/15): Draft, unmerged; head `47b81174b50e21a412bdaa0cc46a19c7c17cbade`.
- [PR #16](https://github.com/MumeiLevina/mobileapp/pull/16): Draft, unmerged; head `291ff86fcce0a7780ee332d0210c58d28bd3f2da`, contains #15 ancestry. [Exact-head CI run 40284995206](https://github.com/MumeiLevina/mobileapp/actions/runs/40284995206): completed successfully 2026-10-26. This proves only the covered checks.
- [PR #17](https://github.com/MumeiLevina/mobileapp/pull/17): Draft, unmerged; release-control documentation.
- #16 reported: 264 root tests passing with 85 intentionally skipped; 129 mobile tests; 79 offline safety cases; 23 PGlite database checks; 21 browser E2E. These are documented historical test results, **not** hosted/native/production certification.
- No proof observed of signed **Connected** APK on final release commit, hosted migration, real-provider safety sign-off, physical Android QA, public privacy/deletion URLs, or validated rollback.

## P0 evidence board

Each gate is **BLOCKED** until the linked evidence is added and the maintainer signs off. GitHub CI alone cannot close a hosted/native gate.

| Gate | Status | Required evidence to attach | Pass / fail ownership |
| --- | --- | --- | --- |
| P0-01 reviewed integration | BLOCKED | review of #16 including SQL grants/RLS/client_id and compatibility; merge #16 *once* (not #15 separately), clean integration commit SHA and its exact-head CI | maintainer |
| P0-02 staging database/API | NOT RUN | isolated staging project alias (never secrets), approved migration diff, applied version, Auth/JWT cross-user tests, memory duplicate/tombstone/concurrency checks, deletion and HTTPS health | maintainer + tester |
| P0-03 real provider/safety | NOT RUN | provider IDs, sanitized run/eval totals, VI/EN adversarial and benign cases, escalation/fallback audit, zero critical false negatives | safety tester |
| P0-04 Connected signed APK | NOT VERIFIED | exact source SHA, application ID, version code/name, signing identity, manifest permissions, target SDK, file SHA-256, cold start without Metro, real HTTPS endpoints | Android builder |
| P0-05 native/device QA | NOT RUN | device/OS matrix, keyboard/IME, Back/edge, 200% font, TalkBack, touch, suspended timers, private discard, switch owner, offline recovery, results with synthetic data | Android tester |
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

- Release code SHA: UNVERIFIED
- Review/merge decision: PENDING
- Migration staging identity/version and result: NOT RUN
- API SHA/URL health and Auth/RLS result: NOT RUN
- Hosted AI model and safety test outcome: NOT RUN
- APK package / version / source SHA / SHA-256: NOT BUILT
- Device model / Android version / native QA result: NOT RUN
- Public privacy/deletion/support links: NOT VERIFIED
- Recovery/withdrawal rehearsal result: NOT VERIFIED
- Final owner decision / time: **NO-GO**

## Safety and data-handling

Do not paste tokens, private journal contents, real conversations, health details or Supabase credentials into GitHub/CI artifacts. Keep actual user data out of QA captures. Never enable mock AI or automatic Demo fallback for public users. This tracker deliberately performs no merge, deploy, cloud build, live migration or publication.

See [launch gate](LAUNCH_2026-11-08.md) and [Sprint 3 stability handoff](https://github.com/MumeiLevina/mobileapp/blob/feature/wave4-sprint3-stability/docs/WAVE4_SPRINT3_STABILITY.md).
