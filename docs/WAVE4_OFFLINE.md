# Wave 4 — offline audit and Sprint 1

Date: 2026-10-23 (Asia/Saigon). Base: `integration/android-closed-beta`
at `61f6dfdd96523a514255fa2893b3db425d2564af`. Branch:
`feature/wave4-offline-ux`. Worktree: `C:\mw4`.

## Evidence and boundaries

Fetched `origin` and inspected GitHub metadata for
[PR #12](https://github.com/MumeiLevina/mobileapp/pull/12): merged on
2026-10-22, merge commit `61f6dfd`, head `677f658`, four commits and 44 changed
files. Read README, ARCHITECTURE, RELEASE, BETA_QA_ROUND2 and NATIVE_QA and
reviewed the merged mobile changes and their tests. Existing worktree changes,
old APK, screenshots, scratch test and credentials were preserved in the
original worktree. The Live2D/AI VTuber branch was not changed.

PR #12 already implemented serialized complete draft writes/cleanup,
revision-safe hydration/clear, pending Private Save controls, calendar and
pattern localization, safety calibration, health endpoint and EAS configuration.
Those capabilities are retained and extended; they were not rebuilt. Its
historical PASS results are not treated as results for this branch.

No deployment, staging integration, hosted migration, provider request or
Android build/device test is part of Wave 4. Only synthetic test text is used.
Demo and Connected remain selected by the explicit configuration flag. Connected
errors never invoke `demoRequest`. Backend safety routing, fail-closed behavior,
memory consent, private-session non-persistence and account cleanup boundaries
are unchanged. There is no automatic background submission queue.

## Repository classification

“Implemented and tested” below means versioned local regression coverage exists;
the execution results for this branch are recorded separately below. It never
means hosted/device/clinical validation.

| Area | Implemented and tested locally | Implemented but needs improvement | Missing or incomplete | External verification required |
| --- | --- | --- | --- | --- |
| Home / Garden | Daily hub, ritual-by-local-time routing, deterministic unlocks, no decay, accessible hotspot roles; Home/World/E2E tests | Initial garden loading uses level-1 placeholder; hotspot labels are small and absolute positions need large-text review | Fully evidenced screen-reader/large-text layout review | Hosted garden awards; Android/iOS touch, reduced motion and text scaling |
| Chat | Modes, list/history, manual send/retry, memory approval, crisis UI; idempotency and safety tests | Retry ID was lost on remount; draft status and history loading needed work; AI journal draft could overwrite unfinished writing | Durable outbox/reconciliation beyond the retained current message; pagination | Render/API, hosted exchange transaction, real provider; native keyboard/Back |
| Journal | List/search/calendar, CRUD, explicit save/discard and private drafts; calendar/E2E tests | Existing draft was gated by network fetch; failed fetch could expose a blank form; storage success copy was unconditional | Recovery UI for malformed draft content; conflict resolution after ambiguous save followed by edits | Hosted CRUD/idempotency, secure-storage OS behavior |
| Guided Journal | Curated templates, step/answers/client ID in private draft, review before save; helper tests | Storage failure recovery, save durability and English controls needed work | Malformed/version-mismatched drafts currently use the existing reset parser; needs explicit recovery UX | Hosted journal create; native keyboard/process death |
| Private Conversation | Ephemeral history; explicit idempotent conversion to normal chat; no memory/timeline/growth; pending-save/dismiss tests | Send error had no named retry action; Save ignored unsent composer text | Native route-removal/Back behavior not established by JS tests | Hosted conversion RPC, real safety/provider, Android lifecycle |
| Self-care / Quiet Room / First Aid | Curated activities, timers, reduced-motion paths, non-AI grounding and quiet actions; mobile/root tests | Self-care library still fetches API; initial empty catalog has no distinct empty state | Offline browsing of curated library in Connected Mode | Activity completion/growth; crisis directory; timer/background/audio presentation on device |
| Memories / reflections | Consent-gated approval, edit/delete, provenance, grounded Ask Mori and evidence thresholds; root/mobile/E2E tests | Memory sheet content is only in mounted state; closing it discards edits; API-generated language remains mixed | Draft/discard recovery for memory edits; list pagination | Hosted RLS/retrieval/embeddings; real LLM grounding |
| Settings / Privacy | Theme/locale, opt-in reminders, export/delete confirmations and cleanup tests | Profile read has no manual retry; locale preference and remote profile can diverge after network failure; notice lifecycle needs audit | End-to-end offline preference reconciliation; public policy/operator decisions | Supabase auth/export/delete, native share/notifications, accessibility |
| Safety / release | Deterministic bilingual eval, private safety isolation, output guard, preview validation | Local tests cannot validate current provider response quality | Clinical/editorial review and operational release decisions | Render/Supabase/real LLM/device; tracked as BLOCKED in this wave |

## UX/UI review

Intentionally deferred in RELEASE: voice/voice journal, photo journal, biometric
App Lock, widgets, Life Chapters, server push and list pagination beyond the
initial windows. These are not new Sprint 1 features. Quiet soundscapes are
metadata; this audit does not establish an audio playback implementation.

Reviewed Home/Garden, Chat, Journal, Self-care, Memories and Settings/Privacy,
their shared controls, theme, navigation and translation catalog. Existing
controls already provide press feedback, focus outlines, disabled/busy states,
44+ point touch targets, reduced-motion-aware animation, flexible text and a
640-point maximum content width. Keep Mori's existing calm typography/palette.
Changing its font system or adding animation libraries is not needed for this
sprint.

Sprint 1 adds live draft status, history loading feedback, named retries,
localized Guided Journal controls/progress, and keyboard tap handling in Private
Conversation. Journal read failures cannot show editable blank content. Web
screenshots/checks cover presentation only. Physical keyboard avoidance,
TalkBack/VoiceOver, 200% text, safe-area/inset behavior and the reported active
native touch issue remain unverified. No native-touch fix is claimed.

Captured 32 web viewport screenshots: Home, Talk, Journal, Self-care, Memories,
Settings, Privacy and Journal editor at widths 390 and 1024, in Vietnamese/light
and English/dark. The local browser reported no document horizontal overflow or
uncaught page errors. Inspected representative captures for each core area and
the private end sheet; the unsent-text warning and disabled Save fit on screen.
This does not verify every scrolled section, every theme/locale combination,
screen-reader behavior or device keyboard insets. Existing English catalog gaps
remain visible (for example Home's mood heading, Talk's Ask Mori button and
Journal's free-writing action); include these in Sprint 2 rather than claiming
complete English localization. Vietnamese editor/status text displays correctly
in the inspected web captures.

## Prioritized enhancements and acceptance contracts

### P0 — truthful local draft status and storage recovery (Sprint 1)

- User problem: UI claimed drafts were kept even while a write was pending or
  failed; a failed read could initialize a blank editor over retained data.
- Expected behavior: show restoring/saving/locally saved/error; manual retry;
  failed reads keep the editor unavailable until recovery. Newer revisions win.
  Local draft status explicitly differs from saving to an account.
- Components: `useDraft`, shared `DraftStatus`; Chat, Journal, Guided Journal;
  compatibility loading/error paths in Onboarding, Morning Ritual and Letter.
- Dependencies: existing queued cleanup service and private storage only.
- Acceptance: never show saved before latest write completes; retry latest text;
  read failure does not allow editing a blank recovered draft; logout ordering
  and previous revision/remount protections remain covered.
- Testing: delayed/rejected storage hook tests, existing cleanup/encrypted-chunk
  tests and editor UI regressions. OS keystore/process death requires device QA.

### P0 — safe Journal recovery and Chat-to-Journal handoff (Sprint 1)

- User problem: a locally recoverable journal waited for Render; a failed list
  fetch exposed blank fields; generated reflection could replace another draft.
- Expected behavior: open valid local edits without waiting for the list; otherwise
  show loading/error/retry/not-found. Persist the payload before a save request.
  Existing unfinished writing blocks reflection replacement, including a draft
  created while reflection generation is pending; offer its existing editor.
  A conditional writer captured before generation is invalidated as soon as
  account cleanup is requested, preventing a late response from recreating data.
- Components: Journal editor, Chat reflection action, queued conditional write.
- Dependencies: local storage only for recovery; generating reflection still
  requires the configured backend, with no mock fallback.
- Acceptance: local incomplete title/content survives and remains editable;
  no blank PATCH on read failure; no overwrite without explicit resolution;
  retry uses the same persisted journal client ID; no navigation on failed save.
  Late generation after logout/account cleanup cannot recreate a local draft.
- Testing: unavailable/pending GET UI tests, failed saves, atomic draft write
  regression, browser recovery/handoff checks.

### P1 — durable Chat retry identity and readable transport errors (Sprint 1)

- User problem: closing a screen after a lost response regenerated `client_id`
  and could duplicate an accepted exchange; timeout/parser errors were raw.
- Expected behavior: versioned draft stores content, mode and client ID; commit
  before sending; unchanged retry after remount retains ID. Edited content or
  mode gets a new ID. Legacy plain-text drafts remain intact. Timeout/network/
  malformed-response errors are user-safe and retry is manual. Refresh safety
  response state before attempting local draft cleanup.
- Components: Chat editor/draft parser, API transport, history loading state.
- Dependencies: existing server client-ID contract; no new endpoint/library.
- Acceptance: failed local persistence prevents POST; unchanged retries reuse ID;
  changing text changes ID; no silent POST retry or fallback AI; no unconfirmed
  save claim in network/offline copy.
- Testing: screen remount/lost-response and storage-failure tests, legacy parser,
  mocked connected transport failures, existing backend idempotency tests.

### P1 — preserve unsent private text during explicit Save (Sprint 1)

- User problem: Save persisted the transcript but silently omitted composer text.
- Expected behavior: explain unsent text, disable Save until sent/cleared, and
  let the user resume. Discard remains explicit. Send failure retains text and
  exposes retry. No private draft is written to device storage.
- Components: Private Conversation composer and end sheet.
- Dependencies: existing ephemeral send and explicit-save contracts.
- Acceptance: failed send keeps input; retry shows one successful pair; unsent
  text cannot be silently dropped by Save; pending-save dismissal guard remains.
- Testing: private screen regressions; hosted RPC and hardware Back are separate.

### P1 — broaden recovery without creating screens (proposed Sprint 2)

- User problem: malformed Guided/Letter drafts reset silently; memory-sheet edits
  disappear on close; ambiguous saved responses followed by edits need resolution.
- Expected behavior: preserve original payload, offer retry/export/discard only
  with explicit user choice; resume edits in existing surfaces; separate remote
  commit success from local cleanup failure so the next action is clear.
- Components: guided/letter parsers, Memories sheet, journal/save completion UI.
- Dependencies: local recovery design; real reconciliation needs hosted contract
  evidence once service verification is permitted.
- Acceptance: no silent replacement, no automatic private persistence, no claim
  of remote success without acknowledgement; device/user cleanup still removes
  all registered draft data.
- Testing: malformed/versioned payloads, interrupted cleanup, dismissal/remount,
  owner-switch tests and subsequent hosted lost-response checks.

### P2 — connect offline self-care and finish presentation review (proposed Sprint 2)

- User problem: Connected users cannot browse a curated activity list during an
  outage, although Quiet Room/grounding are local; large text can crowd Garden.
- Expected behavior: use the existing curated library with an explicit distinction
  between local activity use and unconfirmed server completion; keep Garden and
  memory links within current navigation. Add profile-read retry and review all
  core screens in light/dark, Vietnamese/English and large text.
- Components: Self-care library/activity, Home/Garden, Settings, shared layout.
- Dependencies: curated shared data; device for keyboard/focus/touch verification.
- Acceptance: no fake completion/growth, no mock AI, all existing consent/defaults
  retained; readable labels at supported sizes and usable keyboard navigation.
- Testing: offline Connected fixtures, small/wide web layouts and bilingual dark
  mode; physical Android keyboard, TalkBack and rapid-touch QA when available.

## Verification results

All commands below were actually executed in the isolated worktree after the
last implementation change. `RUN_PROVIDER_SAFETY_EVALS=false`,
`RUN_SUPABASE_INTEGRATION_TESTS=false` and `EXPO_PUBLIC_DEMO_MODE=true` were set
for this offline verification chain. Connected transport tests explicitly mock
Connected Mode and failing network responses; they do not contact a hosted API.

| Gate | Result | Evidence / limit |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | PASS | Lockfile installation; no dependency change |
| `npm run typecheck` | PASS | All three workspaces |
| `npm run lint` | PASS | No errors |
| `npm test` | PASS for executed tests | 252 passed, 85 skipped; 24 passed suites, two skipped suites |
| `npm run test` (second run) | PASS for executed tests | 252 passed, 85 skipped |
| `npm run test` (third run) | PASS for executed tests | 252 passed, 85 skipped |
| `npm run eval` | PASS | 79/79 deterministic offline safety cases; FP=0, FN=0, critical FN=0 |
| `npm run export` (first run) | PASS | Web plus Android/iOS Hermes export; no native binary/device claim |
| `npm run export` (second run) | PASS | Repeated complete export succeeded |
| `npm run test` (fourth run, after exports) | PASS for executed tests | 252 passed, 85 skipped |
| `npm run test:mobile` | PASS | 77/77 tests, 27/27 suites; 17 additional tests over the inherited 60 |
| `npm run test:database` | PASS | 19 local PGlite SQL/RLS/idempotency/cascade checks |
| `npm run test:e2e` | PASS | Web re-export and 18/18 Chromium tests, including two new journeys |
| Web presentation smoke | PASS within stated scope | 32 viewport captures; no document horizontal overflow or page errors; private sheet in viewport |
| Render staging/API integration | BLOCKED / NOT RUN | Explicitly excluded while staging is unavailable; no staging preflight/network probe/deployment attempted |
| Hosted Supabase Auth/RLS/CRUD/export/delete | BLOCKED / NOT RUN | Hosted validation excluded in this phase; 28 root tests skipped |
| Real LLM/classifier/output-review/provider evaluation | BLOCKED / NOT RUN | Real-provider validation excluded; 57 root tests skipped; no provider requests |
| Physical Android/iOS, native touch, keyboard, OS secure storage, notifications | BLOCKED / NOT RUN | Requires device/build QA; JavaScript export, Jest and browser results cannot establish these |
| GitHub CI for the new commit | NOT RUN locally | Local results above do not claim a remote CI pass |
| Merge / production or staging deployment | NOT RUN | No automatic merge or deployment |

The repeated root/export commands intentionally follow the requested sequence.
Root, mobile, database and eval counts overlap in purpose; do not add them into
a single independent coverage total. The original worktree's untracked scratch
test was not copied into this worktree.

Failures encountered and resolved:

- An initial lint run caught an unused `Loading` import after replacing draft
  hydration UI; removed it and reran lint successfully.
- Initial new-test typecheck exposed a nullable Supabase type in the mocked
  transport test; corrected the type. A Guided Journal UI test exposed missing
  English control copy; added its catalog entries and localized progress labels.
- A focused regression **failed before the privacy fix**: a late generated
  reflection recreated `journal.new` after `clearUserDeviceData` completed.
  Cleanup now synchronously invalidates previously captured conditional writers;
  the same regression passes and the final full verification chain passes.
- An early sheet screenshot was taken during its slide transition. The separate
  reduced-motion presentation check asserts that its warning is in the viewport
  before capture; no native animation/touch conclusion is drawn from it.

Raw command logs and exit-code records are local at `C:\mw4-logs\final-*.log`
and `final-results.jsonl`; the reproduction logs and visual smoke script/results
are beside them. Synthetic screenshots, exported bundles, node_modules, logs,
credentials and user data are excluded from the source commit.

## Remaining limits / Sprint boundary

Local draft durability means a completed write: abrupt termination before it
finishes can retain only the previous complete value. A device storage failure
requires keeping the screen open and retrying; it cannot promise recovery of
unwritten text. Private Conversation intentionally has no persistent recovery
after leaving or process death. Requests acknowledged by neither side may have
completed remotely; retry identity helps the existing idempotent API reconcile
the same payload but is not a general offline synchronization system.

Stop after delivering Sprint 1, verification and review PR. The two Sprint 2
proposals above are recommendations only and have not been implemented.
