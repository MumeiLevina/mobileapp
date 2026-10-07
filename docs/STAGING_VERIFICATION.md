# Staging service verification

Use a disposable development or staging Supabase project. The commands create synthetic users and delete them at the end. Never point them at production.

Apply **every file in `supabase/migrations` in filename order**. Do not use a
hand-maintained subset: staging must contain the complete schema required by
the current application. At this revision the sequence begins with
`202610010001_initial.sql` and ends with
`202610070009_personal_milestones.sql`, covering Life Map, memory provenance,
Guided Journals, rituals and ritual notifications, Letters, Soft Goals, the
Garden sanctuary and Personal Milestones.

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
```

Run:

```sh
npm run test:supabase
npm run verify:staging
npm run eval:safety:staging
```

`test:supabase` covers signup, password login, refresh, local logout, provisioning, a real JWT through AuthGuard, browser RLS isolation and deletion cascades. `verify:staging` checks Supabase, Auth, a database query, the deployed API with verified ownership, text generation and a 1536-dimension embedding. It sends only labeled synthetic content, prints no keys or tokens and removes its temporary account. The provider-backed eval sends its documented synthetic safety fixtures to the configured model.

The manual GitHub workflow `staging-verification.yml` runs the same three commands only through `workflow_dispatch` with protected environment secrets. It is not triggered for pull requests or forks.
