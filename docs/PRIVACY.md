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
- Guided Journal answers are stored as private journals only after Save. Incomplete answers and Morning Ritual drafts remain in private device draft storage.
- Ritual entries retain only the selected ritual type, desired feeling, optional intention/reflection and idempotency identifier.
- Future Letters retain the private title, content and user-chosen open time. Letter content is never automatic AI, Ask Mori, Life Patterns or Memory context.
- Soft Goals retain user-entered titles/notes and non-punitive state. They are not automatic AI, Ask Mori, Life Patterns, Life Map or Memory context.
- Garden unlocks and Personal Milestones retain event keys, timestamps and source references, not copied journal, letter, memory or emotional content.

The application does not configure an analytics or advertising provider. It does not collect contacts, precise location, microphone recordings, camera data, health-platform data or payment data.

Quiet Room usage, Mori Moments choices and First Aid selections are not persisted. Human Connection never reads contacts or requests address-book permission. First Aid danger requests deterministic crisis guidance without sending a user-authored prompt to the companion model. Ritual details are excluded from Ask Mori and Life Patterns in Wave 2.

Private Conversation messages are not written to conversations, messages, memories, timeline, Soft Goals, Garden or analytics before explicit Save. Safety classification, deterministic crisis handling and output review still apply. Save converts the visible session into one normal saved conversation; leaving without Save discards it. Private Conversation never creates Garden progression or a milestone.

## Storage and access

Production-mode server data is stored in the configured Supabase PostgreSQL project. RLS restricts authenticated browser/mobile reads to the owner. Application writes use the Nest API with a service-role client and every repository operation is scoped by the user ID from a verified JWT. Service-role and AI keys never belong in a mobile build.

Native auth sessions and drafts use operating-system SecureStore-backed storage where implemented. Web sessions and drafts use browser storage with an in-product disclosure. Demo mode stores synthetic/demo data locally and must not be used for real sensitive information.

## AI processing

Conversation input and bounded recent context can be sent by the API to the configured LLM provider to classify safety and intent, create a response and independently review output. Approved memories can be embedded and retrieved for relevant context. Pending or unapproved memories are excluded from retrieval. The exact production provider, subprocessor terms, processing region and retention settings must be added to the public policy before beta.

## User controls

The privacy center lets a user export a filtered JSON package, manage or delete memories, delete all journals or conversations, and delete the account. Export schema v6 includes Letters, Soft Goals, Garden unlocks and Personal Milestones while omitting vector embeddings, ownership identifiers, Garden action keys and internal safety metadata. Account deletion removes the Supabase Auth user, cascades Letters, Soft Goals, Garden unlocks and Milestones with all other owned server data, then clears local session, drafts, reminders and query caches.

Life Map suggestions are derived only from active memories the user already approved. A suggestion is returned as a preview and is not stored until the user chooses Add. Life Map rows remain private, owner-scoped and are included in account export and deletion.

Each Memory records a short reason, source reference and approval time. Provenance does not copy the raw conversation, journal or mood into a second table. Source ownership is enforced by a composite database foreign key, and provenance follows the Memory through export and deletion.

Reflection Timeline is assembled on request from the user's existing rows and is not a public feed or a second content store. Conversation moments expose the conversation title and date; they do not copy message text into timeline storage.

## Logs and operational data

Structured logs may contain request ID, route template, HTTP status, latency, provider operation/status/error category, safety-level count and output-guard rejection reason. Logs must not contain raw conversations, journals, memories, authorization headers, access tokens, passwords, service keys or embeddings. No analytics provider is configured.

## Items required before public beta

- Publish a reviewed privacy policy and support contact at stable public URLs.
- Name the selected Supabase region and AI subprocessors and document their retention controls.
- Define age suitability, lawful basis/consent language and jurisdiction-specific rights handling.
- Confirm backup deletion windows and operational log retention with the selected hosting providers.
- Complete physical-device deletion/export QA against staging.
