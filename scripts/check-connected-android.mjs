import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const normalizeFingerprint = (value) =>
  (value ?? "").replaceAll(":", "").trim().toUpperCase();

// Local inspection only: never prebuild, sign, deploy, contact services or read
// keystore passwords from arguments. Do not echo child output (it can contain DN
// information, invalid URLs, or other private configuration).
export function checkConnectedAndroid(env = process.env, io = {}) {
  const exists = io.exists ?? existsSync;
  const run = io.run ?? spawnSync;
  const checks = [];
  const check = (name, passed) =>
    checks.push({ name, status: passed ? "PASS" : "BLOCKED" });
  check(
    "explicit Connected preview",
    env.EAS_BUILD_PROFILE === "preview" &&
      env.EXPO_PUBLIC_DEMO_MODE === "false",
  );
  const configRun = run(
    process.execPath,
    [
      "-e",
      `try {
    const c = require('./apps/mobile/app.config.js')();
    console.log(JSON.stringify({ package: c.android.package, version: c.version,
      versionCode: c.android.versionCode, environment: c.extra.environment,
      blockedPermissions: c.android.blockedPermissions }));
  } catch { process.exitCode = 1; }`,
    ],
    { cwd: root, env, encoding: "utf8", timeout: 15000 },
  );
  let config;
  try {
    config = JSON.parse(configRun.stdout);
  } catch {
    /* Rejected config stays blocked. */
  }
  check(
    "Expo Connected config",
    configRun.status === 0 && config?.environment === "preview",
  );
  check(
    "package and configured version",
    config?.package === "app.mori.companion" &&
      Number.isInteger(config?.versionCode) &&
      config.versionCode > 0,
  );
  const forbidden = [
    "RECORD_AUDIO",
    "CAMERA",
    "READ_CONTACTS",
    "WRITE_CONTACTS",
    "GET_ACCOUNTS",
    "ACCESS_COARSE_LOCATION",
    "ACCESS_FINE_LOCATION",
    "ACCESS_BACKGROUND_LOCATION",
  ];
  check(
    "sensitive permission exclusions",
    forbidden.every((permission) =>
      config?.blockedPermissions?.includes(`android.permission.${permission}`),
    ),
  );
  const expectedRef = env.MORI_EXPECTED_SUPABASE_REF;
  let matchesProject = false;
  try {
    matchesProject =
      /^[a-z0-9]{20}$/.test(expectedRef ?? "") &&
      new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname ===
        `${expectedRef}.supabase.co`;
  } catch {
    /* Missing/unverified target. */
  }
  check("owner-confirmed Supabase reference matches URL", matchesProject);
  const sdk =
    env.ANDROID_HOME ||
    env.ANDROID_SDK_ROOT ||
    (env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Android", "Sdk"));
  check(
    "Android SDK 36 and binary inspection tools",
    Boolean(sdk) &&
      [
        "platforms/android-36/android.jar",
        "build-tools/36.0.0/aapt.exe",
        "build-tools/36.0.0/apksigner.bat",
        "platform-tools/adb.exe",
      ].every((path) => exists(join(sdk, path))),
  );
  const signingNames = [
    "MORI_ANDROID_KEYSTORE",
    "MORI_ANDROID_KEY_ALIAS",
    "MORI_ANDROID_STORE_PASSWORD",
    "MORI_ANDROID_KEY_PASSWORD",
  ];
  const signingPresent = signingNames.every((name) => env[name]?.trim());
  check("existing owner signing environment present", signingPresent);
  const keystore = env.MORI_ANDROID_KEYSTORE;
  const ownerPath =
    signingPresent &&
    isAbsolute(keystore) &&
    exists(keystore) &&
    !/(^|[\\/])debug\.keystore$/i.test(keystore) &&
    !/^androiddebugkey$/i.test(env.MORI_ANDROID_KEY_ALIAS);
  check("existing non-debug keystore path and alias", Boolean(ownerPath));
  const expectedFingerprint = normalizeFingerprint(
    env.MORI_ANDROID_EXPECTED_CERT_SHA256,
  );
  const fingerprintPresent = /^[A-F0-9]{64}$/.test(expectedFingerprint);
  check("trusted owner certificate SHA-256 supplied", fingerprintPresent);
  let fingerprintVerified = false;
  if (ownerPath && fingerprintPresent) {
    const keytool = env.JAVA_HOME
      ? join(env.JAVA_HOME, "bin", "keytool.exe")
      : "keytool";
    const inspected = run(
      keytool,
      [
        "-J-Duser.language=en",
        "-list",
        "-v",
        "-keystore",
        keystore,
        "-alias",
        env.MORI_ANDROID_KEY_ALIAS,
        "-storepass:env",
        "MORI_ANDROID_STORE_PASSWORD",
      ],
      { env, encoding: "utf8", timeout: 15000 },
    );
    const actual = inspected.stdout?.match(/SHA256:\s*([\dA-Fa-f:]+)/)?.[1];
    fingerprintVerified =
      inspected.status === 0 &&
      /PrivateKeyEntry/.test(inspected.stdout ?? "") &&
      normalizeFingerprint(actual) === expectedFingerprint;
  }
  check(
    "keystore private-key entry matches trusted certificate",
    fingerprintVerified,
  );
  return {
    status: checks.every((item) => item.status === "PASS")
      ? "LOCAL_PREREQUISITES_VERIFIED"
      : "BLOCKED",
    checks,
    identity: config
      ? {
          package: config.package,
          version: config.version,
          configuredVersionCode: config.versionCode,
        }
      : null,
    backendVerified: false,
    finalApkVerified: false,
    buildAuthorized: false,
    limitations: [
      "No network or build performed",
      "Configured versionCode still needs comparison with prior distribution",
      "Key password is validated by the actual Gradle signing step",
      "Generated/final manifest, certificate and APK hash require artifact inspection",
      "Target isolation and deployment approval remain owner decisions",
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = checkConnectedAndroid();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "BLOCKED" ? 1 : 0;
}
