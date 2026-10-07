# Release status and remaining work

## Implemented

Wave 3 Personal World is implemented: Future Letters and explicit-save Private Conversation remain intact; Soft Goals, the Garden 2.0 sanctuary/unlock model, accessible Garden hotspots, gentle Personal Milestones and export schema v6 are connected. All new persisted rows are owner-scoped and cascade on account deletion. Letters and Soft Goals are excluded from automatic AI context, and Private Conversation creates no Garden progress.

Wave 2 Daily Experience is implemented: Guided Journals, Morning/Evening Rituals, opt-in local ritual reminders, Mori Moments, Quiet Room, First Aid and the calm Home hierarchy. First Aid danger reuses the deterministic verified-resource crisis service and bypasses normal companion generation. Quiet Room and ordinary First Aid choices do not persist usage or create AI context.

Expo/Nest/shared monorepo, migrations and seed, Supabase JWT guard, RLS with server-only writes, scoped repositories, consent-gated vector retrieval, safety-before-intent routing, independent output review, deterministic crisis response, local drafts, reversible preferences, native reminder scheduling, privacy center, owner-scoped JSON export, verified account deletion, critical tests and browser E2E.

No raw message/journal content is logged or sent to analytics. No analytics provider is configured. No streak penalties, diagnostic scores, emotional guilt notifications, romantic/exclusive companion claims or user-content upload feature.

Internal release inputs now live in `PRIVACY.md`, `DATA_RETENTION.md`, `AI_DISCLOSURE.md`, `SAFETY.md`, `CRISIS_RESOURCES.md` and `DEPLOYMENT.md`. They document current behavior and remaining operator decisions; they are not substitutes for reviewed public policies.

## Requires configured services/device verification

- TODO: Run Auth/signup, each API endpoint and deletion against an actual Supabase project; PGlite tests cover SQL and RLS, not GoTrue/PostgREST/Storage integration.
- The deterministic engineering suite covers bilingual safety, indirect crisis language, adversarial prompt injection, grounded-memory plumbing, advice permission and output-review failures through `npm run eval:safety`.
- TODO: Supply the production-compatible model and rerun provider-backed evaluation on staging. The offline lexical/mock suite is a regression defense, not a production classifier or clinical validation.
- TODO: Native device checks on iOS/Android: notification permissions, scheduling/timezone changes, keyboard/screen-reader focus, secure storage failures, reduced motion, large text and background activity timer behavior. JS bundles are not native APK/IPA builds.
- EAS development, internal preview and store-ready production profiles are configured under `apps/mobile/eas.json`. No APK, AAB or iOS archive has been built or installed yet; complete `docs/NATIVE_QA.md` before closed beta.
- TODO: Clinical/editorial review of crisis language and curated self-care library; populate and operationally re-verify the region-based emergency resource directory. The schema and verified-only retrieval path are implemented, but no unverified hotline numbers are seeded or hardcoded.
- TODO: Adapt the internal specifications into reviewed public policy/support URLs; name the selected AI subprocessors and regions; configure operational log retention, backup expiry, age suitability and the incident/support process before real users.
- TODO: Recheck dependency advisories against compatible Expo/Jest releases before beta distribution. On 2026-10-08, the latest completed `npm audit` reports 64 findings (49 high, 15 moderate) and no critical finding. It flags top-level Expo, React Native, Expo Router, Reanimated, Worklets and Jest graph entries because of affected packages in their dependency chains. Suggested fixes include incompatible framework/test-runner changes and an Expo 44 downgrade, so no forced audit fix was applied. Treat external deep links as untrusted, keep staging isolated, and update through an Expo-compatible release rather than overriding the lockfile blindly.

## Explicitly deferred product scope

- Life Chapters were deferred because they are optional and would expand scope after the stable Wave 3 closeout.
- Voice, Voice Journal, Photo Journal, biometric App Lock and Widgets remain deferred.

- Voice button is labeled unavailable; no recording/realtime voice in MVP.
- Data export currently returns a synchronous JSON package and is intended for MVP-sized accounts. Before supporting large accounts, move generation to a background job with private object storage, short-lived signed downloads and automatic expiry. Native currently shares the JSON payload through the system share sheet; web downloads a `.json` file.
- Cursor pagination beyond initial list windows, server push notifications and richer semantic recent-memory expiry are next iterations. Local reminders and bounded recent conversation context work now.
- No social network, therapist marketplace, payments, wearables, 3D garden or video avatar.

## Operational notes

Server and client demo flags are independent. A production server refuses `MOCK_AI=true`. Use TLS and secrets management for live deployment. Expo public variables must never contain server/AI keys. The app currently schedules reminders on the device, not through push tokens; nothing is sent to another person.

Native drafts use versioned SecureStore chunks with a manifest committed last; web drafts use local browser storage. A sudden process kill before a write completes retains the previous committed value. Work on user-specific draft storage is isolated by Supabase user ID. Sign out/delete clears registered local drafts and reminders.

## Wave 3 validation status

| Level                  | Status                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| IMPLEMENTED            | Soft Goals, Garden 2.0/unlocks, Personal Milestones, Letters/private-chat integration and export/delete changes are in the repository.             |
| TESTED IN DEMO         | Browser E2E covers Soft Goal completion, milestones, Letter Tree, Path Stones, Reflection Lake, private-chat non-progression and schema v6 export. |
| TESTED IN CI           | Required default workflow gates must be green for the exact final commit before closeout is declared.                                              |
| REQUIRES REAL SUPABASE | Auth, hosted RLS/RPC behavior, migrations and deletion/export must still be verified with staging credentials.                                     |
| REQUIRES REAL MODEL    | Provider-backed bilingual safety and response-quality evaluation still needs staging model credentials.                                            |
| REQUIRES NATIVE DEVICE | iOS/Android accessibility, SecureStore, reminders, reduced motion, Dynamic Type and Garden touch targets still need physical-device QA.            |
