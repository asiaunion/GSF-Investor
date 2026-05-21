#!/usr/bin/env node
/**
 * Local CI repro + debug logging (session 01164f).
 * Usage: node scripts/ci-diagnose.mjs
 */
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LOG_PATH =
  process.env.DEBUG_LOG_PATH ||
  "/Users/gsf/dev/Cursor/gsf-investor/.cursor/debug-01164f.log";
const INGEST =
  "http://127.0.0.1:7485/ingest/d6c86567-9cd5-452d-9f72-d2fd61e24c98";
const SESSION = "01164f";
const RUN_ID = process.env.DEBUG_RUN_ID || "ci-local";

function log(hypothesisId, location, message, data = {}) {
  // #region agent log
  const entry = {
    sessionId: SESSION,
    runId: RUN_ID,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    /* ignore */
  }
  fetch(INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION,
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::debug::${JSON.stringify(entry)}`);
  }
  // #endregion
}

function runStep(hypothesisId, name, cmd, args, env = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: false,
  });
  const ms = Date.now() - t0;
  const stderrTail = (r.stderr || "").slice(-2000);
  const stdoutTail = (r.stdout || "").slice(-2000);
  log(hypothesisId, `ci-diagnose:${name}`, "step finished", {
    cmd: [cmd, ...args].join(" "),
    status: r.status,
    signal: r.signal,
    ms,
    stderrTail,
    stdoutTail,
  });
  return r.status ?? 1;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
log("H0", "ci-diagnose:start", "CI diagnose start", {
  cwd: root,
  node: process.version,
  GITHUB_ACTIONS: process.env.GITHUB_ACTIONS || "",
  CI: process.env.CI || "",
});

// H1: npm ci
const ciStatus = runStep("H1", "npm-ci", "npm", ["ci"]);

// H2: lint (quiet + full error count)
const lintQuiet = runStep("H2", "lint-quiet", "npm", ["run", "lint"]);
const lintJson = spawnSync("npx", ["eslint", "-f", "json", "."], {
  cwd: root,
  encoding: "utf8",
});
let errors = -1;
let warnings = -1;
try {
  const report = JSON.parse(lintJson.stdout || "[]");
  errors = report.reduce((a, f) => a + f.errorCount, 0);
  warnings = report.reduce((a, f) => a + f.warningCount, 0);
} catch (e) {
  log("H2", "ci-diagnose:lint-json", "parse failed", {
    status: lintJson.status,
    stderr: (lintJson.stderr || "").slice(-500),
  });
}
log("H2", "ci-diagnose:lint-counts", "eslint counts", {
  errors,
  warnings,
  quietExit: lintQuiet,
  jsonExit: lintJson.status,
});

// H3: test
const testStatus = runStep("H3", "npm-test", "npm", ["test"]);

// H4: build (GHA env)
const buildStatus = runStep(
  "H4",
  "npm-build",
  "npm",
  ["run", "build"],
  {
    TURSO_DATABASE_URL: "file:./ci-build.db",
    TURSO_AUTH_TOKEN: "",
    AUTH_SECRET: "ci-build-secret-min-32-chars-long",
    AUTH_URL: "http://localhost:3000",
    GITHUB_ACTIONS: "true",
    CI: "true",
  }
);

log("H0", "ci-diagnose:end", "CI diagnose summary", {
  npmCi: ciStatus,
  lintQuiet,
  errors,
  warnings,
  test: testStatus,
  build: buildStatus,
  overall: [ciStatus, lintQuiet, testStatus, buildStatus].every((s) => s === 0)
    ? "PASS"
    : "FAIL",
});

process.exit(
  [ciStatus, lintQuiet, testStatus, buildStatus].every((s) => s === 0) ? 0 : 1
);
