# Windows staging and Android preview runbook

This runbook prepares a disposable Mori staging environment from PowerShell.
It does not authorize production deployment. Commands that create or mutate a
hosted resource are marked **OWNER ACTION**. Never paste secret values into a
ticket, commit, screenshot or command transcript.

## 0. Required owner access and Windows tools

Before starting, confirm the owner has access to each external service. Missing
access is a `NOT RUN` result, not a reason to substitute a mock integration.

| Requirement                               | Used for                                                               | Required owner action                                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Git, Node.js 24 and npm                   | Repository checkout and all local gates                                | Install them and confirm `git --version`, `node --version` and `npm --version` work in PowerShell.                                         |
| GitHub repository access                  | Protected staging secrets and manual verification workflow             | Be able to manage the repository `staging` environment and read Actions runs.                                                              |
| Disposable Supabase project               | Auth, PostgreSQL, pgvector, RLS and destructive synthetic verification | Create a staging-only project and keep its URL, anon/publishable key, service-role/secret key and database password in a password manager. |
| HTTPS Node.js host                        | NestJS staging API                                                     | Be able to configure secrets, build with npm, run the start command and inspect logs.                                                      |
| OpenAI-compatible LLM provider            | Real text, structured output and embeddings                            | Provision a server-side key plus a text model and a model supporting exactly 1536 embedding dimensions.                                    |
| Expo account with EAS access              | Internal Android APK                                                   | Be able to create or select the intended Mori Expo project and run EAS builds.                                                             |
| Android Studio or Android SDK Build Tools | APK permission inspection and device QA                                | Install `apkanalyzer` and make an Android device available for the closed-beta pass.                                                       |

Docker Desktop is needed only for an optional local Supabase stack. It is not
required for the linked hosted-staging migration flow below.

## 1. Verified inputs

Start from the exact review candidate. Before the integration PR is approved,
that is its dedicated branch; after approval, use the resulting
`develop/mobile` commit. Never validate a different commit from the one being
considered for beta:

```powershell
git fetch origin
git switch integration/android-closed-beta
git pull --ff-only origin integration/android-closed-beta
git status --short --branch
git rev-parse HEAD
npm ci
npm run typecheck
npm run lint
npm test
npm run eval:safety
npm run test:mobile
npm run test:database
npm run build:api
npm run export:web
npm run export:native
npm run test:e2e
```

The working tree must be clean. Do not continue from `main` or
`experiment/live2d-snow-neko`.

If the integration PR has already been approved and merged, replace the two
`integration/android-closed-beta` occurrences above with `develop/mobile`.

## 2. Ownership map

| Scope               | Values                                                                                                 | Storage                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Hosted API          | `NODE_ENV`, `MOCK_AI`, Supabase URL/anon/service-role keys, `CORS_ORIGIN`, LLM URL/key/models/timeouts | API host secret manager                 |
| Local verification  | `STAGING_*`, `SUPABASE_INTEGRATION_*`, `RUN_*`, LLM values and public mobile values                    | Current PowerShell process only         |
| GitHub verification | Same verification values                                                                               | Protected `staging` environment secrets |
| EAS preview         | Four `EXPO_PUBLIC_*` values only                                                                       | EAS `preview` environment               |

`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_INTEGRATION_SERVICE_ROLE_KEY` and
`LLM_API_KEY` are server-only. Every `EXPO_PUBLIC_*` value is embedded in the
app and must not contain a service-role key, provider key, database password or
other private credential.

## 3. Create and migrate disposable Supabase staging

**OWNER ACTION:** Create a new Supabase project used only for staging. Record
its project ref, HTTPS project URL, anon/publishable key, service-role/secret
key and database password in a password manager. Do not reuse production.

From the repository root:

```powershell
npx supabase@latest login
$stagingProjectRef = Read-Host 'Disposable staging project ref'
npx supabase@latest link --project-ref $stagingProjectRef
npx supabase@latest migration list --linked
npx supabase@latest db push --dry-run
```

Review the dry-run. It must contain the repository migrations in filename
order, currently from `202610010001_initial.sql` through
`202610080002_private_save_idempotency.sql`. If the remote has unexpected
migrations, stop and reconcile it; do not use `migration repair` or a linked
reset without understanding the remote history.

**OWNER ACTION:** Apply the reviewed migrations once:

```powershell
npx supabase@latest db push
npx supabase@latest migration list --linked
```

Do not run `db reset --linked`. Seeding is optional for staging and must be
reviewed first; the repository intentionally does not seed unverified hotline
numbers.

## 4. Deploy the NestJS API over HTTPS

The owner must select and authenticate to a hosting platform. Configure these
values in that platform's secret manager, not in Git:

```text
NODE_ENV=production
MOCK_AI=false
SUPABASE_URL=<staging project HTTPS URL>
SUPABASE_ANON_KEY=<staging anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<staging service-role/secret key>
CORS_ORIGIN=<exact allowed staging web origin>
LLM_BASE_URL=<OpenAI-compatible HTTPS base URL ending before chat/completions>
LLM_API_KEY=<provider key>
LLM_MODEL=<text and structured-output model identifier>
LLM_EMBEDDING_MODEL=<model that supports exactly 1536 output dimensions>
LLM_TEXT_TIMEOUT_MS=60000
LLM_CLASSIFICATION_TIMEOUT_MS=30000
LLM_EMBEDDING_TIMEOUT_MS=30000
```

Build command:

```powershell
npm ci
npm run build:api
```

Start command:

```powershell
npm run start -w @mori/api
```

The public result must be a stable HTTPS URL. Confirm that the deployment has
no demo/mock override, that logs contain no tokens or private content, and that
the platform retains only operational metadata for the approved period.

## 5. Load a local verification session safely

Open a new PowerShell window. The following helper masks secret input and keeps
values only in the current process:

```powershell
function Read-MoriSecret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  [Net.NetworkCredential]::new('', $secure).Password
}

$env:STAGING_TARGET = 'staging'
$env:STAGING_API_URL = Read-Host 'Staging API HTTPS URL'
$env:RUN_SUPABASE_INTEGRATION_TESTS = 'true'
$env:RUN_PROVIDER_SAFETY_EVALS = 'true'
$env:SUPABASE_INTEGRATION_URL = Read-Host 'Staging Supabase HTTPS URL'
$env:SUPABASE_INTEGRATION_ANON_KEY = Read-MoriSecret 'Staging anon/publishable key'
$env:SUPABASE_INTEGRATION_SERVICE_ROLE_KEY = Read-MoriSecret 'Staging service-role/secret key'
$env:LLM_BASE_URL = Read-Host 'OpenAI-compatible HTTPS base URL'
$env:LLM_API_KEY = Read-MoriSecret 'LLM API key'
$env:LLM_MODEL = Read-Host 'Text/classification model identifier'
$env:LLM_EMBEDDING_MODEL = Read-Host '1536-dimension embedding model identifier'
$env:LLM_TEXT_TIMEOUT_MS = '60000'
$env:LLM_CLASSIFICATION_TIMEOUT_MS = '30000'
$env:LLM_EMBEDDING_TIMEOUT_MS = '30000'
$env:MOCK_AI = 'false'
$env:EXPO_PUBLIC_DEMO_MODE = 'false'
$env:EXPO_PUBLIC_API_URL = $env:STAGING_API_URL
$env:EXPO_PUBLIC_SUPABASE_URL = $env:SUPABASE_INTEGRATION_URL
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = $env:SUPABASE_INTEGRATION_ANON_KEY
```

Run in order:

```powershell
npm run preflight:staging
npm run test:supabase
npm run verify:staging
npm run eval:safety:staging
```

These commands create synthetic staging users and delete them. Run them only
against the disposable staging project. Close the PowerShell window afterwards
to discard the process environment.

## 6. Configure protected GitHub staging verification

**OWNER ACTION:** In GitHub, create the `staging` environment and add these
environment secrets:

```text
STAGING_API_URL
SUPABASE_INTEGRATION_URL
SUPABASE_INTEGRATION_ANON_KEY
SUPABASE_INTEGRATION_SERVICE_ROLE_KEY
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
LLM_EMBEDDING_MODEL
```

Restrict deployment branches to `develop/mobile` and add required reviewers if
available. Trigger **Mori staging verification** manually only after local
preflight passes. Record the run URL and exact commit in
`docs/REAL_VALIDATION.md`; never copy secret values into the record.

## 7. Link EAS and configure preview

The repository already defines an internal Android APK profile in
`apps/mobile/eas.json`. Project linkage requires the owner's Expo account.

```powershell
Set-Location apps/mobile
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
git diff -- app.config.js
```

**OWNER ACTION:** Review the Expo owner/project and generated
`extra.eas.projectId`. Commit it only if it belongs to the intended Mori
project.

Set only public mobile configuration in the EAS `preview` environment:

```powershell
$previewApiUrl = Read-Host 'Staging API HTTPS URL'
$previewSupabaseUrl = Read-Host 'Staging Supabase HTTPS URL'
$previewAnonSecure = Read-Host 'Staging anon/publishable key' -AsSecureString
$previewAnonKey = [Net.NetworkCredential]::new('', $previewAnonSecure).Password
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_DEMO_MODE --value false --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_API_URL --value $previewApiUrl --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value $previewSupabaseUrl --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value $previewAnonKey --visibility sensitive
npx eas-cli@latest env:list --environment preview
$previewAnonKey = $null
$previewAnonSecure = $null
```

Do not add `LLM_API_KEY`, a service-role key or database password to EAS.

Build without submission:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Record the build URL, build ID, commit, app version and Android version code.
An Expo export is not an APK build.

## 8. Inspect Android permissions

Download the completed preview APK. In Android Studio's APK Analyzer, inspect
`AndroidManifest.xml`, or use Android SDK Build Tools:

```powershell
apkanalyzer manifest permissions .\mori-preview.apk
```

The APK must not request microphone, camera, contacts or location permissions.
The app config explicitly blocks:

```text
android.permission.RECORD_AUDIO
android.permission.CAMERA
android.permission.READ_CONTACTS
android.permission.WRITE_CONTACTS
android.permission.GET_ACCOUNTS
android.permission.ACCESS_COARSE_LOCATION
android.permission.ACCESS_FINE_LOCATION
android.permission.ACCESS_BACKGROUND_LOCATION
```

Notification permission is expected only for the existing opt-in local
reminder feature. Record the complete observed permission list in the QA run.

## 9. Physical Android priority pass

Use `docs/NATIVE_QA.md` and record device model, Android version, APK build ID,
API environment, tester and date. Run these first:

1. Install/launch, account creation, onboarding, logout/login and token expiry.
2. Chat modes, retry with the same client ID, safety classifier failure and
   output-guard fallback.
3. Approve/edit/retrieve/delete memory; confirm consent boundaries.
4. Journal create/edit/search/delete and kill/restart draft recovery.
5. Notification denied/allowed, timezone change and duplicate prevention.
6. Offline launch, slow request, timeout, recovery and duplicate prevention.
7. SecureStore failure, logout cleanup and process-kill recovery.
8. Export inspection, delete conversations/memories, then account deletion.
9. TalkBack, large text, reduced motion, dark/light mode and Vietnamese input.

Automated suites do not satisfy these device checks. Keep every unchecked item
as `NOT RUN`; use `BLOCKED` only when a named prerequisite prevents execution.

## 10. Owner completion checklist

Record the exact commit and evidence links in `docs/REAL_VALIDATION.md`. The
closed-beta candidate is not ready until every required item below is either
`PASS` or explicitly accepted by the owner as a documented release risk.

- [ ] The integration PR into `develop/mobile` is approved; neither source PR
      was merged implicitly.
- [ ] The disposable Supabase project contains every repository migration in
      filename order and the linked migration list was reviewed.
- [ ] The HTTPS NestJS deployment uses `NODE_ENV=production`, `MOCK_AI=false`,
      server-only Supabase keys and server-only LLM credentials.
- [ ] `preflight:staging`, `test:supabase`, `verify:staging` and
      `eval:safety:staging` passed against the same staging environment.
- [ ] The protected GitHub `Mori staging verification` run passed for the exact
      candidate commit.
- [ ] The Expo owner, project and generated `extra.eas.projectId` were reviewed
      before committing EAS linkage.
- [ ] The EAS `preview` environment contains only the four documented public
      mobile values; no service-role, provider or database credential is present.
- [ ] The Android preview APK completed, its build URL/ID and version code were
      recorded, and its manifest permissions were inspected.
- [ ] `docs/NATIVE_QA.md` was completed on a physical Android device, including
      notification denied/allowed and process-kill recovery paths.
