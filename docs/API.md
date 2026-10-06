# API contract

Base URL: configured by `EXPO_PUBLIC_API_URL`. Every route requires `Authorization: Bearer <Supabase access token>`. Request bodies validated with shared Zod schemas; unknown fields discarded. Caller cannot set `user_id`. IDs validated as UUID except curated activity IDs. Error responses contain a localized generic `error`, never raw provider errors/private data. Every response includes `X-Request-ID`; a caller-supplied value is accepted only when it is a valid UUID.

| Method            | Path                             | Behavior                                                     |
| ----------------- | -------------------------------- | ------------------------------------------------------------ |
| POST              | /auth/profile                    | Complete onboarding profile                                  |
| GET, PATCH        | /profile                         | Read/update own profile                                      |
| POST              | /account/export                  | Return a JSON package of the caller's account data           |
| DELETE            | /account                         | Delete Supabase Auth user; cascade application data          |
| GET, POST         | /moods                           | List/create mood; `client_id` prevents retry duplicates      |
| GET, POST, DELETE | /conversations                   | List/create own conversation or delete all own conversations |
| GET, DELETE       | /conversations/:id               | Read conversation/messages or delete both                    |
| POST              | /conversations/:id/messages      | Safety pipeline; content, mode, client_id                    |
| POST              | /conversations/:id/journal-draft | Return unsaved draft, never insert journal                   |
| GET, POST, DELETE | /memories                        | List/add approved memory/delete all                          |
| PATCH, DELETE     | /memories/:id                    | Edit/delete memory and active vector                         |
| POST              | /memories/:id/approve            | Embed and approve explicitly                                 |
| POST              | /insights/ask                    | Answer from bounded, owned saved data with source references |
| GET, POST         | /life-map                        | List active items or add an approved manual item             |
| PATCH, DELETE     | /life-map/:id                    | Edit or soft-delete an owned item                            |
| POST              | /life-map/:id/approve            | Approve a pending item                                       |
| GET, POST         | /life-map/suggestions            | Preview or explicitly accept memory-backed suggestions       |
| GET               | /reflections/timeline            | Private merged timeline with an optional validated filter    |
| GET, POST, DELETE | /journals                        | List/save reviewed journal or delete all own entries         |
| PATCH, DELETE     | /journals/:id                    | Edit/delete own entry                                        |
| GET               | /self-care                       | Enabled curated database activities                          |
| POST              | /self-care/:id/start             | Create own activity session                                  |
| POST              | /self-care/:id/complete          | Complete matching `session_id`, award once                   |
| GET               | /garden                          | Own persistent garden state                                  |
| GET               | /weekly-reflection               | Opt-in summary of last seven days                            |
| POST              | /weekly-reflection/complete      | Save weekly summary, award once per UTC week                 |
| GET, PATCH        | /notification-preferences        | Off/morning/evening/custom and local time                    |

List endpoints currently return the most recent 100 entries (conversation detail: 200 messages; AI context: 12 messages). Database schema supports all historical records.

`POST /account/export` is limited to 2 requests/minute/IP and synchronously returns all retained rows owned by the authenticated user. The package contains profile, moods, journals, approved and pending memories, conversations with messages, self-care history, garden state, weekly reflections and notification preferences. Explicit projections exclude ownership identifiers, embeddings, classifier confidence, internal safety levels and safety events. The server pages through each table in batches of 500 and records only status, timestamps and record counts in `data_export_audits`; exported content is never copied into the audit. This synchronous path is intended for MVP-sized accounts. Move generation to a background job and private expiring object storage before supporting large accounts.

Export schema version 3 also includes active and deleted Life Map items plus Memory source metadata. It never duplicates the source record's raw content; provenance contains only the source type, source ID, reason and timestamps.

Global throttle: 90 requests/minute/IP; message generation 12/minute/IP; journal generation 5/minute/IP. Single-process in-memory throttle is appropriate to this modular monolith; use shared storage before horizontal scaling.

Normal message response: `{message, memory?, safetyLevel, activity?, crisisResources?}`. Intent classification JSON and safety-classifier availability remain server-internal. Crisis/elevated states bypass companion, memory retrieval/candidate creation and self-care suggestion. A classifier failure returns conservative copy with public `safetyLevel: "elevated"`; it never continues to normal generation. `crisisResources` contains only enabled resources with verification metadata recorded server-side and is omitted when none match. Server persists a pair of messages atomically and returns the same assistant record when a client retries the same UUID.

Hard deletion is used for explicit user deletion of private content. `deleted_at` columns additionally support operator recovery workflows; retrieval excludes soft-deleted data. No recovery interface is exposed to users in MVP.
