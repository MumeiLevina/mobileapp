# BETA QA ROUND 2 — Mori Mobile

Validation date: 2026-10-22 (Asia/Saigon). Continued the existing work in
`C:\Users\hantu\.codex\mobileappcuatoi-staging` on
`fix/mobile-beta-qa-round2`, based on `706bfd5`. PR target:
`integration/android-closed-beta`. Release readiness: **BLOCKED**.

## Review of the inherited changes

Reviewed the complete tracked diff before editing, plus the existing QA note
and scratch probe. The four reportedly rewritten source files had small diffs
against HEAD; their existing loading/error states, search, guided-journal
navigation, pattern evidence, private save/discard flow and shared controls
were inspected. No reset, clean or stash was used.

- Corrected the accidental `HOẠT ĐỘC` and `NHẬT KÌ` substitutions by retaining
  the original labels and their translation keys.
- Restored the shared `leave` handler; the duplicate inline implementation
  caused the initial lint failure.
- Restored clearing the date filter when hiding the calendar. Otherwise the
  list could remain filtered while the filter control was hidden.
- Removed the inherited 0/300 ms Modal timers. `mounted && visible` becomes
  false immediately on close, so the extra 300 ms did not preserve visibility
  through the exit animation. No evidence established that a timer fixes the
  native touch issue.
- Removed the inherited responder-termination override. Installed React Native
  Pressable spreads its own Pressability event handlers after user props, so
  this override did not establish the claimed native fix. The existing
  Pressability/onPressOut lifecycle is retained.

## Confirmed defects fixed

| Area | Reproduction before fix | Resulting behavior |
| --- | --- | --- |
| Draft hydration | A delayed read overwrote newly typed text | A revision check preserves newer edits |
| Draft identity | Changing keys exposed the previous draft as ready | The new key starts with empty text and ready=false |
| Draft clear/edit | A completed clear erased text entered after clearing started | Clear changes UI text only if no newer edit exists; failed deletion preserves text |
| Logout/account cleanup | A second queued edit survived encrypted-data cleanup | Draft registration, complete encrypted writes, explicit deletes and cleanup share one queue, populated synchronously |
| Storage recovery | One registration rejection poisoned subsequent operations | A later queued operation can recover; the failed caller still receives its error |
| Private save lifecycle | Backdrop dismissal closed the sheet while Save was pending | Close/continue/discard/navigation and editing are blocked during Save; Save also waits for a pending send |
| Localization | Calendar dates/accessibility and pattern labels/counts mixed locales | These controls follow vi/en; private message content remains unchanged |
| Pattern disclaimer | English API disclaimer and Vietnamese UI disclaimer appeared together | One localized disclaimer is displayed |
| Lexical calibration | `diet`/`diesel` matched `want to die`; `sometimes` matched `met` | Token boundaries prevent these matches; English `I met` is distinguished from Vietnamese `mệt`; spaced/obfuscated explicit-risk tests remain covered |
| Real classifier | Raw LLM missed two Vietnamese indirect burden statements | Prompt explains indirect/passive risk and contrasts ordinary absence; two additional paraphrases exercise generalization |

Regression coverage includes calendar date filtering, month navigation,
repeated opening/closing, bottom-sheet visibility and unmount, encrypted chunk
publication/failure/delete ordering, pending edits at logout, private discard
without persistence, explicit save, locale changes and private-content integrity. A delayed-write remount test additionally reproduced restoration before all prior edits finished; hydration now waits for the shared queue.
Jest and browser tests do **not** verify the Android native responder runtime.

## Final quality gates

Raw local execution logs are under `artifacts/qa-round2-*`; they are retained
locally and excluded from the source commit.

| Gate | Result | Observed evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS | All three workspaces |
| `npm run lint` | PASS | No remaining lint errors |
| `npm test` | PASS for executed tests | 248 passed, 85 skipped; 23 passed suites, 2 skipped suites |
| `npm run test:mobile` | PASS | 60/60 tests, 25/25 suites |
| `npm run eval:safety` | PASS | 79/79; FP=0, FN=0, critical FN=0 |
| `npm run test:database` | PASS | 19 local PGlite migration/RLS/ownership/idempotency/cascade checks |
| `npm run build:api` | PASS | Shared package and API compiled |
| `npm run export:native -- --output-dir dist-native` | PASS | Android and iOS Hermes bundles exported; this is not an APK/device pass |
| `npm run test:e2e` | PASS | Web export and 16/16 Chromium tests, including calendar/sheet regression |
| Real-provider safety evaluation | PASS | 57/57; details below |
| Staging configuration preflight | FAIL | Required staging and Supabase variables absent; no network requests made |
| Hosted Supabase Auth/RLS tests | BLOCKED / NOT RUN | No staging URL, anon key or service-role key in the verification environment |
| Staging API plus disposable-account E2E | BLOCKED / NOT RUN | No deployed staging API/account configuration |
| New EAS preview APK | BLOCKED / NOT RUN | Missing prerequisites below |
| Physical Android QA | BLOCKED / NOT RUN | `adb devices -l` lists no attached devices |
| Production deployment / automatic merge | NOT RUN | Outside the authorized release actions |

The local root run includes the pre-existing, untracked
`tests/zz-scratch-probe.test.ts` (one logging-only exploratory test). The other
247 passed root tests are versioned tests. The default root command skips
57 provider tests and 28 hosted Supabase tests by configuration. The provider
suite was separately enabled and executed against the real model; the 28
hosted tests remain NOT RUN. A skipped suite is never counted as a hosted pass.

## Sequential AI Safety audit and real-provider results

Completed locally without subagents. Reviewed the integrated changes from
[PR #8](https://github.com/MumeiLevina/mobileapp/pull/8),
[PR #10](https://github.com/MumeiLevina/mobileapp/pull/10) and
[PR #11](https://github.com/MumeiLevina/mobileapp/pull/11), confirmed by GitHub
metadata and their local merge diffs (`db85ff1`, `7bf7a6b`, `706bfd5`).

- #8: inspected strict JSON schema, Zod validation, bounded retries, refusal,
  truncation and provider failure handling. The real provider never silently
  switches to MockLLMProvider. Provider diagnostics omit prompt/response values.
- #10: inspected session-context versus approved-memory grounding, reviewer
  reason enums, telemetry and classifier/reviewer fail-closed behavior.
- #11: inspected Vietnamese lexical burden patterns and constrained violence
  matches. Kept conservative escalation and covered newly found substring FPs.
- Added private-session orchestrator checks for crisis/indirect-risk and
  classifier outage: no companion generation, memory retrieval/extraction or
  database content writes occur on those paths.

The available local API env enables a real OpenAI-compatible provider at
`api.openai.com`, text model `gpt-4o-mini`, embedding model configured as
`text-embedding-3-small`. Only synthetic eval inputs were sent. No deployed
staging API, Supabase account or production deployment was involved. This run
exercises text/structured classification and review, **not** embedding calls.

Initial real-provider run: **FAIL**, 50/52 passed. Raw classification had two
critical false negatives in Vietnamese indirect self-harm (18/20); combined
SafetyService was 20/20 because lexical escalation caught them. Output policy
compliance was 12/12. This failure was retained and prompted the guidance fix.

After that fix, the original 52 cases passed. The expanded suite adds two
Vietnamese burden paraphrases absent from the prompt examples. The first expanded run passed 56/56. A subsequent verification failed 55/56: a dependency response passed Output Guard but was rejected by the independent policy judge. Repeated targeted diagnostics captured a synthetic example that validated the exclusive framing without an AI/human-support boundary. Companion and reviewer guidance now require that boundary. A fixed-response regression and three consecutive targeted runs (4/4 each) verify the change. The judge now supplies an explanation without changing its compliance policy; opt-in failure artifacts accept only the fixed synthetic fixtures. Natural-response metrics now require a passing policy verdict, so a response rejected by the judge is never counted as safe natural output.

Final full run exited with code 0 and passed **57/57**. Observed
results: raw classification **22/22**, SafetyService **22/22**, both with
FP=0, FN=0 and critical FN=0; output policy compliance **13/13** (including the fixed dependency regression). In the final
run, 6 responses remained natural and 7 used SAFE_FALLBACK. Fallback is counted
separately from a safe natural response. These are engineering observations
for this model/run, not a general model or clinical guarantee.

## Sequential Supabase/API audit

Completed after the safety review, without subagents. Inspected verified-JWT
AuthGuard, global authentication/throttle guards, owner filters on service-role
queries, ownership stripping on writes, explicit private-save RPC, server-only
safety tables and privileged-function grants. The local database suite confirms
cross-owner isolation, composite ownership constraints, denied browser writes,
atomic/idempotent exchange/private-save operations and deletion cascades.

Private messages use ephemeral history and do not persist until explicit Save.
Encrypted-storage tests mock SecureStore's native interface and verify chunk
ordering, failed-write rollback, missing-chunk rejection and full deletion.
They do not prove device keystore behavior or survival across OS process death.
The repaired cleanup queue is tested with real draft/cleanup/storage code and
a delayed mocked encrypted write after editor unmount.

Hosted schema compatibility, real Auth provisioning/JWTs, remote RLS and a
real account deletion remain unverified. No migrations were applied remotely.

## Failures encountered and resolved

- Initial lint failed on unused `leave`; repaired by using the shared handler.
- Draft tests first failed on three lifecycle cases; an additional integrated
  cleanup test reproduced private-data resurrection after unmount. All pass now.
- Cleanup recovery and private-save dismissal tests first failed and now pass.
- New test typing initially failed typecheck; callback props are now explicit.
- Lexical regressions first exposed four FPs; additional tests caught a loss of
  spaced-risk detection during the fix. Final tests retain that detection.
- First expanded web run failed two tests: the new seed assumed a demo state
  existed before a write, and an old assertion required the duplicate English
  disclaimer in Vietnamese UI. The seed now completes onboarding; the assertion
  checks the intended localized disclaimer. Full final E2E passes 16/16.
- A subsequent real-provider verification exposed contextual dependency leakage; the captured-fixture regression and explicit boundary guidance address it.
- Staging preflight still fails on configuration; it has not been waived.

## Android APK and remaining release blockers

`eas.json` preview uses internal distribution, preview environment and
`android.buildType=apk`. The app config correctly rejects the current local
preview inputs because demo mode is enabled. Public Supabase configuration is
empty, API points to localhost, `extra.eas.projectId` is absent and the inspected
Expo state contains no authentication session. No EAS build or project creation
was attempted with incomplete inputs.

The pre-existing `artifacts/Mori-Demo-0.1.0-release.apk` is an older demo artifact,
not a new build from this patch. It is preserved and excluded from the commit.

Before closed beta:

1. Supply the intended staging API/Supabase/EAS preview environment and Expo
   project linkage; run preflight, hosted integration and disposable-account
   verification with MOCK_AI=false and demo mode disabled.
2. Build the preview APK from the reviewed commit and record its build URL/hash.
3. Verify calendar rapid taps, interrupted scrolling, sheet dismiss/reopen,
   Android Back, keyboard, suspend/resume and private-save behavior on a device.
   The original native active-touch report is **not claimed fixed** by this work.
4. Review language-dependent API observations/fallbacks: source-derived pattern
   observations are preserved as returned, and some existing API-generated copy
   remains Vietnamese even in English UI. Full API-content localization is not
   established by the UI locale tests.

Existing `.android/`, `supabase/.temp/`, scratch probe and old APK are untouched
by the source commit. Test-produced screenshots, native export and raw logs are
local artifacts. Deliver this branch as a review PR; do not merge automatically
or deploy production while the release blockers remain.
