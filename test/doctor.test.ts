import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runDoctor, formatDoctorReport } from "../src/doctor.js";

describe("doctor", () => {
  let dir: string;
  let prevKey: string | undefined;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-doctor-"));
    prevKey = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (prevKey !== undefined) process.env.XAI_API_KEY = prevKey;
  });

  it("reports workspace and node checks", async () => {
    const report = await runDoctor(dir);
    assert.ok(report.checks.some((c) => c.id === "workspace" && c.ok));
    assert.ok(report.checks.some((c) => c.id === "node"));
    assert.ok(report.checks.some((c) => c.id === "sessions_writable" && c.ok));
    const text = formatDoctorReport(report);
    assert.match(text, /AgentMu doctor/);
    assert.match(text, /workspace/);
  });

  it("missing credentials warn by default; fail with strict", async () => {
    const soft = await runDoctor(dir, { strict: false });
    const credSoft = soft.checks.find((c) => c.id === "credentials_runtime");
    assert.ok(credSoft);
    assert.equal(credSoft!.level, "warn");
    assert.equal(soft.ok, true);

    const hard = await runDoctor(dir, { strict: true });
    const credHard = hard.checks.find((c) => c.id === "credentials_runtime");
    assert.ok(credHard);
    assert.equal(credHard!.level, "fail");
    assert.equal(hard.ok, false);
  });
});
