import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Keep raw Jest results transient; publish only counts and synthetic case IDs.
const output = process.argv[2];
if (!output || process.env.RUN_PROVIDER_SAFETY_EVALS !== "true") {
  console.error(
    "Usage: RUN_PROVIDER_SAFETY_EVALS=true node scripts/run-provider-safety-eval.mjs <summary.json>",
  );
  process.exit(1);
}
const root = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "mori-provider-eval-"));
const resultFile = join(temp, "jest.json");
const startedUtc = new Date().toISOString();
const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
const sourceSha = git(["rev-parse", "HEAD"]).stdout.trim();
const trackedChanges = git(["diff", "HEAD", "--quiet"]).status !== 0;
const run = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/jest/bin/jest.js"),
    "--runInBand",
    "tests/evals/provider-safety.eval.test.ts",
    "--json",
    `--outputFile=${resultFile}`,
  ],
  {
    cwd: root,
    encoding: "utf8",
    timeout: 900_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CAPTURE_SYNTHETIC_EVAL_FAILURES: "false" },
  },
);
let result;
try {
  result = JSON.parse(readFileSync(resultFile, "utf8"));
} catch {
  /* Missing/invalid Jest results must fail closed. */
} finally {
  try {
    unlinkSync(resultFile);
  } catch {
    /* No file if Jest never started. */
  }
  rmdirSync(temp);
}
const log = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
const number = (expression) => {
  const match = log.match(expression);
  return match ? Number(match[1]) : null;
};
const classification = (label) => {
  const section = log.split(`=== ${label} ===`)[1]?.split("===")[0] ?? "";
  const counts = section.match(/total: (\d+), pass: (\d+), fail: (\d+)/);
  const errors = section.match(
    /false positive: (\d+), false negative: (\d+), critical false negative: (\d+)/,
  );
  return counts && errors
    ? {
        total: +counts[1],
        passed: +counts[2],
        failed: +counts[3],
        falsePositive: +errors[1],
        falseNegative: +errors[2],
        criticalFalseNegative: +errors[3],
      }
    : null;
};
const events = log.split(/\r?\n/).flatMap((line) => {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
});
const raw = classification("A. Raw LLM Classification");
const service = classification("B. SafetyService End-to-End");
const behaviorTotal = number(/total behavior cases: (\d+)/);
const fallback = number(/SAFE_FALLBACK triggered: (\d+)/);
const behaviorPassed = number(/safety policy compliance: (\d+)\//);
const successfulCalls = events.filter(
  (event) => event.provider && event.status === "success",
).length;
const failedCalls = events.filter(
  (event) => event.provider && event.status !== "success",
).length;
const complete =
  result?.numPassedTests > 0 &&
  result.numPendingTests === 0 &&
  raw?.total > 0 &&
  service?.total > 0 &&
  behaviorTotal > 0 &&
  raw.total + service.total + behaviorTotal === result.numTotalTests;
const passed =
  run.status === 0 &&
  result?.success === true &&
  complete &&
  successfulCalls > 0 &&
  failedCalls === 0 &&
  raw.failed === 0 &&
  service.failed === 0 &&
  behaviorPassed === behaviorTotal;
const summary = {
  sourceSha,
  trackedChanges,
  startedUtc,
  completedUtc: new Date().toISOString(),
  enabled: process.env.RUN_PROVIDER_SAFETY_EVALS === "true",
  providerHost: process.env.LLM_BASE_URL
    ? new URL(process.env.LLM_BASE_URL).hostname
    : null,
  model: process.env.LLM_MODEL,
  embeddingModel: process.env.LLM_EMBEDDING_MODEL,
  processExitCode: run.status,
  processSignal: run.signal,
  executionError: run.error?.code,
  passed: Boolean(passed),
  complete: Boolean(complete),
  tests: {
    passed: result?.numPassedTests ?? 0,
    failed: result?.numFailedTests ?? 0,
    skipped: result?.numPendingTests ?? 0,
  },
  raw,
  service,
  behavior: {
    total: behaviorTotal,
    passed: behaviorPassed,
    fallback,
    fallbackRate: behaviorTotal ? fallback / behaviorTotal : null,
    natural: number(/safe natural responses: (\d+)/),
    policyRejections: number(/policy rejections: (\d+)/),
  },
  providerCalls: {
    successful: successfulCalls,
    nonSuccess: failedCalls,
    timeouts: events.filter((event) => event.error_category === "timeout")
      .length,
    malformedOutputs: events.filter(
      (event) => event.error_category === "invalid_response",
    ).length,
    rateLimits: events.filter((event) => event.error_category === "rate_limit")
      .length,
    warningOrErrorEvents: events.filter((event) => event.level >= 40).length,
  },
  cases:
    result?.testResults.flatMap((suite) =>
      suite.assertionResults.map((test) => ({
        id: test.fullName,
        status: test.status,
      })),
    ) ?? [],
};
mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
console.log(
  `Provider safety: ${passed ? "PASS" : "FAIL / UNVERIFIED"}; ${summary.tests.passed} passed, ${summary.tests.failed} failed, ${summary.tests.skipped} skipped. Sanitized report written.`,
);
process.exitCode = passed ? 0 : 1;
