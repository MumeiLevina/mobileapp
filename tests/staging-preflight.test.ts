import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const script = resolve("scripts/preflight-staging.mjs");
const safe = {
  STAGING_TARGET: "staging",
  STAGING_API_URL: "https://staging-api.example.test",
  SUPABASE_INTEGRATION_URL: "https://staging-project.supabase.co",
  SUPABASE_INTEGRATION_ANON_KEY: "public-anon-test-value",
  SUPABASE_INTEGRATION_SERVICE_ROLE_KEY: "private-service-test-value",
  LLM_BASE_URL: "https://provider.example.test/v1",
  LLM_API_KEY: "private-llm-test-value",
  LLM_MODEL: "staging-text-model",
  LLM_EMBEDDING_MODEL: "staging-embedding-model",
  LLM_TEXT_TIMEOUT_MS: "30000",
  LLM_CLASSIFICATION_TIMEOUT_MS: "10000",
  LLM_EMBEDDING_TIMEOUT_MS: "10000",
  MOCK_AI: "false",
  RUN_SUPABASE_INTEGRATION_TESTS: "true",
  RUN_PROVIDER_SAFETY_EVALS: "true",
  EXPO_PUBLIC_DEMO_MODE: "false",
  EXPO_PUBLIC_API_URL: "https://staging-api.example.test",
  EXPO_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-anon-test-value",
};

function run(overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...safe, ...overrides };
  for (const [key, value] of Object.entries(env))
    if (value === undefined) delete env[key];
  return spawnSync(process.execPath, [script], {
    cwd: resolve("."),
    env,
    encoding: "utf8",
  });
}

test("staging preflight validates configuration without printing secrets", () => {
  const result = run();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("PASS staging preflight");
  expect(`${result.stdout}${result.stderr}`).not.toContain(
    "private-llm-test-value",
  );
  expect(`${result.stdout}${result.stderr}`).not.toContain(
    "private-service-test-value",
  );
});

test("staging preflight rejects missing and unsafe configuration", () => {
  const missing = run({ LLM_API_KEY: undefined });
  expect(missing.status).toBe(1);
  expect(missing.stderr).toContain("LLM_API_KEY");

  const production = run({
    STAGING_TARGET: "production",
    STAGING_API_URL: "https://api.production.example.test",
    EXPO_PUBLIC_API_URL: "https://api.production.example.test",
  });
  expect(production.status).toBe(1);
  expect(production.stderr).toMatch(/production|STAGING_TARGET/);
});

test("staging preflight rejects private credentials in mobile variables", () => {
  const result = run({
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "private-service-test-value",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("private server credential");
});
