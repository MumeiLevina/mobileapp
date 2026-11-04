import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Reproduce the old pipe's false success without contacting a real provider.
function run(mode: string, enabled = "true") {
  const root = mkdtempSync(join(tmpdir(), "mori-runner-test-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "node_modules/jest/bin"), { recursive: true });
    copyFileSync(
      resolve("scripts/run-provider-safety-eval.mjs"),
      join(root, "scripts/runner.mjs"),
    );
    writeFileSync(
      join(root, "node_modules/jest/bin/jest.js"),
      `
      const fs = require('fs');
      const mode = process.env.FIXTURE_MODE;
      if (mode !== 'missing') fs.writeFileSync(process.argv.find(a => a.startsWith('--outputFile=')).slice(13), JSON.stringify({
        success: true, numPassedTests: 3, numFailedTests: 0, numPendingTests: mode === 'skipped' ? 1 : 0, numTotalTests: 3,
        testResults: [{ assertionResults: [] }]
      }));
      console.log('=== A. Raw LLM Classification ===\\ntotal: 1, pass: 1, fail: 0\\nfalse positive: 0, false negative: 0, critical false negative: 0');
      console.log('=== B. SafetyService End-to-End ===\\ntotal: 1, pass: 1, fail: 0\\nfalse positive: 0, false negative: 0, critical false negative: 0');
      console.log('=== OUTPUT GUARD ===\\ntotal behavior cases: 1\\nsafety policy compliance: 1/1');
      if (mode !== 'missing-behavior-metrics') {
        console.log('safe natural responses: 1\\nSAFE_FALLBACK triggered: ' + (mode === 'inconsistent-behavior-metrics' ? 1 : 0) + '\\npolicy rejections: ' + (mode === 'policy-violation' ? 1 : 0));
      }
      console.error('private-synthetic-provider-output');
      console.log(JSON.stringify({ provider: 'synthetic', status: mode === 'provider-error' ? 'error' : 'success' }));
      process.exitCode = mode === 'nonzero' ? 1 : 0;
    `,
    );
    const report = join(root, "report.json");
    const result = spawnSync(
      process.execPath,
      [join(root, "scripts/runner.mjs"), report],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          RUN_PROVIDER_SAFETY_EVALS: enabled,
          FIXTURE_MODE: mode,
        },
      },
    );
    const summary =
      enabled === "true" ? JSON.parse(readFileSync(report, "utf8")) : undefined;
    expect(
      `${result.stdout}${result.stderr}${JSON.stringify(summary)}`,
    ).not.toContain("private-synthetic-provider-output");
    return { ...result, summary };
  } finally {
    // root is the directory returned directly by mkdtemp, never a user path.
    rmSync(root, { recursive: true, force: true });
  }
}

test("accepts complete enabled Jest results and writes only sanitized evidence", () => {
  const result = run("pass");
  expect(result.status).toBe(0);
  expect(result.summary).toMatchObject({
    passed: true,
    complete: true,
    tests: { passed: 3, failed: 0, skipped: 0 },
  });
});
test.each([
  "nonzero",
  "missing",
  "skipped",
  "provider-error",
  "missing-behavior-metrics",
  "inconsistent-behavior-metrics",
  "policy-violation",
])("refuses false success: %s", (mode) => {
  const result = run(mode);
  expect(result.status).toBe(1);
  expect(result.summary.passed).toBe(false);
});
test("refuses a disabled provider gate before starting Jest", () => {
  expect(run("pass", "false").status).toBe(1);
});
