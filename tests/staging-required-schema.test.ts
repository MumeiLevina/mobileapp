import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

function probe(failure?: string) {
  const source = `
    import { verifyRequiredSchema } from ${JSON.stringify(pathToFileURL(resolve("scripts/staging-required-schema.mjs")).href)};
    const seen = [];
    const admin = { from(table) { return { select(selection) {
      seen.push([table, selection]);
      return { async limit() {
        if (table === 'memory_creation_requests' && ${JSON.stringify(failure)} === 'table')
          return { error: { code: '42P01', message: 'relation does not exist' } };
        if (table === 'memories' && ${JSON.stringify(failure)} === 'column')
          return { error: { code: '42703', message: 'column does not exist' } };
        return { error: null };
      } };
    } } } };
    try { console.log(JSON.stringify({ result: await verifyRequiredSchema(admin), seen })); }
    catch { process.exitCode = 1; }
  `;
  return spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    { encoding: "utf8" },
  );
}
test("probes the Sprint 3 table and client identity columns", () => {
  const run = probe();
  expect(run.status).toBe(0);
  const evidence = JSON.parse(run.stdout);
  expect(evidence.result.compatible).toBe(true);
  expect(evidence.seen).toContainEqual(["memories", "id,user_id,client_id"]);
  expect(evidence.seen).toContainEqual([
    "memory_creation_requests",
    "user_id,client_id,fingerprint,memory_id",
  ]);
});
test("refuses a Wave 3 schema missing the Memory request table", () => {
  const run = probe("table");
  expect(JSON.parse(run.stdout).result).toMatchObject({
    compatible: false,
    missing: ["memory_creation_requests"],
  });
});
test("fails closed when the old memories table lacks client_id", () => {
  expect(probe("column").status).toBe(1);
});
