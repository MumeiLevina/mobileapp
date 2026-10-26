# Mori Wave 4 Sprint 3 stability handoff

Date: 2026-10-26, Asia/Saigon. Worktree: `C:\mw4-sprint3-qa`.
Branch: `feature/wave4-sprint3-stability`; PR target:
`integration/android-closed-beta`.

Continued the existing Sprint 2/Sprint 3 audit conclusions. The dedicated branch
was clean at `b93f945` and was fast-forwarded to the verified
[PR #15](https://github.com/MumeiLevina/mobileapp/pull/15) head
`47b81174b50e21a412bdaa0cc46a19c7c17cbade`. PR #15 remains a separate Draft,
unmerged dependency. Its two commits are ancestors of this branch. The dirty
`C:\mw4-sprint3` native-readiness worktree and the original staging worktree
were preserved. No reset, stash, worktree removal or integration merge occurred.

## Changes and boundaries

- Self-care and Quiet Room share a monotonic foreground timer. Delayed callbacks
  no longer lose time; fractional seconds survive pause/resume, the duration is
  clamped, background/inactive events pause, and foreground return requires an
  explicit Continue. A start acknowledgement after an intervening background
  event stays paused. Unmount removes the interval and AppState subscription.
  Completion still requires an explicit button; local practice never sends
  completion, sync or Garden writes. Untimed Quiet Room creates no interval.
- Private Conversation route removal opens the existing explicit Save/Discard
  sheet when there is text, a transcript or a pending request. Save pending blocks
  sheet dismissal. An immediate lock prevents overlapping Send/Save taps, and a
  discarded session ignores late responses. Content remains ephemeral; no draft
  storage or background replay was introduced.
- `useOwnerRequest` captures the mounted owner's identity, forwards it to the
  existing token/401-refresh transport guard, and rejects results after unmount,
  account switch or even switch-away-and-back. Conversation and Private
  Conversation remount by owner, and Conversation query keys include the owner.
  Root navigation also remounts on identity change. Existing chat UUID/draft
  persistence and safety routing remain intact.
- Audited and bound the other private API writers: conversation creation,
  messages, memory decisions, reflection drafts/deletion, journals, guided
  journals, letters/opening, moods, rituals, profile/onboarding, notification
  settings, Life Map, Soft Goals, milestones, weekly reflection, Ask Mori and
  privacy export/deletion. Memory list actions retain their explicit owner
  option. Profile optimistic rollback is guarded against stale owners.
- Account deletion binds the remote request to the captured owner. Late deletion
  and sign-out callbacks cannot clear a different local session. Old-owner draft
  cleanup remains ordered. Native reminder scheduling/cancellation share a queue
  and owner checks, so delayed permission/scheduling results cannot replace a
  later owner's schedule. Auth identity changes enqueue reminder cleanup; token
  refresh for the same owner does not.
- Manual Memory creation requires a client UUID. One service-role-only SQL
  transaction creates approved Memory, provenance, Garden area and milestone.
  Advisory transaction locking plus owner/UUID uniqueness serializes overlapping
  retries. A SHA-256 fingerprint rejects changed retry payloads while preserving
  later edits. Source/Garden/milestone failures roll back the complete creation.
  A server-only tombstone prevents delayed retries from recreating forgotten
  content; account deletion cascades through it. No raw payload is stored in this
  retry table. Existing candidate approval, retrieval consent and RLS are retained.
- Memory Editor retains the same UUID and frozen attempted fields after an
  ambiguous response. Only another explicit Save retries it. The former fuzzy
  list-match reconciliation is removed. The editor still does not persist a
  Memory draft. Demo implements the same creation/retry/deletion behavior in its
  separate synthetic store; its payload snapshot is cleared on Memory deletion.
- Reused the pending native worktree's isolated `demo-qa` configuration without
  changing that worktree. It requires explicit Demo mode and empty Connected
  configuration; name/package/scheme differ from the Connected app.

The code review confirms that RN Modal forwards Android `onRequestClose` to the
same close handler, dirty Memory dismissal remains guarded, chat/private retain
keyboard avoidance and handled keyboard taps, and shared controls delegate touch
handling to RN Pressability. No speculative responder/framework workaround was
added. These observations do not certify physical touch, IME or TalkBack behavior.

## Memory migration and review requirements

`202610260001_memory_creation_idempotency.sql` is additive and has only been
executed against the local synthetic PGlite database. Review its function grants,
RLS, fingerprint retention and transaction behavior before any hosted action.
Apply migration before deploying the corresponding API/client in a separately
authorized rollout. Older clients without `client_id` cannot create manual
Memories against this API; coordinate client/API compatibility before release.

No hosted migration, Render deployment, real OpenAI call, credential request,
cloud build, PR merge or production release was performed. Offline writes still
fail visibly and require manual retry. No automatic queue, Connected-to-Demo
fallback, additional AI consent or new retrieval path was introduced.

## Unresolved issues and Android Demo APK readiness

**Source/config ready for a separate Demo QA build; current-commit APK and native
runtime sign-off are NOT VERIFIED.** Web and Hermes exports are not an APK. The
old staging APK and any other worktree's APK/runtime results do not certify this
branch. No APK was built or published in this continuation.

Use `demo-qa`, package `app.mori.companion.demoqa`, scheme `mori-demo-qa`, explicit
`EXPO_PUBLIC_DEMO_MODE=true`, empty public service URLs/anon key, and
`EXPO_NO_DOTENV=1`. Use a fresh build worktree at the reviewed commit, leaving the
existing native experiments intact. The internal APK profile is configured in
`apps/mobile/eas.json`; local prerequisites and existing constraints are in
[the Android build handoff](ANDROID_BETA_BUILD.md) and [native QA](NATIVE_QA.md).
Review signing, version, permissions and the final APK SHA-256. Cloud execution
and production distribution remain outside this task.

Remaining manual QA, using synthetic text and recording commit/APK SHA/device/API:

1. Build/install the separate Demo APK; cold-start without Metro and without
   network. Verify the package/banner, simulated AI, no Connected service traffic
   and absence of microphone/camera/contacts/location permissions.
2. Self-care and Quiet Room: Home, lock, inactive/background, long suspension,
   return paused, explicit resume, manual pause, end boundary and unmount. Repeat
   while start/completion is pending. Returning alone must not submit completion.
   Android notification-drawer `blur` is not an AppState change and is not claimed
   to pause this timer. Process death starts a new practice; no timer is persisted.
3. Private unsent text/transcript: hardware Back and edge gesture, Continue,
   explicit Discard, pending Send/Save and repeated sheet transitions. Test root
   Activity exit and process death separately from navigation callbacks. Verify
   discarded/private content never becomes a durable draft.
4. Vietnamese IME/diacritics, emoji, long multiline input and keyboard Back in
   chat, journal, guided journal, Memory and Letter. Confirm actions remain
   reachable with keyboard shown and 200% system font. Check dirty Memory
   Back/backdrop, slow saves and approval failures.
5. Physical rapid/cancelled touches, scrolling, 20 repeated modal transitions,
   TalkBack names/focus/busy states, light/dark and reduced motion. The old
   active-touch issue remains open until reproduced and verified in the exact
   binary. The separate native-readiness worktree's Garden/layout changes are not
   silently included in this branch.
6. Minimum API 24, a current stable Android API and a physical phone; an emulator
   or browser result cannot replace these. iOS native QA remains separate.
7. Controlled account-switch tests during token refresh, request acknowledgement,
   secure draft writes, notifications, export, sign-out and deletion. An already
   issued native share sheet or Auth SDK sign-out cannot be recalled by the JS
   guard; do not infer those external effects are cancelled mid-operation.
8. Separately authorized hosted migration/Auth/RLS/API verification and real
   provider safety evaluation. PGlite is a single embedded connection: it verifies
   SQL semantics and sequential retries, not a real multi-connection concurrency
   load. Memory retry identity is in-editor only and is lost on process death or
   explicit dismissal; no cross-device/process reconciliation is claimed.

Keep both PRs Draft/unmerged until review dependencies, contract rollout and the
applicable native/hosted gates are resolved.

## Executed verification

Windows, Node `v24.21.0`, npm `11.19.0`. Dependencies were already installed with
`npm ci` in the dedicated worktree. No dependency/lockfile upgrade was needed.
The following sequence ran successfully on the final implementation:

| Order | Command | Result |
| --- | --- | --- |
| 1 | `npm run typecheck` | PASS, API/mobile/shared |
| 2 | `npm run lint` | PASS |
| 3 | `npm test` | PASS, 264 tests; 85 intentionally skipped |
| 4 | `npm run test` | PASS, 264 tests; 85 intentionally skipped |
| 5 | `npm run eval` | PASS, 79 deterministic offline safety cases |
| 6 | `npm run test` | PASS, 264 tests; 85 intentionally skipped |
| 7 | `npm run export` | PASS, web plus Android/iOS Hermes bundles |
| 8 | `npm run test` | PASS, 264 tests; 85 intentionally skipped |
| Additional | `npm run test:mobile` | PASS, 129 tests / 34 suites |
| Additional | `npm run test:database` | PASS, 23 local SQL/RLS checks, including four new Memory contract groups |
| Additional | `npm run build:api` | PASS |
| Additional | `npm run test:e2e` | PASS, 21 Chromium journeys after a fresh web export |
| Additional | `git diff --check` | PASS |

Root tests had 25 passing suites and two skipped suites. Hosted Supabase/provider
tests were deliberately disabled with `RUN_SUPABASE_INTEGRATION_TESTS=false` and
`RUN_PROVIDER_SAFETY_EVALS=false`. Demo exports used `EAS_BUILD_PROFILE=demo-qa`,
explicit Demo mode, empty Connected service configuration, `EXPO_NO_DOTENV=1`
and telemetry disabled. No `.env` or credentials were copied into the worktree.

Regression evidence includes delayed/fractional timers, pending start across
background/foreground, Quiet Room explicit resume/no timer, Private Back/pending
Save, late chat/private results across account changes, switch-away-and-back,
unmount, stale sign-out/deletion, late notification permission, frozen Memory
retry identity and Demo retry/deletion behavior. API tests verify UUID validation,
authenticated ownership and embedding failure. SQL tests exercise owner-scoped
retries, changed payload rejection, preserved edits, provenance/Garden/milestone
rollback, service-only grants, RLS, forgotten-memory tombstones and account cascade.

Raw logs and command exit records are preserved at
`C:\mw4-sprint3-qa-evidence\verification.json` and adjacent numbered logs. Synthetic
browser screenshots are there too; tracked screenshots were restored from the
pre-test backup and no APK/cache/log/private data was added to the commit. An
early mobile run caught outdated owner-argument expectations and an unsupported
temporary crypto import; both were corrected without a new dependency. A later
new Demo test omitted the required GET argument; typecheck caught and corrected
the fixture before the final full sequence. The browser test itself exited zero;
the evidence wrapper hit Windows console encoding while printing its log, after
which artifact preservation/restoration was completed explicitly.

These are local results. The new PR must obtain its own exact-head CI result;
PR #15 or integration's existing green checks do not certify this branch.
