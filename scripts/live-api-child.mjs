// IPC supervisor wrapper around the unchanged PUBLIC_LIVE application.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  createPublicLiveApplication,
} = require("../apps/api/dist/apps/api/src/modules/live/live.module.js");
const {
  readLiveConfig,
} = require("../apps/api/dist/apps/api/src/modules/live/live.config.js");
let app;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app?.close(); // releases writer.lock; never removes public-live.json
  process.exit(0);
}
try {
  const config = readLiveConfig();
  app = await createPublicLiveApplication(config);
  await app.listen(config.MORI_LIVE_API_PORT, "127.0.0.1");
  process.on("message", (message) => {
    if (message === "shutdown") void close();
  });
  process.on("disconnect", () => void close());
  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
  process.send?.("ready");
} catch {
  await app?.close();
  process.stderr.write(
    "PUBLIC_LIVE startup failed; inspect configuration/store ownership.\n",
  );
  process.exit(1);
}
