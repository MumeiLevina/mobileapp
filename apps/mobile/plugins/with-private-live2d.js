const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Copies a previously prepared, private renderer into Android assets.
 * Nothing from this directory is tracked by Git.
 */
module.exports = function withPrivateLive2D(config) {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const source = path.join(projectRoot, ".live2d-private", "dist");
      const target = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "assets",
        "live2d",
      );
      const marker = path.join(source, "renderer-manifest.json");
      if (!fs.existsSync(marker)) {
        throw new Error(
          "Private Live2D renderer is missing. Run `npm run live2d:prepare` from the repository root first.",
        );
      }
      fs.rmSync(target, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(source, target, { recursive: true });
      return modConfig;
    },
  ]);
};
