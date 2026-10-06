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

Normalize → independent safety classification → intent/emotion → approved vector memories (max 4) → compose separated identity/style/policy/memory/current input → provider → independent output validation → persist. Crisis/elevated risk bypass companion generation. Unavailable safety classification fails closed. Candidates remain unapproved and excluded from retrieval. Recent context uses a bounded conversation window, no automatic long-term extraction.

Provider interface supports text, structured output and embeddings. An OpenAI-compatible HTTP adapter is transport-only, configured with server environment variables; other vendors can implement the same contract. Mock mode is deterministic and is not a clinical safety classifier.

## Delivery validation

Run typecheck, ESLint, critical Jest tests and Expo web export. Native device validation and live Supabase/LLM checks require configured services and device builds. Production release additionally requires bilingual adversarial safety evaluation, clinical review of curated copy, backup/deletion policy, and operational monitoring without sensitive content.
