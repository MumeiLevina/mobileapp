import { fork, spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const api = fork(resolve(root, "scripts/live-api-child.mjs"), [], { cwd: root, env: process.env, windowsHide: true, stdio: ["ignore", "inherit", "inherit", "ipc"] });
let python;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  python?.kill();
  if (api.connected) api.send("shutdown");
  if (api.exitCode === null) {
    await new Promise((r) => api.once("exit", r));
  }
  process.exitCode = code;
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
process.on("message", (message) => { if (message === "shutdown") void stop(); });
api.once("error", () => void stop(1));
api.once("exit", () => { if (!stopping) { python?.kill(); process.exitCode = 1; } });
api.once("message", (message) => {
  if (message !== "ready" || stopping) return;
  python = spawn(resolve(root, ".mori-live/upstream/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"), ["apps/live-desktop/python/launch.py"], { cwd: root, env: process.env, windowsHide: true, stdio: "inherit" });
  python.once("error", () => void stop(1));
  python.once("exit", (code) => void stop(code ?? 0));
});
