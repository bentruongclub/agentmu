import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runEvalSuite } from "../src/eval/runner.js";
import { EVAL_CASES } from "../src/eval/cases.js";

describe("offline eval suite", () => {
  it("ships at least 5 cases", () => {
    assert.ok(EVAL_CASES.length >= 5);
  });

  it("all built-in cases pass", async () => {
    const suite = await runEvalSuite();
    assert.equal(
      suite.failed,
      0,
      suite.results
        .filter((r) => !r.ok)
        .map((r) => `${r.id}: ${r.error}`)
        .join("; ")
    );
    assert.equal(suite.passed, EVAL_CASES.length);
    assert.equal(suite.exitCode, 0);
  });
});
