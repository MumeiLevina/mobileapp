# Android beta build handoff

This is the focused handoff for the Android closed-beta candidate. The broader
manual QA campaign is intentionally deferred; no physical-device result is
claimed here.

## Candidate and integration status

- PR #12 targets `integration/android-closed-beta` from
  `fix/mobile-beta-qa-round2` and remains an unmerged draft.
- GitHub reported the PR mergeable at remote commit `02eb3e2`; a local
  `git merge-tree` simulation found no conflict with the target branch.
- GitHub Actions `Mori checks` run #92 completed successfully for `02eb3e2`.
- GitHub has no submitted review or unresolved review thread on PR #12. A
  maintainer still needs to review the final pushed diff and mark the PR ready.
- Existing screenshots, QA logs, native export, Supabase CLI state, scratch
  test and `artifacts/Mori-Demo-0.1.0-release.apk` are preserved. The APK is a
  demo artifact, not the connected beta candidate.

## Environment ownership

| Scope              | Required values                                                               | Storage                                                                         |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Render API         | `SUPABASE_URL`, anon key, service-role key, `CORS_ORIGIN`, LLM URL/key/models | Render secret manager only                                                      |
| EAS linkage        | `EAS_PROJECT_ID`                                                              | local ignored env for initial linking; committing the reviewed UUID is optional |
| EAS preview        | API HTTPS URL, Supabase HTTPS URL, Supabase anon/publishable key              | EAS `preview` environment                                                       |
| Local verification | staging aliases plus the same service values                                  | current shell or ignored `.env`; never source control                           |

`EXPO_PUBLIC_*` values are embedded in the APK. Only the Supabase public
anon/publishable key belongs there. Service-role, database and LLM credentials
must never be added to EAS.

## Current configuration

- `render.yaml` prepares a Node staging service on
  `integration/android-closed-beta`, disables automatic deployment, and uses
  `/health`. Importing the Blueprint or deploying it remains an owner action.
- The API has a public minimal health endpoint. It reveals no environment or
  dependency detail.
- The `preview` profile creates an internal APK and always sets
  `EXPO_PUBLIC_DEMO_MODE=false`.
- Dynamic app config rejects preview/production unless an Expo project UUID,
  HTTPS API URL, HTTPS Supabase URL and public Supabase key are present.
- The local ignored API env contains a complete real-LLM configuration, but no
  Supabase URL/keys. The mobile ignored env remains a local demo configuration.
- Supabase CLI metadata points to a linked hosted project whose name does not
  clearly identify it as staging. CLI access failed locally, so it must not be
  migrated or used until the owner confirms the target.
- No Render service URL/configuration and no Expo login/token are available in
  this workspace.

## Configure staging without exposing secrets

1. Confirm that the linked Supabase project is disposable staging. Review the
   remote migration list and `db push --dry-run`; obtain approval before any
   remote migration.
2. Import `render.yaml` or configure the same service manually. Fill every
   `sync: false` value in Render. Do not deploy until approved.
3. After the approved Render deployment is healthy, set the four public EAS
   preview values:

```powershell
Set-Location apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
$env:EAS_PROJECT_ID = Read-Host 'Reviewed Expo project UUID'
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_API_URL --value (Read-Host 'Staging API HTTPS URL') --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value (Read-Host 'Staging Supabase HTTPS URL') --visibility plaintext
$anon = Read-Host 'Staging anon/publishable key' -AsSecureString
$anonText = [Net.NetworkCredential]::new('', $anon).Password
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value $anonText --visibility sensitive
$anon = $null
$anonText = $null
```

`EXPO_PUBLIC_DEMO_MODE=false` is already fixed in the preview profile. Do not
copy server-only values to EAS.

## Build the preview APK

From `apps/mobile`, with Expo authentication and the reviewed project UUID:

```powershell
$env:EAS_PROJECT_ID = Read-Host 'Reviewed Expo project UUID'
npx eas-cli@latest env:list --environment preview
npx eas-cli@latest build --platform android --profile preview
```

This creates an APK and does not submit it to Google Play. Record the build ID,
URL, commit SHA, app version and Android version code after completion. Do not
reuse the existing demo APK as beta evidence.

## Remaining blockers

1. Confirmed staging Supabase URL, anon key and service-role key are missing.
2. A deployed Render staging API URL is missing; deployment is approval-gated.
3. Expo authentication and the intended EAS project UUID are missing.
4. The EAS preview environment has not been populated.
5. Android SDK, ADB and the generated native Gradle wrapper exist at standard
   local locations, but the SDK variables/PATH are not configured in the
   current shell. A connected local build is still blocked by the missing
   staging values; EAS cloud build remains the primary prepared path.
6. Physical Android QA remains `NOT RUN` by request.

See `WINDOWS_STAGING_ANDROID.md` for the full staging and device runbook.
