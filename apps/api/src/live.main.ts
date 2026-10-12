import { createPublicLiveApplication } from "./modules/live/live.module";
import { readLiveConfig } from "./modules/live/live.config";

async function main() {
  const config = readLiveConfig();
  const app = await createPublicLiveApplication(config);
  try {
    app.enableShutdownHooks();
    await app.listen(config.MORI_LIVE_API_PORT, "127.0.0.1");
  } catch (error) {
    await app.close();
    throw error;
  }
  process.stdout.write(
    JSON.stringify({
      event: "public_live_api_started",
      mode: config.MORI_LIVE_MODE,
      port: config.MORI_LIVE_API_PORT,
    }) + "\n",
  );
}
main().catch(() => {
  process.stderr.write(
    "Public Live API startup failed; check configuration and public store lock.\n",
  );
  process.exitCode = 1;
});
