import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  appendJournal,
  readJournal,
  journalPath,
} from "../src/journal.js";
import { runAgent, type CompletionProvider } from "../src/agent.js";
import { defaultConfig } from "../src/config.js";

describe("session event journal", () => {
  let workspace: string;

  before(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-journal-"));
  });

  after(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it("append + read JSONL records", () => {
    appendJournal(workspace, "s1", {
      type: "user_message",
      text: "hello",
    });
    appendJournal(workspace, "s1", {
      type: "done",
      text: "bye",
    });
    const rows = readJournal(workspace, "s1");
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.type, "user_message");
    assert.equal(rows[1]!.type, "done");
    assert.ok(fs.existsSync(journalPath(workspace, "s1")));
  });

  it("runAgent writes journal with permission decisions", async () => {
    let step = 0;
    const complete: CompletionProvider = async () => {
      step += 1;
      if (step === 1) {
        return {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "c1",
                type: "function",
                function: {
                  name: "run_shell",
                  arguments: JSON.stringify({ command: "echo should-deny" }),
                },
              },
            ],
          },
        };
      }
      return {
        message: {
          role: "assistant",
          content: "Shell was denied as expected.",
        },
      };
    };

    const cfg = defaultConfig({
      workspace,
      label: "Artifact",
      permissionMode: "default",
      model: "fake",
    });
    const sessionId = "perm-journal";
    await runAgent({
      cfg,
      userMessage: "run echo",
      sessionId,
      complete,
    });

    const rows = readJournal(workspace, sessionId);
    assert.ok(rows.some((r) => r.type === "user_message"));
    assert.ok(rows.some((r) => r.type === "tool_call"));
    const perm = rows.find((r) => r.type === "permission");
    assert.ok(perm && perm.type === "permission");
    if (perm && perm.type === "permission") {
      assert.equal(perm.allowed, false);
      assert.equal(perm.name, "run_shell");
    }
    assert.ok(rows.some((r) => r.type === "done"));
  });
});
