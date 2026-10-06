# Internal privacy specification

This document describes the implemented product and is an internal release input, not a published legal privacy policy. A qualified reviewer must adapt and publish the final policy, support contact, jurisdictional terms and age requirements before inviting real users.

## Data collected and purpose

- Account identifiers and authentication metadata are handled by Supabase Auth to create and secure an account.
- Profile choices such as display name, language, goals and companion style personalize the interface and responses.
- Mood entries, journal entries, conversations and messages provide the features the user explicitly chooses to use.
- Memories are stored only after an explicit save/approval action and provide optional context for later conversations.
- Self-care sessions, weekly reflections and garden state support user-requested activities and progress.
- Notification preferences schedule local reminders. Mori currently has no server push-token pipeline.
- Content-free export audits record status, timestamps and aggregate record counts for operational accountability.

The application does not configure an analytics or advertising provider. It does not collect contacts, precise location, microphone recordings, camera data, health-platform data or payment data.

## Storage and access

Production-mode server data is stored in the configured Supabase PostgreSQL project. RLS restricts authenticated browser/mobile reads to the owner. Application writes use the Nest API with a service-role client and every repository operation is scoped by the user ID from a verified JWT. Service-role and AI keys never belong in a mobile build.

Native auth sessions and drafts use operating-system SecureStore-backed storage where implemented. Web sessions and drafts use browser storage with an in-product disclosure. Demo mode stores synthetic/demo data locally and must not be used for real sensitive information.

## AI processing

Conversation input and bounded recent context can be sent by the API to the configured LLM provider to classify safety and intent, create a response and independently review output. Approved memories can be embedded and retrieved for relevant context. Pending or unapproved memories are excluded from retrieval. The exact production provider, subprocessor terms, processing region and retention settings must be added to the public policy before beta.

## User controls

The privacy center lets a user export a filtered JSON package, manage or delete memories, delete all journals or conversations, and delete the account. Exports omit vector embeddings, ownership identifiers and internal safety metadata. Account deletion removes the Supabase Auth user, relies on database cascades for owned server data, then clears local session, drafts, reminders and query caches.

Life Map suggestions are derived only from active memories the user already approved. A suggestion is returned as a preview and is not stored until the user chooses Add. Life Map rows remain private, owner-scoped and are included in account export and deletion.

## Logs and operational data

Structured logs may contain request ID, route template, HTTP status, latency, provider operation/status/error category, safety-level count and output-guard rejection reason. Logs must not contain raw conversations, journals, memories, authorization headers, access tokens, passwords, service keys or embeddings. No analytics provider is configured.

## Items required before public beta

- Publish a reviewed privacy policy and support contact at stable public URLs.
- Name the selected Supabase region and AI subprocessors and document their retention controls.
- Define age suitability, lawful basis/consent language and jurisdiction-specific rights handling.
- Confirm backup deletion windows and operational log retention with the selected hosting providers.
- Complete physical-device deletion/export QA against staging.
