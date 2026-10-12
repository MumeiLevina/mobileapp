// Boot the existing API with synthetic config only; never read real credentials.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

const child = spawn(process.execPath, ["apps/api/dist/apps/api/src/main.js"], {
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: "43199",
    MOCK_AI: "true",
    SUPABASE_URL: "https://mori-live-startup.invalid",
    SUPABASE_ANON_KEY: "synthetic-startup-only",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-startup-only",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let started = false;
let exited = false;
child.stdout.on("data", (data) => {
  if (data.toString().includes("api_started")) started = true;
});
child.stderr.on("data", () => {});
child.on("exit", () => {
  exited = true;
});
try {
  for (let i = 0; i < 100 && !started && !exited; i++) await delay(100);
  assert.ok(
    started && !exited,
    "Existing API did not start with synthetic config",
  );
  const response = await fetch("http://127.0.0.1:43199/profile", {
    signal: AbortSignal.timeout(3000),
  });
  assert.equal(
    response.status,
    401,
    "Private API must reject unauthenticated access",
  );
  console.log(
    "Existing Nest API startup + unauthenticated route protection: PASS (synthetic config; no Supabase integration).",
  );
} finally {
  child.kill();
}
