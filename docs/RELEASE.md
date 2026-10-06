# Release status and remaining work

## Implemented

Expo/Nest/shared monorepo, migrations and seed, Supabase JWT guard, RLS with server-only writes, scoped repositories, consent-gated vector retrieval, safety-before-intent routing, independent output review, deterministic crisis response, local drafts, reversible preferences, native reminder scheduling, critical tests and browser E2E.

No raw message/journal content is logged or sent to analytics. No analytics provider is configured. No streak penalties, diagnostic scores, emotional guilt notifications, romantic/exclusive companion claims or user-content upload feature.

## Requires configured services/device verification

- TODO: Run Auth/signup, each API endpoint and deletion against an actual Supabase project; PGlite tests cover SQL and RLS, not GoTrue/PostgREST/Storage integration.
- The deterministic engineering suite covers bilingual safety, indirect crisis language, adversarial prompt injection, grounded-memory plumbing, advice permission and output-review failures through `npm run eval:safety`.
- TODO: Supply the production-compatible model and rerun provider-backed evaluation on staging. The offline lexical/mock suite is a regression defense, not a production classifier or clinical validation.
- TODO: Native device checks on iOS/Android: notification permissions, scheduling/timezone changes, keyboard/screen-reader focus, secure storage failures, reduced motion, large text and background activity timer behavior. JS bundles are not native APK/IPA builds.
- TODO: Clinical/editorial review of crisis language and curated self-care library; populate and operationally re-verify the region-based emergency resource directory. The schema and verified-only retrieval path are implemented, but no unverified hotline numbers are seeded or hardcoded.
- TODO: Publish privacy policy, AI subprocessors, retention, backup expiry, age suitability and support process before real users.
- TODO: Resolve dependency advisories in compatible upstream versions. Audit currently reports 13 moderate transitive findings, originating in `uuid` via Expo/Xcode tooling and `decode-uri-component` via Expo Router/query-string. No high/critical findings. Do not force-downgrade Expo to the old version suggested by npm audit.

## Explicitly deferred product scope

- Voice button is labeled unavailable; no recording/realtime voice in MVP.
- Data export is a documented architecture placeholder: authenticated request → background job → private Supabase Storage object under user UUID → short-lived signed download URL → automatic expiry and audit event without content. No export endpoint claims to work yet.
- Cursor pagination beyond initial list windows, server push notifications and richer semantic recent-memory expiry are next iterations. Local reminders and bounded recent conversation context work now.
- No social network, therapist marketplace, payments, wearables, 3D garden or video avatar.

## Operational notes

Server and client demo flags are independent. A production server refuses `MOCK_AI=true`. Use TLS and secrets management for live deployment. Expo public variables must never contain server/AI keys. The app currently schedules reminders on the device, not through push tokens; nothing is sent to another person.

Native drafts use versioned SecureStore chunks with a manifest committed last; web drafts use local browser storage. A sudden process kill before a write completes retains the previous committed value. Work on user-specific draft storage is isolated by Supabase user ID. Sign out/delete clears registered local drafts and reminders.
