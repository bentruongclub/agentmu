import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  runAgent,
  loadSession,
  type CompletionProvider,
  type CompletionMessage,
} from "../src/agent.js";
import { defaultConfig } from "../src/config.js";

describe("agent tool loop with injectable completion provider", () => {
  let workspace: string;

  before(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-loop-"));
  });

  after(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it("model tool call → real save_artifact → final text + session persist", async () => {
    const finalAssistantText =
      "Artifact saved successfully — deliverable is ready.";
    let step = 0;

    const complete: CompletionProvider = async () => {
      step += 1;
      if (step === 1) {
        const message: CompletionMessage = {
          role: "assistant",
          content: "Saving the deliverable now.",
          tool_calls: [
            {
              id: "call_test_1",
              type: "function",
              function: {
                name: "save_artifact",
                arguments: JSON.stringify({
                  name: "loop-proof",
                  content: "side-effect-from-loop",
                  label: "Artifact",
                }),
              },
            },
          ],
        };
        return { message };
      }
      const message: CompletionMessage = {
        role: "assistant",
        content: finalAssistantText,
      };
      return { message };
    };

    const cfg = defaultConfig({
      label: "Artifact",
      workspace,
      model: "fake-model",
    });

    const sessionId = "loop-test-session";
    const { finalText, messages } = await runAgent({
      cfg,
      userMessage: "Save a proof artifact",
      sessionId,
      complete,
    });

    assert.equal(finalText, finalAssistantText);
    assert.ok(messages.length >= 4, "system/user/assistant/tool/assistant");

    const artDir = path.join(workspace, "sessions", "artifacts");
    assert.ok(fs.existsSync(artDir), "artifacts dir exists");
    const files = fs.readdirSync(artDir);
    assert.ok(files.some((f) => f.includes("loop-proof")));
    const body = fs.readFileSync(path.join(artDir, files[0]!), "utf8");
    assert.match(body, /side-effect-from-loop/);
    assert.match(body, /label="Artifact"/);

    const sessionFile = path.join(workspace, "sessions", `${sessionId}.json`);
    assert.ok(fs.existsSync(sessionFile), "session file written");
    const session = JSON.parse(fs.readFileSync(sessionFile, "utf8")) as {
      label: string;
      product: string;
      messages: unknown[];
    };
    assert.equal(session.label, "Artifact");
    assert.equal(session.product, "AgentMu");
    assert.ok(session.messages.length >= 4);

    const reloaded = loadSession(cfg, sessionId);
    assert.ok(reloaded);
    assert.ok(reloaded!.length >= 4);
  });

  it("write_file tool side effect via loop", async () => {
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
                id: "call_w",
                type: "function",
                function: {
                  name: "write_file",
                  arguments: JSON.stringify({
                    path: "out/from-loop.txt",
                    content: "written-by-loop",
                  }),
                },
              },
            ],
          },
        };
      }
      return {
        message: {
          role: "assistant",
          content: "Wrote the file.",
        },
      };
    };

    const cfg = defaultConfig({ label: "Artifact", workspace });
    const { finalText } = await runAgent({
      cfg,
      userMessage: "write it",
      complete,
    });
    assert.equal(finalText, "Wrote the file.");
    assert.equal(
      fs.readFileSync(path.join(workspace, "out/from-loop.txt"), "utf8"),
      "written-by-loop"
    );
  });
});
