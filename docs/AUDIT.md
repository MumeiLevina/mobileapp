# Repository audit

Audit updated: 2026-10-07. This document records beta-hardening status without claiming real-service or device validation.

## Current architecture

- Expo Router mobile app owns UI, Supabase Auth sessions and local drafts. In connected mode it calls only the NestJS API for application data.
- NestJS is a modular monolith. A global AuthGuard verifies bearer tokens with Supabase Auth and attaches the verified subject as `userId`.
- DatabaseService uses the service-role client and scopes reads/writes by verified `user_id`. Controllers validate bodies with shared Zod contracts.
- PostgreSQL stores private data. Auth-user deletion cascades through `public.users`. RLS permits authenticated clients to read only their own rows; writes stay server-only.
- AI runs server-side behind `LLMProvider`. Safety classification precedes intent, memory and companion generation.

## Delivery phase status

- **Phase A — Auth / RLS hardening: DONE.** Verified-owner repository behavior, explicit RLS, session refresh and additive migration are implemented and covered locally.
- **Phase B — Real LLM provider: DONE.** The OpenAI-compatible provider, typed failures, independent timeouts and structured-response validation are implemented and covered with controlled HTTP tests.
- **Phase C — Safety hardening: DONE.** Safety-before-intent, fail-closed classification, deterministic crisis flow, verified-resource retrieval and independent output review are implemented.
- **Phase D — Safety eval: DONE.** The deterministic bilingual engineering suite runs locally and in default CI. It is not clinical validation.
- **Phase E — Privacy / data export: DONE.** The privacy center, filtered JSON export, content-free audit metadata and verified account deletion are implemented.
- **Phase F — Real service verification: IN PROGRESS.** Staging-only Supabase, API, LLM, embedding and provider-safety harnesses exist. They have not run in this workspace because no staging credentials are present.
- **Phase G — Native beta: IN PROGRESS.** EAS development/preview/production profiles, build-time environment guards, native metadata/assets and the device QA checklist are configured. No EAS cloud artifact or physical-device pass has been completed in this workspace.
- **Phase H — Release preparation: IN PROGRESS.** Internal privacy, retention, AI disclosure, safety, crisis-resource and deployment documents plus content-free request/safety metrics are implemented. Public policy URLs, provider-specific terms, operational retention, staging evidence and store review remain external release gates.

## Auth and ownership findings

- Repository writes now discard a supplied `user_id` before applying the verified owner ID. Updates cannot move records between owners.
- The mobile API client refreshes sessions expiring within 30 seconds and retries one request after a 401 with a forced refresh.
- A new additive migration makes the signup trigger idempotent, repairs missing profile/garden/notification rows, recreates explicit owner-read policies and revokes browser writes/RPC execution.
- PGlite verifies isolation for profiles, journals, memories, conversations and moods.
- Optional real-Supabase integration coverage verifies email/password signup, login, refresh, logout, provisioning, a real JWT through AuthGuard, cross-user isolation across every user-owned table, server-only export audits and account-deletion cascade.

## Validation levels

- **Tested locally:** TypeScript, lint, unit tests, PGlite PostgreSQL/RLS tests, API build, Expo export and demo E2E.
- **Available when staging secrets are supplied:** real Supabase Auth/RLS integration via `npm run test:supabase`, synthetic service health checks via `npm run verify:staging`, and provider-backed engineering evaluation via `npm run eval:safety:staging`.
- **Not yet validated:** a real hosted/local Supabase instance in this environment, real LLM provider, installable device builds and notification behavior on hardware.

## Current audit boundary

The repository contains no staging credentials and this audit makes no claim that hosted Supabase, a production model, EAS cloud builds or physical devices passed. The service verification commands refuse a production target and use only synthetic test content. Apply migrations in filename order (`202610010001` through `202610060003`) before running them.
