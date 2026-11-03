# Connected Android recovery — 4 November 2026

Decision: **NO-GO**. Candidate under review: PR #16, source
`291ff86fcce0a7780ee332d0210c58d28bd3f2da`. Recovery changes are on
`fix/connected-beta-recovery-20261104`, based on that exact source. They require
review before selecting the final integration SHA. No merge, hosted migration,
deployment, cloud build or APK publication was performed.

## Recovered interrupted work

Task `bl40a9bja` did not run Jest. Its entire meaningful result was
`apps/api/.env: not found`; the pipeline then printed exit 0. Task `bn8suiweh`
failed shell `export` parsing before emulator launch. Neither result is a pass.

The replacement provider run enabled `RUN_PROVIDER_SAFETY_EVALS=true`, using
OpenAI `gpt-4o-mini`, with `text-embedding-3-small` configured (this evaluation
does not exercise embeddings). At source `291ff86`, Jest returned **0** with
**57 passed, 0 failed, 0 skipped**, 1 suite, 74.559 seconds.

| Measurement | Actual outcome |
| --- | --- |
| Raw classification | 22/22; FP 0, FN 0, critical FN 0 |
| SafetyService end-to-end | 22/22; FP 0, FN 0, critical FN 0 |
| Benign Vietnamese cases | all passed in both classification groups |
| Output guard / contextual dependency | 13/13 compliant |
| Natural responses | 6/13 |
| Fallback | 7/13 (53.85%); includes the deliberately rejected contextual-dependency fixture |
| Policy violations accepted by guard | 0/13 |
| Provider request events | 68 successful; 0 non-success / warning / error events |
| Observed timeouts / malformed-output diagnostics | 0 / 0 |

This is one synthetic engineering sample with a model-based policy judge, not
clinical validation or proof of the deployed API's model configuration. The
fallback rate is reported, not hidden behind the pass count. There is no
existing numerical fallback acceptance threshold; an owner should review its
product impact before sign-off. End-user output quality is still unverified.

Raw logs stay outside Git at `C:/mori-recovery-evidence-20261104`. Use the new
runner to repeat safely; it checks Jest's actual exit code, complete metrics
and zero skipped tests, and saves only sanitized counts/case IDs:

```powershell
# Load existing ignored provider configuration locally, never through chat.
# RUN_PROVIDER_SAFETY_EVALS must explicitly be true in that environment.
node --env-file=C:/secure/mori-provider.env scripts/run-provider-safety-eval.mjs C:/mori-evidence/provider-summary.json
if ($LASTEXITCODE -ne 0) { throw 'Provider safety gate failed or remains unverified' }
```

`.env.providereval.local` was untracked, unstaged and absent from path history.
It was initially not ignored and inherited broad local read permissions.
Local Git exclusion and restricted file ACLs were applied. The recovery branch
also ignores `.env.*.local` and signing keystores. No evidence of external
disclosure was observed; this is not proof that no local principal read it.
Private logs and credential files must never be attached to a PR.

After the successful repeat below, the temporary provider env was confirmed to
duplicate the four provider values in the existing ignored API env. The
temporary file was removed without printing its content; retained API env files
were restricted to the current Windows user, SYSTEM and Administrators. No
credential value changed. Provider configuration remains available locally.

## Supabase diagnosis and owner decision

Mobile URLs in the staging/main worktrees, decoded public anon JWT `ref`,
the main worktree API URL/service-role JWT `ref`, and CLI `project-ref` all
identify `fzptgnoxbfnfgvhpkzsv`. Public tokens inspected had role `anon` and were
not expired; the API credential had role `service_role`. The verification and
native-readiness worktrees had no usable Connected configuration. The older
staging API env had LLM settings but no Supabase settings. No newer project
reference was found in the inspected env files and tracked configuration/docs.
Decoded JWT metadata is not cryptographic verification of a live project.

At 2026-11-04 04:25 Asia/Saigon, Google and Cloudflare DoH both returned DNS
status **3 (NXDOMAIN)**. Auth health failed with `ENOTFOUND`. This makes a local
resolver-only problem unlikely, but does not establish deletion versus pause,
an abandoned reference, a project-specific incident or a regional issue. Runtime
Render secrets and hosted migration history could not be inspected.

No management access token was present in the process. The installed Supabase
CLI could not list projects because writing its existing `.supabase` telemetry
directory failed with `EPERM`. Browser/native dashboard access was unavailable.
No infrastructure or credential target was changed.

**Highest-priority owner action:** open the intended Supabase organization and
inspect project `fzptgnoxbfnfgvhpkzsv`. Record its actual state and whether it is
isolated disposable staging. If paused, restore that existing project through
the dashboard after reviewing its state. If a newer staging project exists,
verify its identity/history first. If deleted/unrecoverable, explicitly approve
a separate isolated staging recovery; do not silently replace production.
Share only project alias/ref and status in the PR; enter keys directly into the
local ignored configuration or service secret managers.

Supabase documents distinct [pause recovery](https://supabase.com/docs/guides/platform/free-project-pausing)
and [permanent deletion](https://supabase.com/docs/guides/platform/delete-project)
behavior. Dashboard evidence must decide which recovery path applies.

## Staging recovery procedure — approval required before hosted changes

1. Record organization, project ref, region, owner, staging isolation and backup
   availability. Use PostgreSQL 17-compatible schema, `extensions.vector(1536)`,
   Supabase Auth and the expected `public`/`extensions` schemas. Do not import
   private production journals/conversations for testing.
2. Inspect remote migration history read-only; compare checksums/schema with
   the reviewed source. On an existing project, apply only missing approved
   migrations. Never reset hosted data or blindly replay the initial schema.
   For a separately approved empty staging project, the full order is:

```text
202610010001_initial.sql
202610060001_auth_rls_hardening.sql
202610060002_crisis_resources.sql
202610060003_data_export_audits.sql
202610070001_life_map.sql
202610070002_memory_provenance.sql
202610070003_guided_journals.sql
202610070004_rituals.sql
202610070005_ritual_notifications.sql
202610070006_letters.sql
202610070007_soft_goals.sql
202610070008_garden_sanctuary.sql
202610070009_personal_milestones.sql
202610080001_safety_events_server_only.sql
202610080002_private_save_idempotency.sql
202610260001_memory_creation_idempotency.sql
```

3. Review the last migration before approval. Existing rows retain nullable
   `memories.client_id`; the new **manual-create HTTP request requires a UUID**.
   Old manual clients without `client_id` receive validation failure. The owner
   must approve coordinated client rollout/minimum version or a separately
   reviewed compatibility strategy before deploying the new API; no UUID
   invention on retries and no silent weakening of the idempotency contract.
4. Confirm `memory_creation_requests` has RLS enabled and no grants to PUBLIC,
   anon or authenticated. `create_manual_memory` is SECURITY DEFINER with an
   empty search path, explicit schema references, owner/UUID advisory locking,
   payload fingerprint and deletion tombstone. EXECUTE is revoked from PUBLIC,
   anon and authenticated, granted only to service_role. Verify these grants in
   hosted PostgreSQL, not just by reading the SQL. Local PGlite evidence does
   not establish real multi-connection concurrency or hosted permissions.
5. Configure Auth for the actual staging web origin and `mori://auth` callback;
   review site URL, email confirmation, SMTP/rate limits and session policy.
   `supabase/config.toml` has local development confirmation disabled; it is
   not permission to copy that setting into public beta. Use synthetic accounts.
6. Store matching API URL/anon/service-role credentials in Render secrets, and
   only HTTPS URL plus anon/publishable key in mobile build env. Match public
   JWT `ref` where available. Publishable keys are opaque; confirm their project
   identity through dashboard plus actual authentication. Never expose
   service-role, database or LLM credentials in any `EXPO_PUBLIC_*` variable.
7. After target isolation and migration approval, run preflight, hosted schema
   tests and synthetic verification against that one staging project. The
   recovery schema probe now rejects missing Memory request table/client ID.
   Test two accounts: auth/login/refresh; cross-user read/write rejection;
   explicit consent; Memory same UUID replay, changed payload rejection,
   edited/forgotten memory, provenance/Garden rollback, parallel retries; export
   allowlist; deletion cascade and revoked-token behavior. Confirm that anon and
   authenticated clients cannot execute the service-only RPC or read its table.
   Existing hosted scripts do not prove every item in this checklist.
8. Snapshot approved schema, migration ledger, Auth settings and old service env
   references before changes. On rollback, retain the additive Memory column,
   table and tombstones; roll API/client back to a compatible reviewed SHA.
   Do not drop private data or retry identities to simulate rollback. An actual
   backup restore needs separate approval and a rehearsal in isolated staging.

## Render diagnosis and controlled redeployment

The observed `https://mori-api-qygo.onrender.com` returned 404 for `/`, `/health`
and `/api/health`, and 401 for `/profile`, `/moods`, `/journals`, `/memories`,
`/conversations`, without credentials. A 401 establishes route/auth activity,
not healthy database/Auth connectivity.

Source includes `HealthController` registered directly in `AppModule`, public
`GET /health`, returning HTTP 200 with `{"status":"ok"}`. There is no global
prefix. It was introduced in `62aa48a`; source is inconsistent with observed
deployment behavior. Stale deployment or a different service/start command is
plausible, but the actual deployed commit and dashboard health path are unknown.
The Blueprint names `mori-api-staging`, whereas the observed URL is
`mori-api-qygo`; do not assume they are the same configured service.

Before an approved staging redeploy:

- Export sanitized Render metadata: service ID, repository/branch, active deploy
  ID/SHA, build/start commands and health-check path. Do not export env values.
- Select an exact reviewed integration SHA containing #16 and approved recovery
  fixes. `291ff86` identifies the reviewed baseline, not approval to deploy an
  unmerged feature head. Keep automatic deployment off.
- Verify the approved Memory migration and older-client compatibility first.
- Set Node 24, `NODE_ENV=production`, `MOCK_AI=false`; configure `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN`, `LLM_BASE_URL`,
  `LLM_API_KEY`, `LLM_MODEL`, `LLM_EMBEDDING_MODEL`, and the three LLM timeout
  settings (60000/30000/30000 ms). Let Render supply `PORT`.
- Use `npm ci && npm run build:api`, then `npm run start -w @mori/api`,
  `/health` health check. Confirm dashboard identity matches the intended URL.
- After approved deployment: `/health` 200 exact shape, protected unauthenticated
  routes 401, synthetic login/refresh, owned reads/writes and cross-owner denial,
  Memory replay/tombstone, real text/structured/1536-dimension embedding, account
  deletion/token rejection. Health is process liveness only; it does not probe
  Supabase or LLM dependencies.
- Record previous good deploy ID/SHA and env references. On regression stop
  distribution, roll back to that compatible deploy, retain additive schema,
  repeat smoke tests; do not enable mock AI.

See Render's [specific-commit deployment](https://render.com/docs/deploys),
[health checks](https://render.com/docs/health-checks) and
[rollback](https://render.com/docs/rollbacks) documentation. No deployment was
attempted in this recovery.

## Local Connected APK preparation on Windows

Use a new short-path worktree at the final reviewed SHA. Keep other native
directories and APKs unchanged. `apps/mobile/app.config.js` selects
`app.mori.companion`, version `0.1.0`, versionCode `1`. Owner must compare with
previously distributed Connected versions and increase the code if required.
EAS remote auto-increment does not manage a direct local Gradle build.

`preview` produces an internal APK with Demo disabled. `production` is the store
profile; `development`/`demo-qa` do not certify Connected beta. Existing generated
Expo native projects defaulted release to the debug signing config, so a plain
`assembleRelease` is insufficient for distribution signing.

The prepared path is Expo prebuild plus native Gradle, not paid EAS cloud or
`eas build --local` on Windows. See Expo's [local release guide](https://docs.expo.dev/guides/local-app-production/)
and [EAS local-platform limitations](https://docs.expo.dev/build-reference/local-builds/).

After staging is healthy, its migration/client contract is approved and the
owner's release keystore is available locally:

```powershell
# In the NEW final-source checkout; load the reviewed public env locally first.
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = 'C:\mori-build-cache\gradle'
$env:ANDROID_USER_HOME = 'C:\mori-build-cache\android'
$env:EXPO_NO_DOTENV = '1'
$env:EAS_BUILD_PROFILE = 'preview'
$env:EXPO_PUBLIC_DEMO_MODE = 'false'
# Required: reviewed EAS_PROJECT_ID UUID, EXPO_PUBLIC_API_URL,
# EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
# No server keys in this shell. Do not print the resolved Expo config/key.
Set-Location apps/mobile
node ../../node_modules/expo/bin/cli prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'prebuild failed' }

# Set MORI_ANDROID_KEYSTORE (absolute private file), MORI_ANDROID_KEY_ALIAS,
# MORI_ANDROID_STORE_PASSWORD and MORI_ANDROID_KEY_PASSWORD using local secure
# prompts or a secret manager. Never put passwords in commands, source or logs.
Set-Location android
./gradlew.bat --no-daemon -I ../../../scripts/android-connected-release.init.gradle :app:assembleRelease
if ($LASTEXITCODE -ne 0) { throw 'APK build failed' }
```

The init script requires explicit Connected preview, refuses the standard debug
identity, applies the supplied signing config and disables release debugging.
Verify its signing report and final APK certificate against the owner's trusted
fingerprint. An arbitrary non-debug filename/alias alone does not prove trust.
Do not generate or substitute a new owner release identity without approval.
This procedure's native dry-run outcome is recorded separately; scripts alone
are not proof of a build.

Before retaining an APK as the candidate, record `git rev-parse HEAD`, clean
tracked status, package/version, `Get-FileHash -Algorithm SHA256`, and:

```powershell
$tools = "$env:ANDROID_HOME\build-tools\36.0.0"
& "$tools\apksigner.bat" verify --verbose --print-certs $apk
& "$tools\aapt.exe" dump badging $apk
& "$tools\aapt.exe" dump permissions $apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r $apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am force-stop app.mori.companion
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell monkey -p app.mori.companion -c android.intent.category.LAUNCHER 1
```

`$apk` must be the newly built absolute `app-release.apk` path. Record actual
min/target SDK and every permission; camera, microphone, contacts and location
must be absent. Stop Metro, cold-start twice, inspect startup logcat using only
synthetic data, confirm no dev-server dependency, then verify real login and API
ownership. Extract/inspect embedded public endpoint configuration without
publishing tokens. Never use the old Demo APK as evidence.

## Emulator/device and executable native checklist

SDK Build Tools 35/36 and emulator 37.1.11 exist. `test` uses an x86_64 Android
37.2 system image with Google Play/16 KB pages, 4 vCPUs and 2048 MB RAM; this is
configuration metadata, **not an observed running Android OS**. WHPX acceleration
check passed. About 3.7 GB host RAM and 41 GB disk were free before attempts.

No device was listed by `adb devices -l`; `sys.boot_completed` was unavailable.
The normal attempt hit `.android/emu-last-feature-flags.protobuf.lock` access
denied. A separate emulator home with `-read-only -no-snapshot` advanced to the
AVD's `snapshot.lock.lock` access denial. Only newly launched emulator processes
were stopped. No ACLs/userdata/snapshots in the existing AVD were modified.
Run the AVD under its owning Windows account or repair its permissions with the
owner, or connect a physical Android device with USB debugging. Do not wipe it.

After `adb devices -l` and `adb shell getprop sys.boot_completed` show an actual
booted device, record model, ABI, Android release/API, APK SHA, source SHA,
signing fingerprint, API URL and synthetic account aliases for each checklist
row. Test at minimum supported API and a current stable physical Android;
the preview AVD alone cannot close that matrix.

All rows below are **NOT RUN** until a verified Connected APK/device exists:

- Register/login/refresh; Ask Mori reaches real HTTPS API; switch A→B while
  requests are pending, then A→B→A; no late data/write crosses owners.
- Journal and Guided Journal: type Vietnamese multiline drafts, background,
  kill/relaunch and restore only for the same owner; retry a failed save.
- Private Conversation: Send, explicit Save/Discard, hardware Back/edge gesture,
  unsent text, pending save, repeated modal transitions and rapid taps; verify
  discard leaves no server conversation/memory/Garden write.
- Memory: explicit creation, lost-response retry with same frozen UUID/payload,
  edit then retry, forget then retry, switch owner during embed/write; check
  one row/provenance/unlock and no resurrection.
- Toggle airplane mode during reads/writes; restore network; visible failure and
  explicit retry with no automatic duplicate or silent Demo fallback.
- Self-care timer: background/foreground, screen lock, fractional timing,
  paused pending acknowledgement and explicit completion; Quiet Room requires
  Continue after interruption. Notification-drawer blur is not an AppState test.
- Vietnamese keyboard/composition, newline, scroll/input visibility, Back to
  dismiss IME; rapid taps, cancel gestures and repeated sheets.
- Set device font size to 200%; enable TalkBack, navigate focus/labels/modals;
  check light/dark/reduced-motion behavior; record limits on each OS.
- Logout and switch accounts with work pending; re-login; export/delete account
  using synthetic data; verify server cascade, rejected old token, cleared local
  drafts/caches and no access by the next owner.

Physical Android QA, Connected APK installation, cold start, and every flow
above remain unverified. Browser E2E does not substitute for these results.

## Completed recovery verification

Recovery code commit: `b9772aae23c8183f61c337dd5b5fc7f897b8b7b6`,
[Draft PR #18](https://github.com/MumeiLevina/mobileapp/pull/18), targeting #16's
feature branch. Later evidence-only commits do not alter application code.
The evaluation checkout had only tracked E2E screenshots modified; no source
changes were pending. Screenshots were preserved and excluded from commits.

- Typecheck and lint: exit 0.
- Final root Jest: **280 passed / 85 intentionally skipped**, 27 passing suites,
  2 skipped suites. New tests cover key leakage/project mismatch, stale staging
  schema and provider-runner false success/disabled/skipped/error behavior.
- Mobile Jest: **129/129**, 34 suites; offline safety **79/79**; local
  SQL/PGlite **23 checks**; API build exit 0.
- Browser E2E: **21/21**, 40.1 seconds, explicit Demo web configuration with
  empty Connected values. This verifies browser regressions only.
- Real provider repeat through the new runner at recovery code commit: **57/57,
  no fail/skip**, actual Jest exit 0, complete metrics, 68 successful provider
  request events, no provider errors/timeouts/malformed output/rate limits.
  Classification and guard totals matched the first corrected run above,
  including **7/13 fallback** and **0/13 accepted policy violations**.
- Compiled local API: `/health` 200 `{"status":"ok"}`; `/profile` 401 without
  credentials. Synthetic dependency configuration was not contacted.
- Fresh fixture-only Expo Android prebuild: exit 0. Gradle 9.3.1 with JDK
  17.0.20.101 and isolated writable cache: `:app:assembleRelease --dry-run`
  exit 0 after switching the init script to Android's `finalizeDsl` hook.
  A separate actual `:app:signingReport` exited 0 and showed release config
  `moriConnectedRelease`, alias `fixture-only`, not the debug config. No APK
  compilation occurred; the short-lived fixture certificate is not the owner's
  release signing identity. Generated min/compile/target SDK: **24/36/36**,
  Build Tools **36.0.0**, NDK **27.1.12297006**. Final APK values remain unverified.
- The default existing Gradle wrapper cache also had access-denied lock errors;
  using a separate cache resolved that prerequisite without changing its ACLs.
- Staged diff whitespace and credential-value scans passed before commit.

Sanitized counts and current P0 decisions are attached to the
[release evidence tracker in PR #17](https://github.com/MumeiLevina/mobileapp/pull/17).
Full clean-integration regression, hosted-schema/provider parity, release
signing, actual APK and device QA remain required before final RC sign-off.
