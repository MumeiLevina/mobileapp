import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const cli = require.resolve("expo/bin/cli");
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: resolve("apps/mobile"),
  stdio: "inherit",
  env: {
    ...process.env,
    EXPO_NO_TELEMETRY: "1",
    __UNSAFE_EXPO_HOME_DIRECTORY: resolve(".expo-home"),
  },
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
