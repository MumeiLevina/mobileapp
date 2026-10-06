# Deployment runbook

## 1. Prepare isolated environments

Create separate Supabase projects and API deployments for staging and production. Configure production service credentials only in the hosting platform. Never copy production data into staging. Follow [ENVIRONMENTS.md](ENVIRONMENTS.md) for variable ownership and mobile environment values.

## 2. Apply the database

Apply migrations in filename order. Do not edit an already-applied migration and never run a destructive reset on hosted data. Run the seed only after reviewing environment-appropriate curated data; the repository intentionally contains no unverified hotline numbers.

For staging, run `npm run test:supabase` after migration. Back up production before a schema deployment and confirm the provider's point-in-time recovery settings. Roll back application code first when a forward-compatible additive migration has shipped; use a new compensating migration for schema rollback.

## 3. Deploy the API

Set `NODE_ENV=production`, `MOCK_AI=false`, Supabase URL/anon/service-role credentials, exact CORS origins, provider URL/key/model names and explicit provider timeouts. Build with `npm ci` and `npm run build:api`, deploy over HTTPS, then run `npm run verify:staging` against staging. Do not run destructive verification against production.

Check structured logs for startup, request status/latency, provider status, safety-level events and output-guard rejection events. Confirm logs contain no authorization header, access token or private user content. Configure alert thresholds and log retention in the selected hosting service before beta.

## 4. Configure EAS

From `apps/mobile`, authenticate with the intended Expo organization and run `eas init` to link the project; review the generated project ID before committing it. Create EAS `development`, `preview` and `production` environments with only the public mobile variables documented in [ENVIRONMENTS.md](ENVIRONMENTS.md).

Build an internal development client, then an internal preview build. Complete [NATIVE_QA.md](NATIVE_QA.md) on physical Android and iOS devices. The production profile creates store-ready artifacts but does not submit automatically. Review signing ownership, package/bundle identifiers, store privacy answers, public policy URLs, screenshots and release notes before a manual store submission.

## 5. Release gate

Require green default CI, a recorded staging Supabase run, a recorded provider health check, a provider-backed safety report for the exact candidate model, verified crisis resources or documented generic-only fallback, physical-device QA, dependency review and approved public privacy/safety copy. Record commit SHA, mobile build numbers, API deployment identifier, migration state and model identifiers.

## Rollback and incident response

- Mobile: stop tester distribution or store rollout; do not publish a new binary automatically.
- API: roll back to the last compatible image while preserving additive database changes.
- AI: disable the affected provider/model deployment at the API layer and keep safety fail-closed; never switch production to mock AI.
- Crisis directory: disable stale or disputed resources immediately; generic guidance remains available.
- Credential exposure: revoke and rotate the credential, redeploy affected services and inspect content-free operational logs.
- Privacy/safety incident: preserve necessary audit metadata without copying private content into tickets, restrict access and follow the published response process.
