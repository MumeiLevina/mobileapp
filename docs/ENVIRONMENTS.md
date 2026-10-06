# Environment strategy

Mori has separate mobile and API configuration for development, staging and production. AI and Supabase service-role keys exist only on the API. `EXPO_PUBLIC_*` values are embedded in the mobile bundle and must never contain a private credential.

## Mobile development

Use `apps/mobile/.env` locally. Demo mode can run without services:

```text
EXPO_PUBLIC_DEMO_MODE=true
EXPO_PUBLIC_API_URL=http://localhost:3001
```

For a connected simulator, set demo mode to `false` and provide the API, Supabase URL and anon key. An Android emulator normally reaches the host through `http://10.0.2.2:3001`. A physical Android or iOS device cannot use the computer's `localhost`; use an HTTP LAN address reachable from the device for local development or a staging HTTPS URL. Keep local firewall and network exposure limited to the development network.

The EAS `development` profile creates an internal development client. Configure the EAS `development` environment with the same three public connected-mode values when the build must talk to shared development services.

## Mobile preview

The EAS `preview` profile is an internal, production-like closed-beta build. Configure the EAS `preview` environment with:

```text
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_API_URL=https://api-staging.example.com
EXPO_PUBLIC_SUPABASE_URL=https://project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

`app.config.js` rejects preview and production builds if demo mode is enabled, required values are absent, or either URL is not remote HTTPS. The anon key is intentionally public and protected by RLS; the service-role key remains server-side.

## Mobile production

The EAS `production` profile creates store-ready artifacts and increments native build numbers remotely. Set the same public variable names in the EAS `production` environment, pointing only to production HTTPS services. A production profile does not submit or publish automatically; store submission remains a separate manual action.

Do not put `LLM_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, access tokens or database passwords in any EAS mobile environment.

## API development

Copy `apps/api/.env.example` to `apps/api/.env`. Local Supabase URLs and `MOCK_AI=true` are allowed. `CORS_ORIGIN` should list only the local web origins in use. On-device traffic must target the development machine's LAN URL rather than the device's `localhost`.

## API staging

Deploy the Nest API over HTTPS with `NODE_ENV=production`, `MOCK_AI=false`, staging Supabase credentials and staging LLM credentials. Limit CORS to the staging web origin. Apply every migration in filename order, then run the commands in [STAGING_VERIFICATION.md](STAGING_VERIFICATION.md). Store secrets in the deployment platform and the protected GitHub `staging` environment.

## API production

Use a separate production Supabase project and production provider credentials. Set `NODE_ENV=production`, `MOCK_AI=false`, explicit timeouts and exact CORS origins. Never run destructive staging verification against production. Rotate credentials through the hosting provider and redeploy; do not commit `.env` files.
