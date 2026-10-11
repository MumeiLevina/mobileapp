import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const python = resolve(root, ".mori-live/upstream/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const commands = {
  serve: ["apps/live-desktop/python/launch.py"],
  test: ["-m", "unittest", "discover", "-s", "apps/live-desktop/python/tests", "-v"],
  lint: ["-m", "ruff", "check", "apps/live-desktop/python"],
};
const args = commands[process.argv[2]];
if (!args || !existsSync(python)) {
  console.error("Run scripts/setup-mori-live.ps1 -SyncPython first. Command: serve|test|lint.");
  process.exit(1);
}
const result = spawnSync(python, args, { cwd: root, env: process.env, windowsHide: true, stdio: "inherit" });
process.exitCode = result.status ?? 1;
