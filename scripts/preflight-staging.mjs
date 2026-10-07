const required = [
  "STAGING_TARGET",
  "STAGING_API_URL",
  "SUPABASE_INTEGRATION_URL",
  "SUPABASE_INTEGRATION_ANON_KEY",
  "SUPABASE_INTEGRATION_SERVICE_ROLE_KEY",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_EMBEDDING_MODEL",
  "LLM_TEXT_TIMEOUT_MS",
  "LLM_CLASSIFICATION_TIMEOUT_MS",
  "LLM_EMBEDDING_TIMEOUT_MS",
  "EXPO_PUBLIC_DEMO_MODE",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
];

const remoteUrls = [
  "STAGING_API_URL",
  "SUPABASE_INTEGRATION_URL",
  "LLM_BASE_URL",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
];

const timeouts = [
  "LLM_TEXT_TIMEOUT_MS",
  "LLM_CLASSIFICATION_TIMEOUT_MS",
  "LLM_EMBEDDING_TIMEOUT_MS",
];

function normalizedUrl(value) {
  return value.replace(/\/$/, "");
}

function jwtRole(value) {
  try {
    const payload = value.split(".")[1];
    if (!payload) return undefined;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role;
  } catch {
    return undefined;
  }
}

export function validateStagingConfig(env) {
  const errors = [];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length)
    errors.push(`missing required variables: ${missing.join(", ")}`);

  if (!["development", "staging"].includes(env.STAGING_TARGET ?? ""))
    errors.push("STAGING_TARGET must be development or staging");
  if (env.MOCK_AI !== undefined && env.MOCK_AI !== "false")
    errors.push("MOCK_AI must be false for staging verification");
  if (
    env.EXPO_PUBLIC_DEMO_MODE !== undefined &&
    env.EXPO_PUBLIC_DEMO_MODE !== "false"
  )
    errors.push("EXPO_PUBLIC_DEMO_MODE must be false for preview builds");
  if (
    env.RUN_SUPABASE_INTEGRATION_TESTS !== undefined &&
    env.RUN_SUPABASE_INTEGRATION_TESTS !== "true"
  )
    errors.push("RUN_SUPABASE_INTEGRATION_TESTS must be true when supplied");
  if (
    env.RUN_PROVIDER_SAFETY_EVALS !== undefined &&
    env.RUN_PROVIDER_SAFETY_EVALS !== "true"
  )
    errors.push("RUN_PROVIDER_SAFETY_EVALS must be true when supplied");

  for (const name of remoteUrls) {
    if (!env[name]) continue;
    try {
      const url = new URL(env[name]);
      if (url.protocol !== "https:") errors.push(`${name} must use HTTPS`);
      if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname))
        errors.push(`${name} cannot point to localhost`);
      if (
        name !== "LLM_BASE_URL" &&
        /(^|[.-])(prod|production|live)([.-]|$)/i.test(url.hostname)
      )
        errors.push(`${name} looks like a production target`);
    } catch {
      errors.push(`${name} must be a valid URL`);
    }
  }

  for (const name of timeouts) {
    if (!env[name]) continue;
    const value = Number(env[name]);
    if (!Number.isInteger(value) || value < 1_000 || value > 120_000)
      errors.push(`${name} must be an integer from 1000 to 120000`);
  }

  if (
    env.STAGING_API_URL &&
    env.EXPO_PUBLIC_API_URL &&
    normalizedUrl(env.STAGING_API_URL) !==
      normalizedUrl(env.EXPO_PUBLIC_API_URL)
  )
    errors.push("EXPO_PUBLIC_API_URL must match STAGING_API_URL");
  if (
    env.SUPABASE_INTEGRATION_URL &&
    env.EXPO_PUBLIC_SUPABASE_URL &&
    normalizedUrl(env.SUPABASE_INTEGRATION_URL) !==
      normalizedUrl(env.EXPO_PUBLIC_SUPABASE_URL)
  )
    errors.push("EXPO_PUBLIC_SUPABASE_URL must match SUPABASE_INTEGRATION_URL");
  if (
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
    (env.EXPO_PUBLIC_SUPABASE_ANON_KEY ===
      env.SUPABASE_INTEGRATION_SERVICE_ROLE_KEY ||
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY === env.LLM_API_KEY)
  )
    errors.push("a private server credential was placed in a public variable");
  if (jwtRole(env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "") === "service_role")
    errors.push("EXPO_PUBLIC_SUPABASE_ANON_KEY contains a service-role token");

  return errors;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = validateStagingConfig(process.env);
  if (errors.length) {
    console.error("FAIL staging preflight");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("PASS staging preflight: configuration is present and safe");
    console.log(
      "No network requests were made and no secret values were printed.",
    );
  }
}
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
