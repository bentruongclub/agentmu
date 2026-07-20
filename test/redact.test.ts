import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { redactSecrets } from "../src/redact.js";
import { appendJournal, readJournal } from "../src/journal.js";

describe("secret redaction", () => {
  it("redacts xai- and sk- style keys", () => {
    const s = redactSecrets(
      "key=xai-abcdefghijklmnopqrstuvwxyz012345 token=sk-abcdefghijklmnopqrstuvwxyz"
    );
    assert.match(s, /REDACTED:XAI_KEY/);
    assert.match(s, /REDACTED:SK_KEY/);
    assert.ok(!s.includes("xai-abcdefgh"));
  });

  it("redacts bearer and env assignments", () => {
    const s = redactSecrets(
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.aaaa.bbbb XAI_API_KEY=xai-abcdefghijklmnopqrstuvwxyz99'
    );
    assert.match(s, /REDACTED/);
  });

  it("journal append redacts previews", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-redact-"));
    try {
      appendJournal(dir, "j1", {
        type: "tool_result",
        name: "run_shell",
        result_preview: "export XAI_API_KEY=xai-abcdefghijklmnopqrstuvwxyz0123",
      });
      const rows = readJournal(dir, "j1");
      assert.equal(rows.length, 1);
      const row = rows[0]!;
      assert.equal(row.type, "tool_result");
      if (row.type === "tool_result") {
        assert.match(row.result_preview, /REDACTED/);
        assert.ok(!row.result_preview.includes("xai-abcdefgh"));
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
