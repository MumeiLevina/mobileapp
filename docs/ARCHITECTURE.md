# Mori

Mori is a Vietnamese-first emotional companion, not a clinician. Product loop: feel → talk → understand → reflect → small action → return to life.

## Boundaries

- `apps/mobile`: Expo Router, React Native, centralized StyleSheet utilities/tokens, Reanimated, Zustand drafts/preferences, TanStack Query server state. Four tabs; onboarding and editors outside the tab stack.
- `apps/api`: NestJS modular monolith. Controllers validate and delegate. JWT verified by Supabase; every repository operation scoped to authenticated user. AI exists only on server.
- `packages/shared`: Zod contracts, domain types, curated activity library, deterministic garden rules.
- `supabase/migrations`: PostgreSQL + pgvector, RLS, ownership constraints, indexes, atomic garden awards.

## Data modes

`EXPO_PUBLIC_DEMO_MODE=true` is an explicitly labeled, local demo. It uses synthetic samples and deterministic replies. Never enter sensitive real information into demo storage. Production uses Supabase Auth and the Nest API; no fallback to demo when real API fails. `MOCK_AI=true` independently selects the backend mock provider.

JWTs are stored in SecureStore on native. Web sessions use browser storage. Native journal drafts use SecureStore; web drafts use local browser storage with privacy disclosure. Drafts are namespaced per user, cleared on account deletion/sign out. No private text in logs or analytics.

## AI

Normalize → lexical safety → independent model safety classification → intent/emotion → approved vector memories (max 4) → compose separated identity/style/policy/memory/current input → provider → independent output validation → persist. Crisis/elevated risk bypass companion generation. A failed or invalid safety classification enters an internal `unavailable` state, persists the classifier status, returns conservative localized copy and never calls the normal companion. Output review also fails closed to a safe fallback. Candidates remain unapproved and excluded from retrieval. Recent context uses a bounded conversation window, no automatic long-term extraction.

Provider interface supports text, structured output and embeddings. An OpenAI-compatible HTTP adapter is transport-only, configured with server environment variables; other vendors can implement the same contract. Text, structured classification and embedding calls have independent timeouts. Transport failures are normalized into typed timeout, rate-limit, unavailable and invalid-response errors; the API error boundary returns only its generic user-safe message. Structured output accepts a bare JSON object or one JSON markdown fence and retries at most once after a format/schema failure. Provider logs contain only provider, operation, status, latency and error category. Mock mode is deterministic and is not a clinical safety classifier.

Crisis responses come from a deterministic service rather than the companion model. The service reads only enabled, verified resources from `crisis_resources`. The current product has no manually selected country, so it returns only globally applicable resources and never infers location from IP. An empty or unavailable directory falls back to generic local emergency-service guidance. No hotline is seeded without a verification source and timestamp.

## Privacy controls

## Personal World (Wave 3)

`soft_goals`, `garden_unlocks`, `personal_milestones` and `letters` are private owner-scoped tables with RLS, server-only writes and account-deletion cascades. Soft Goals use only active, completed and archived states. Completion awards the existing Garden growth key once and unlocks Path Stones once; creation and archive do not create growth.

Garden 2.0 extends the existing growth state instead of replacing it. `unlock_garden_area` persists one row per owner/feature, while `record_personal_milestone` persists one gentle milestone per owner/key. Both RPCs are idempotent. Unlocks never remove growth or react to low mood, inactivity, missed rituals, deleted sources or crisis use. Quiet Cottage records only a one-time feature activation; Quiet Room usage history remains unrecorded.

Letters and Soft Goals are deliberately absent from Ask Mori retrieval, Life Patterns and automatic Memory creation. Private Conversation still passes through Safety, CrisisResponse and OutputGuard while keeping messages in memory only; leaving discards them, and Save explicitly creates one normal conversation. It creates no timeline, memory, goal, Garden unlock or milestone.

The Garden scene remains 2D and uses accessible hotspots. Reduced-motion settings disable decorative motion. Home stays calm and uses the Garden as the visual gateway; Milestones and Soft Goals live under the You area.

## Daily Experience (Wave 2)

Guided Journal prompts are a versioned shared curated dataset; incomplete answers remain in the existing private draft store and only the reviewed result becomes a normal journal. Ritual intentions use owner-scoped `ritual_entries`; desired feelings are not reused as current mood and ritual text is not silently added to Ask Mori context.

Mori Moments and Home routing are deterministic UI rules. Local time alone selects the optional morning or evening card. Quiet Room, grounding, break and human-connection flows do not call the AI provider or persist usage. First Aid danger calls `GET /first-aid/crisis`, whose controller depends directly on `CrisisResponseService`; it never enters `AIOrchestratorService`, memory retrieval or candidate creation.

Local ritual reminders have independent morning/evening switches, retain the device timezone and default off. No push-token infrastructure exists.

The in-app privacy center gives the user one place to export data, manage memories, delete all journals or conversations, and delete the account. Every destructive action has a separate confirmation with a clear keep-data path. Account deletion first removes the verified Supabase Auth user so database cascades delete owned server records, then clears local drafts, reminders, auth state and query caches. The client never reports success when the server deletion fails.

The export service synchronously collects every retained owner-scoped row in 500-row pages with explicit field projections. It returns one versioned JSON package and excludes internal safety metadata, vector embeddings and ownership identifiers. A server-only audit table stores request status, timestamps and aggregate record counts without exported content. Web downloads the package as a JSON file; native passes the JSON payload to the system share sheet. Large-account support should replace this synchronous response with a background job and a private, short-lived download object.

## Observability

A global API interceptor assigns or validates a UUID request ID, returns it as `X-Request-ID`, and records only the route template, response status and duration. Provider logs contain operation, status, latency and normalized error category. Safety events record level/classifier status/escalation counts, and output-guard rejection events record only lexical, reviewer or unavailable reason. Error logs include request ID and status. These paths never log authorization headers, tokens or raw conversation, journal or memory content.

## Delivery validation

Run typecheck, ESLint, critical Jest tests and Expo web export. Native device validation and live Supabase/LLM checks require configured services and device builds. Production release additionally requires bilingual adversarial safety evaluation, clinical review of curated copy, backup/deletion policy, and operational monitoring without sensitive content.
