import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  readLiveConfig,
} = require("../apps/api/dist/apps/api/src/modules/live/live.config.js");
const {
  createPublicLiveApplication,
} = require("../apps/api/dist/apps/api/src/modules/live/live.module.js");
const {
  MoriLiveBridge,
  simulatedTurn,
} = require("../apps/live-desktop/dist/bridge/client.js");

const directory = mkdtempSync(join(tmpdir(), "mori-public-smoke-"));
const token = randomBytes(32).toString("hex");
const config = readLiveConfig({
  MORI_LIVE_MODE: "MOCK",
  MORI_LIVE_API_TOKEN: token,
  MORI_LIVE_STORE_DIR: directory,
});
let app;
try {
  app = await createPublicLiveApplication(config);
  await app.listen(0, "127.0.0.1");
  let client = new MoriLiveBridge({
    url: await app.getUrl(),
    token,
    expectedMode: "MOCK",
  });
  const session = await client.createSession();
  const request = simulatedTurn(session.sessionId, "Xin chào Mori");
  const response = await client.turn(request);
  assert.equal(response.status, "approved");
  assert.equal(response.trainingEligibility, "prohibited");
  await app.close();
  app = await createPublicLiveApplication(config);
  await app.listen(0, "127.0.0.1");
  client = new MoriLiveBridge({
    url: await app.getUrl(),
    token,
    expectedMode: "MOCK",
  });
  const replay = await client.turn({ ...request, requestId: randomUUID() });
  assert.equal(replay.eventId, response.eventId);
  assert.equal(
    (await client.cancel(session.sessionId, request.turnId)).status,
    "cancelled",
  );
  assert.equal((await client.turn(request)).status, "cancelled");
  console.log(
    "Public Nest API MOCK: bridge roundtrip, persisted replay after restart and cancellation PASS.",
  );
} finally {
  if (app) await app.close();
  rmSync(directory, { recursive: true, force: true });
}
