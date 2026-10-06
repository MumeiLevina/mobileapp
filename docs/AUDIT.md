# Repository audit

Audit date: 2026-10-06. This document records the baseline before beta hardening. It does not claim real-service or device validation.

## Current architecture

- Expo Router mobile app owns UI, Supabase Auth sessions and local drafts. In connected mode it calls only the NestJS API for application data.
- NestJS is a modular monolith. A global AuthGuard verifies bearer tokens with Supabase Auth and attaches the verified subject as `userId`.
- DatabaseService uses the service-role client and scopes reads/writes by verified `user_id`. Controllers validate bodies with shared Zod contracts.
- PostgreSQL stores private data. Auth-user deletion cascades through `public.users`. RLS permits authenticated clients to read only their own rows; writes stay server-only.
- AI runs server-side behind `LLMProvider`. Safety classification precedes intent, memory and companion generation.

## Phase A findings

Implemented in this phase:

- Repository writes now discard a supplied `user_id` before applying the verified owner ID. Updates cannot move records between owners.
- The mobile API client refreshes sessions expiring within 30 seconds and retries one request after a 401 with a forced refresh.
- A new additive migration makes the signup trigger idempotent, repairs missing profile/garden/notification rows, recreates explicit owner-read policies and revokes browser writes/RPC execution.
- PGlite verifies isolation for profiles, journals, memories, conversations and moods.
- Optional real-Supabase integration coverage verifies login, refresh, logout, provisioning, cross-user isolation and account-deletion cascade.

## Validation levels

- **Tested locally:** TypeScript, lint, unit tests, PGlite PostgreSQL/RLS tests, API build, Expo export and demo E2E.
- **Available when staging secrets are supplied:** real Supabase Auth/RLS integration via `npm run test:supabase`.
- **Not yet validated:** a real hosted/local Supabase instance in this environment, real LLM provider, installable device builds and notification behavior on hardware.

## Deferred to later phases

Provider-specific errors/timeouts, safety fail-closed hardening, crisis resource directory, output guard expansion, safety evals, privacy export, cursor pagination, EAS configuration and native-device QA remain intentionally outside Phase A.
