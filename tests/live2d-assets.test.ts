import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("private Live2D preparation fails closed when assets are missing", () => {
  const script = resolve(process.cwd(), "scripts", "prepare-live2d.mjs");
  const missing = resolve(process.cwd(), ".definitely-missing-live2d-assets");
  const result = spawnSync(process.execPath, [script, missing], {
    encoding: "utf8",
  });

  expect(result.status).not.toBe(0);
  expect(`${result.stdout}${result.stderr}`).toContain(
    "Required private Live2D input is missing",
  );
});
