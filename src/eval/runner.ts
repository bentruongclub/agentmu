/**
 * Offline eval runner — no live model calls.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runAgent } from "../agent.js";
import { defaultConfig } from "../config.js";
import {
  EVAL_CASES,
  scriptedProvider,
  type EvalCase,
} from "./cases.js";
import { EXIT_ERROR, EXIT_OK } from "../exit-codes.js";

export type EvalCaseResult = {
  id: string;
  description: string;
  ok: boolean;
  error?: string;
  ms: number;
};

export type EvalSuiteResult = {
  results: EvalCaseResult[];
  passed: number;
  failed: number;
  exitCode: number;
};

export async function runEvalCase(c: EvalCase): Promise<EvalCaseResult> {
  const t0 = Date.now();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `agentmu-eval-${c.id}-`));
  const sessionId = `eval-${c.id}`;
  try {
    const cfg = defaultConfig({
      workspace,
      label: "Artifact",
      model: "eval-fake",
      permissionMode: c.permissionMode ?? "default",
      allowTools: c.allowTools ?? [],
    });
    const { finalText, stats } = await runAgent({
      cfg,
      userMessage: c.userMessage,
      sessionId,
      complete: scriptedProvider(c.script),
    });
    c.assert({
      workspace,
      sessionId,
      finalText,
      permissionDenies: stats.permissionDenies,
      toolSuccesses: stats.toolSuccesses,
    });
    return {
      id: c.id,
      description: c.description,
      ok: true,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      id: c.id,
      description: c.description,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - t0,
    };
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

export async function runEvalSuite(
  cases: EvalCase[] = EVAL_CASES
): Promise<EvalSuiteResult> {
  const results: EvalCaseResult[] = [];
  for (const c of cases) {
    results.push(await runEvalCase(c));
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return {
    results,
    passed,
    failed,
    exitCode: failed ? EXIT_ERROR : EXIT_OK,
  };
}

export function formatEvalSuite(suite: EvalSuiteResult): string {
  const lines: string[] = ["AgentMu eval (offline)", ""];
  for (const r of suite.results) {
    const mark = r.ok ? "✓" : "✗";
    lines.push(`${mark} ${r.id} (${r.ms}ms) — ${r.description}`);
    if (!r.ok && r.error) lines.push(`    ${r.error}`);
  }
  lines.push("");
  lines.push(`Passed ${suite.passed}/${suite.results.length}`);
  return lines.join("\n");
}
