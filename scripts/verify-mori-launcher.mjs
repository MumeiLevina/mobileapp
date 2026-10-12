import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, readFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

async function port() {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const result = server.address().port;
  await new Promise((r) => server.close(r));
  return result;
}
const store = await mkdtemp(join(tmpdir(), "mori-launcher-test-"));
const apiPort = await port();
const desktopPort = await port();
const child = fork(resolve(import.meta.dirname, "start-mori-live.mjs"), [], {
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe", "ipc"],
  env: {
    ...process.env,
    NODE_ENV: "test",
    MORI_LIVE_MODE: "MOCK",
    MORI_TTS_PROVIDER: "azure",
    MORI_TTS_KEY: "",
    MORI_TTS_REGION: "",
    MORI_LIVE_STORE_DIR: store,
    MORI_LIVE_API_PORT: String(apiPort),
    MORI_LIVE_DESKTOP_PORT: String(desktopPort),
    MORI_LIVE_API_URL: `http://127.0.0.1:${apiPort}/v1/live`,
    MORI_LIVE_API_TOKEN: randomBytes(32).toString("hex"),
    MORI_LIVE_OPERATOR_TOKEN: randomBytes(32).toString("hex"),
  },
});
let startupOutput = "";
try {
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Launcher startup timeout")),
      30000,
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Launcher exited ${code}`));
    });
    child.stdout.on("data", (chunk) => {
      startupOutput += chunk.toString();
      if (startupOutput.includes("mori_python_started")) {
        clearTimeout(timeout);
        resolveReady();
      }
    });
  });
  assert.ok(startupOutput.includes("tts_mock_fallback"));
  const exited = new Promise((r) => child.once("exit", r));
  child.send("shutdown");
  assert.equal(await exited, 0);
  await assert.rejects(access(join(store, "writer.lock")));
  const saved = JSON.parse(
    await readFile(join(store, "public-live.json"), "utf8"),
  );
  assert.equal(saved.spentMicros, 0);
  console.log(
    "Azure credentials absent: explicit MOCK fallback verified. Supervisor shutdown preserved public store and released writer.lock.",
  );
} finally {
  if (child.exitCode === null) {
    child.kill();
    await new Promise((r) => child.once("exit", r));
  }
  // Explicit temporary synthetic test store only, never the operator repository.
  await rm(store, { recursive: true, force: true });
}
