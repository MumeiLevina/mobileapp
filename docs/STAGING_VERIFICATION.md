# Staging service verification

Use a disposable development or staging Supabase project. The commands create synthetic users and delete them at the end. Never point them at production.

Apply **every file in `supabase/migrations` in filename order**. Do not use a
hand-maintained subset: staging must contain the complete schema required by
the current application. At this revision the sequence begins with
`202610010001_initial.sql` and ends with
`202610080002_private_save_idempotency.sql`, covering Life Map, memory provenance,
Guided Journals, rituals and ritual notifications, Letters, Soft Goals, the
Garden sanctuary, Personal Milestones and the validation privacy fixes. Treat
the filenames as the source of truth when newer migrations exist.

Configure the API with `MOCK_AI=false` and deploy it over HTTPS. Set these variables only in the local shell or the protected GitHub `staging` environment:

```text
STAGING_TARGET=staging
STAGING_API_URL=https://api-staging.example.com
RUN_SUPABASE_INTEGRATION_TESTS=true
RUN_PROVIDER_SAFETY_EVALS=true
SUPABASE_INTEGRATION_URL=...
SUPABASE_INTEGRATION_ANON_KEY=...
SUPABASE_INTEGRATION_SERVICE_ROLE_KEY=...
LLM_BASE_URL=...
LLM_API_KEY=...
LLM_MODEL=...
LLM_EMBEDDING_MODEL=...
LLM_TEXT_TIMEOUT_MS=60000
LLM_CLASSIFICATION_TIMEOUT_MS=30000
LLM_EMBEDDING_TIMEOUT_MS=30000
MOCK_AI=false
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_API_URL=https://api-staging.example.com
EXPO_PUBLIC_SUPABASE_URL=https://project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Run:

```sh
npm run preflight:staging
npm run test:supabase
npm run verify:staging
npm run eval:safety:staging
```

`preflight:staging` validates configuration and public mobile values without
making network requests or printing secrets. `test:supabase` covers signup,
password login, refresh, local logout, provisioning, a real JWT through
AuthGuard, cross-user RLS across current owner tables, browser write denial,
server-only tables and deletion cascades. `verify:staging` checks current schema
compatibility, Auth provisioning and refresh, deployed API ownership, Wave 3
smoke flows, Private Conversation non-persistence and idempotent explicit save,
export v6, real provider text, structured output and a 1536-dimension
embedding, then deletion through the supported API path. It sends only labeled
synthetic content, prints no keys or tokens and removes its temporary account.
The provider-backed eval sends its documented synthetic safety fixtures to the
configured model.

The manual GitHub workflow `staging-verification.yml` runs preflight and the
same three network commands only through `workflow_dispatch` with protected
environment secrets. It is not triggered for pull requests or forks.
