# Mori — post-PR #20 recovery and Android preparation

Date: 2026-11-05, Asia/Saigon. Reviewed application candidate:
`46dda0e1c483b2fc511846ac1bed86b4ab8a864f`, [Draft PR #20](https://github.com/MumeiLevina/mobileapp/pull/20).
Decision: **NO-GO**. This preparation does not authorize merges, hosted writes,
deployment, signing, paid provider calls or distribution.

## Merge plan — owner approval required

Review #16 once, including #15 ancestry, then #18, #19 and #20. After each
approved integration, reassess/retarget the next PR to the integration branch
and verify its new diff and CI before merging. No PR was retargeted here.
Prefer preserving the existing ancestry; if the owner requires squash/rebase,
rebuild the dependent stack and rerun CI instead of assuming current SHAs remain
valid. Review #17 independently; its three files already match #20 exactly.
Choose one documentation integration path and mark the other superseded only
with owner approval. Do not merge #15 separately or add duplicate documents.

## VERIFIED

- Rechecked #16 → #18 → #19 → #20: unchanged heads, all Draft/open/unmerged,
  each exact-head CI successful. #15 is already in #16 ancestry. #17 contains
  three documentation files already copied identically into #20.
- Public probe on 05/11 at approximately 04:15 Asia/Saigon: Google/Cloudflare
  DoH return NXDOMAIN for `fzptgnoxbfnfgvhpkzsv.supabase.co`; system resolver and
  Auth HTTPS fail ENOTFOUND. This does not distinguish pause, deletion, wrong
  reference or incident.
- Render `/health`, `/api/health`, `/` return 404; `/profile`, `/moods`,
  `/journals`, `/memories`, `/conversations` return 401 without credentials.
  No authenticated route or paid AI request was invoked.
- Source has public `HealthController` in `AppModule`, no global prefix,
  `GET /health` → 200 `{"status":"ok"}`. `render.yaml` uses
  `npm ci && npm run build:api`, `npm run start -w @mori/api`, `/health`, Node 24,
  `MOCK_AI=false`, auto-deploy off. The Blueprint name `mori-api-staging`
  does not prove it identifies `mori-api-qygo.onrender.com`.
- Android SDK/platform/build-tools 36 and aapt/apksigner/adb are installed;
  JDK 17 is available. AVD `test` exists; WHPX acceleration check returns 0.
  A configured AVD is not a booted OS or a physical phone.

## FIXED / PREPARED

No application bug or regression beyond #20 was established in this task;
application/runtime source, migrations and signing identities remain unchanged.
New preparation tools:

- `node scripts/check-connected-android.mjs`: offline inspection of Connected
  config, package/version, blocked permissions, SDK, existing non-debug signing
  environment and trusted certificate fingerprint. It never prebuilds/signs,
  reads user data or contacts Supabase/Render/LLM. Exit 1 means BLOCKED. Even an
  exit 0 means local prerequisites only, not backend health or build approval.
- `scripts/staging-memory-audit.sql`: read-only catalog audit of Memory schema,
  RLS, unique indexes, effective table/RPC grants, SECURITY DEFINER/search path
  and deletion foreign keys. No application rows are selected. The SQL is also
  exercised by the local PGlite suite; this does not certify hosted grants.
- `docs/evidence/migration-manifest-20261105.json`: SHA-256 of the 16 canonical
  migration blobs at the application candidate. A ledger version match alone
  does not prove applied SQL or live schema matches these files.

## BLOCKED

Supabase Dashboard/organization/project state and hosted migration ledger are
unavailable. Previous CLI management listing failed on the local telemetry-file
ACL; no token or filesystem permission was changed to bypass it. Browser access
was previously blocked and no Dashboard session has become available.
Render service ID/current deploy ID/SHA/live settings are unknown. The local
signing environment and a trusted owner certificate fingerprint are not supplied.
No Connected APK was built, installed or claimed.

## Supabase: three recovery branches

First record organization, project ref, region, owner, exact Dashboard URL,
status, backup availability and whether this is **isolated staging**. Stop before
mutations if any identity/isolation answer is unknown. Record metadata only.

| Dashboard finding          | Checklist and stop point                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paused                     | Confirm the existing ref and pause date, available Resume/Restore action and backup state. Owner approves resuming that project. After the owner resumes it, wait for active/healthy state; recheck DNS/Auth, project URL, Auth settings and migration ledger. Do not replay initial migrations or replace keys by assumption.                                                                                                           |
| Active, endpoint failing   | Copy the actual project URL from Connect/settings; compare ref with all build/API settings. Check project/service health and the provider's incident status, then system DNS plus independent DoH. Record UTC/local timestamp and HTTP/error codes. If the verified endpoint still fails, use Dashboard support with sanitized ref/status evidence; no reset, pause/unpause cycling or credential rotation as a guessed fix.             |
| Deleted or not recoverable | Establish the actual Dashboard/support finding. Deleted projects cannot be restored by the normal resume flow. Inventory existing owner-controlled exports/backups and Auth/storage implications. Prepare an isolated staging replacement or backup-restoration proposal with source, target, cost and data scope. Obtain explicit approval before creating/restoring anything or updating endpoints. Never repoint production silently. |

Paused-project restore availability must be checked against the current
[Supabase pausing guidance](https://supabase.com/docs/guides/platform/free-project-pausing)
and actual Dashboard state. Permanent deletion is a different condition:
[Supabase deletion guidance](https://supabase.com/docs/guides/platform/delete-project).

### After identity and connectivity are confirmed: read-only migration review

Use a checkout at the reviewed SHA. In a local secure shell, load connection
settings from the Dashboard into PostgreSQL environment variables or a private
pgpass file. Do not place database URLs/passwords in command arguments or logs.

```powershell
# Uses locally supplied PGHOST, PGPORT, PGDATABASE, PGUSER and secure password source.
psql -X --set=ON_ERROR_STOP=1 --file scripts/staging-memory-audit.sql
if ($LASTEXITCODE -ne 0) { throw 'Read-only schema audit failed' }
```

In the SQL Editor, after the audit confirms the migration ledger exists:

```sql
begin read only;
select version, name from supabase_migrations.schema_migrations order by version;
rollback;
```

If a CLI checkout is already linked to the independently confirmed ref,
`supabase migration list --linked` lists local/remote history. Verify the local
`supabase/.temp/project-ref` first. See the
[CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-list).
Do not use migration repair, database reset or db push to make history look green.

Expected Memory audit results: both tables exist and have RLS enabled;
`memories.client_id` is nullable UUID; owner/client unique identity exists;
request user/client primary key exists; anon/authenticated have no request-table
SELECT/INSERT/UPDATE/DELETE or RPC EXECUTE; service_role has these privileges;
RPC is SECURITY DEFINER with empty search_path; request user deletion cascades
and memory deletion sets its memory_id to NULL. Inspect existing memories RLS
policies as well. FORCE RLS is not required for the service-owned definer RPC.
Empty query results are missing evidence, not PASS.

### Memory compatibility decision

| Combination                            | Expected behavior / approval                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Old API + additive new schema          | Existing inserts may retain NULL client_id; do not assume new idempotency for old calls. Preserve data and verify the actual old version in staging.                                                   |
| New API + old schema                   | Unsupported; RPC/column/table missing. Reviewed migration must precede API rollout.                                                                                                                    |
| Old mobile missing client_id + new API | Manual Memory POST fails validation (400). Owner must approve a coordinated minimum-client rollout or separately reviewed compatibility strategy.                                                      |
| New mobile + new API + new schema      | Frozen UUID/payload explicit retries; same owner/UUID returns original Memory, changed payload fails, forgotten Memory cannot resurrect. Hosted concurrency and account isolation still need evidence. |

Do not add random UUIDs on each retry or weaken consent/idempotency to hide old
client failures. Rollback retains additive columns, requests and tombstones;
use a compatible API/client version. Never delete the request ledger as rollback.

### After explicit approval for synthetic staging writes: Auth/RLS without LLM

Prepare a private ignored env file with only `STAGING_TARGET=staging`, the
verified `SUPABASE_INTEGRATION_URL`, anon and service-role settings. Independently
confirm that ref; the test's production-looking hostname check is not proof of
staging isolation. This suite creates two synthetic users/rows and deletes them.
It invokes Supabase directly and does not require an LLM key or a running API.

```powershell
$env:RUN_SUPABASE_INTEGRATION_TESTS = 'true'
$env:RUN_PROVIDER_SAFETY_EVALS = 'false'
node --env-file=C:/secure/mori-staging-rls.env node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/supabase.integration.test.ts
if ($LASTEXITCODE -ne 0) { throw 'Hosted Auth/RLS suite failed' }
```

Record actual passed/failed/skipped counts and cleanup. The suite checks signup,
provisioning, login/refresh, JWT subject, cross-owner reads, server-written
permissions and account cascade. Its admin confirmation does not verify real
email delivery or the public signup-confirmation experience. Separately verify
new Memory RPC denial for anon/authenticated, service-only sequential and
parallel same-UUID calls, changed payload, edited/forgotten retries and tombstone
account cascade using fixed 1536-dimensional synthetic vectors. This can be
performed directly in PostgreSQL/PostgREST without buying embeddings; it does
not certify the actual API/embedding provider. Use two independent connections
for overlap/concurrency, not PGlite's single connection.

**Do not run `npm run verify:staging` or `npm run eval:safety:staging` under the
current no-paid-API instruction.** The former sends a private chat and direct
provider text/structured/embedding requests, plus creates/deletes users. A
passing config preflight is not permission to run it.

## Render: identity, deploy plan and rollback

1. Owner opens the service whose displayed URL exactly matches
   `https://mori-api-qygo.onrender.com`. Record workspace/service ID, repository,
   branch, root directory, build/start commands and health path. The monorepo
   commands above expect the repository root, not apps/api as root directory.
2. From Deploys, open the active successful deploy and record deploy ID, full
   commit SHA and timestamp. Compare with the reviewed candidate. Record a
   prior successful compatible deploy ID/SHA for rollback. Do not infer SHA from
   a 401 or health response. [Render deployment docs](https://render.com/docs/deploys).
3. Review secret **names/presence and target identity locally**: Supabase URL/
   anon/service-role, CORS, NODE_ENV=production, MOCK_AI=false, provider model/
   timeouts. No values should enter chat/GitHub. Existing health is liveness,
   not a DB/provider readiness test. Do not change settings in this task.
4. Once staging identity, migration and old-client compatibility are signed off,
   obtain explicit approval for Manual Deploy → Deploy a specific commit,
   using `46dda0e1c483b2fc511846ac1bed86b4ab8a864f` (or a separately approved
   replacement). Never use “latest” as a substitute. Record actual resulting
   deploy SHA and keep auto-deploy off. Do not deploy this preparation branch
   merely because it contains tooling.
5. Public, no-cost smoke after an approved deploy: GET `/health` must be 200 with
   status=ok, no redirects; unauthenticated protected routes must be 401.
   Reuse the recorded public probe; it must not send bearer keys or chat writes.
   Hosted Auth/RLS above is a separate gate. Real chat/manual Memory/embeddings
   remain NOT RUN while paid-provider permission is withheld.

Rollback plan (requires owner approval before execution): stop distributing the
candidate; capture sanitized failure/deploy IDs; choose the recorded compatible
successful deploy and perform Dashboard Rollback. Check current env groups and
secret versions as well as code—rollback does not universally restore all
configuration. Keep additive DB schema/tombstones. Recheck deploy SHA, health
and protected-route smoke, then approved Auth/RLS verification. Do not enable
MOCK_AI or change to Demo to make smoke pass. Dashboard and API/CLI differ in
auto-deploy behavior; verify it explicitly after rollback. See
[Render rollback configuration behavior](https://render.com/docs/rollbacks).
This plan has not been rehearsed against a hosted service.

## Android: local readiness and artifact verification

Load **public Connected build settings only** into the build shell: preview,
Demo=false, reviewed EAS project UUID, HTTPS API/Supabase URL and public key.
Set `MORI_EXPECTED_SUPABASE_REF` to the ref confirmed by the owner; this local
check cannot prove staging isolation. Set ANDROID_HOME/JAVA_HOME for SDK 36/JDK17.
Load existing owner signing settings through a local secret manager:
MORI_ANDROID_KEYSTORE (absolute path), MORI_ANDROID_KEY_ALIAS,
MORI_ANDROID_STORE_PASSWORD, MORI_ANDROID_KEY_PASSWORD and the independently
trusted MORI_ANDROID_EXPECTED_CERT_SHA256. Never generate a replacement identity
or paste the keystore/passwords into chat.

```powershell
node scripts/check-connected-android.mjs
if ($LASTEXITCODE -ne 0) { throw 'Connected local prerequisites remain blocked' }
```

Current identity is `app.mori.companion`, version `0.1.0`, configured versionCode
`1`. Owner must compare previous distributions before choosing the next code;
direct Gradle does not use EAS remote auto-increment. No speculative version bump.
After target/backend/rollout/build approval and successful local check, use the
existing Windows prebuild + Gradle instructions in
[the recovery runbook](CONNECTED_STAGING_RECOVERY_2026-11-04.md#local-connected-apk-preparation-on-windows).
Always include `scripts/android-connected-release.init.gradle`; plain Expo
generated assembleRelease may use debug signing. No paid EAS build.

For the actual new APK, inspect without installing first:

```powershell
# Set $apk locally to the freshly built absolute app-release.apk path.
$androidTools = Join-Path $env:ANDROID_HOME 'build-tools/36.0.0'
Get-FileHash -LiteralPath $apk -Algorithm SHA256
& "$androidTools/apksigner.bat" verify --verbose --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
& "$androidTools/aapt.exe" dump badging $apk
& "$androidTools/aapt.exe" dump permissions $apk
```

Compare actual certificate SHA-256 with the independently trusted owner value;
inspect package/versionCode, min/target SDK, non-debuggable release and all
permissions. Camera/audio/contacts/location must remain absent. Public endpoint
configuration must match the approved staging project and Demo must be disabled.
An APK hash or a non-debug filename alone does not establish signing identity.

Device preflight: `adb devices -l`; select an explicit serial for every later
command. For USB, owner unlocks the phone and approves that computer's existing
USB-debugging authorization; do not factory reset it. For AVD, an existing
read-only launch with `-no-snapshot` avoids saving userdata/snapshots; do not use
`-wipe-data`, delete lock files or change ACLs. Validate `sys.boot_completed=1`,
model/API/ABI; an API 37 preview AVD does not replace minimum API 24 and a current
stable physical phone. [Android emulator CLI](https://developer.android.com/studio/run/emulator-commandline).
Record safe-launch outcome in the handoff; no Connected native flow is PASS
until the exact verified APK is installed and tested.

This follow-up attempted AVD `test` with `-read-only -no-snapshot -no-window`
and a dedicated port. Boot was not confirmed within 20 seconds: creating
`emu-last-feature-flags.protobuf.lock` repeatedly failed with Windows error 5.
Only the newly launched process tree was stopped; no lock/ACL/userdata/snapshot
was deleted or changed. ADB remained empty. Native execution is BLOCKED until
the owner runs the AVD under its owning Windows account or authorizes a USB phone.

## NEEDS OWNER APPROVAL / short action checklist

| Surface                     | Owner action / metadata to record                                                                                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Dashboard          | Correct organization → ref fzptgnoxbfnfgvhpkzsv → status/region/URL/backup and isolated-staging confirmation. Approve the appropriate recovery branch; after read-only ledger review approve only missing migrations and the old-client rollout decision.                           |
| Render Dashboard            | Match exact public URL/service ID; record active and rollback deploy IDs/full SHAs, branch/root/build/start/health settings and auto-deploy state. Approve exact-SHA staging deployment only after schema/compatibility are ready.                                                  |
| Android signing environment | Use existing trusted release keystore locally; supply the named signing env values and trusted certificate fingerprint through local secret storage. Confirm versionCode against prior distribution, connect/authorize a test device, then approve local build after backend gates. |

Only refs, states, IDs, SHAs and decisions are needed in the handoff. Passwords,
API keys, service-role keys, database URLs with credentials and keystores stay
in local/provider secret storage.

## RELEASE GATES / NEXT ACTIONS

P0-01 source CI is proven for #20; merge approval remains pending. P0-02 staging
is BLOCKED; P0-03 actual provider is NOT RUN by instruction; P0-04 APK is BLOCKED;
P0-05 native QA is NOT RUN; P0-06 privacy/support, P0-07 operations/rollback and
P0-08 distribution remain unverified. Preparation tools do not close these gates.
First unblock Supabase identity/status/isolation, then approved schema and Render
recovery, existing owner signing, Connected APK and native QA. No Public Beta GO.

- `node scripts/probe-connected-readonly.mjs C:/secure/mori-public-smoke.json`:
  fixed-target DNS/HTTPS smoke using credential-free GETs, no redirects, writes
  or provider requests. Exit 1 reports BLOCKED. Its output contains status codes
  only; Supabase 401 means gateway reachability, not a successful Auth check.
