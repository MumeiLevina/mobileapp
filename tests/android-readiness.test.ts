import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function check(mode: string) {
  const script = `import { checkConnectedAndroid } from ${JSON.stringify(pathToFileURL(resolve("scripts/check-connected-android.mjs")).href)};
    const mode = process.argv[1];
    const calls = [];
    const env = { EAS_BUILD_PROFILE:'preview', EXPO_PUBLIC_DEMO_MODE:'false',
      MORI_EXPECTED_SUPABASE_REF:'fzptgnoxbfnfgvhpkzsv', EXPO_PUBLIC_SUPABASE_URL:'https://fzptgnoxbfnfgvhpkzsv.supabase.co',
      ANDROID_HOME:'C:/synthetic-sdk', MORI_ANDROID_KEYSTORE:${JSON.stringify(resolve("synthetic-owner.jks"))}, MORI_ANDROID_KEY_ALIAS:'owner',
      MORI_ANDROID_STORE_PASSWORD:'private-store-value', MORI_ANDROID_KEY_PASSWORD:'private-key-value',
      MORI_ANDROID_EXPECTED_CERT_SHA256:'AB'.repeat(32) };
    if (mode === 'missing-signing') delete env.MORI_ANDROID_KEYSTORE;
    if (mode === 'missing-fingerprint') delete env.MORI_ANDROID_EXPECTED_CERT_SHA256;
    if (mode === 'demo') env.EXPO_PUBLIC_DEMO_MODE='true';
    if (mode === 'wrong-project') env.EXPO_PUBLIC_SUPABASE_URL='https://another.supabase.co';
    if (mode === 'debug') env.MORI_ANDROID_KEY_ALIAS='androiddebugkey';
    const result = checkConnectedAndroid(env, {exists:()=>true, run:(command,args,options)=>{
      calls.push({command,args});
      if (command === process.execPath) return {status: mode==='bad-config'?1:0, stdout: JSON.stringify({package:'app.mori.companion',version:'0.1.0',versionCode:1,environment:'preview',blockedPermissions:['RECORD_AUDIO','CAMERA','READ_CONTACTS','WRITE_CONTACTS','GET_ACCOUNTS','ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION','ACCESS_BACKGROUND_LOCATION'].map(x=>'android.permission.'+x)})};
      return {status:0,stdout:'Entry type: '+(mode==='certificate-only'?'trustedCertEntry':'PrivateKeyEntry')+'\\nSHA256: '+(mode==='wrong-certificate'?'CD':'AB').repeat(32)};
    }});
    console.log(JSON.stringify({result,calls}));`;
  const run = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script, mode],
    { encoding: "utf8" },
  );
  expect(run.status).toBe(0);
  expect(`${run.stdout}${run.stderr}`).not.toMatch(
    /private-store-value|private-key-value/,
  );
  return JSON.parse(run.stdout);
}

test("local readiness inspects the existing certificate using an env password and never authorizes a build", () => {
  const { result, calls } = check("pass");
  expect(result).toMatchObject({
    status: "LOCAL_PREREQUISITES_VERIFIED",
    backendVerified: false,
    finalApkVerified: false,
    buildAuthorized: false,
  });
  expect(calls).toHaveLength(2);
  expect(calls[1].args).toContain("-storepass:env");
  expect(calls[1].args).not.toContain("-genkeypair");
});

test.each([
  "missing-signing",
  "missing-fingerprint",
  "demo",
  "wrong-project",
  "debug",
  "bad-config",
  "wrong-certificate",
  "certificate-only",
])("blocks unsafe or incomplete preparation: %s", (mode) => {
  expect(check(mode).result.status).toBe("BLOCKED");
});
