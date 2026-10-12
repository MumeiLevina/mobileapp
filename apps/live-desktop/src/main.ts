import { createMockBridge } from "./bridge/mock-server";

if (
  (process.env.MORI_LIVE_MODE ?? "MOCK") !== "MOCK" ||
  process.env.NODE_ENV === "production"
) {
  throw new Error(
    "The Milestone A fixture supports MOCK development mode only",
  );
}
const port = Number(process.env.MORI_LIVE_PORT ?? 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid bridge port");
const server = createMockBridge({
  token: process.env.MORI_LIVE_BRIDGE_TOKEN ?? "",
});
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    JSON.stringify({ event: "live_bridge_started", mode: "MOCK", port }) + "\n",
  );
});
server.on("error", () => {
  process.stderr.write("Live mock bridge could not start\n");
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
