/**
 * Built-in offline eval cases (fake CompletionProvider — no network).
 */

import fs from "node:fs";
import path from "node:path";
import type { CompletionMessage, CompletionProvider } from "../agent.js";
import type { PermissionMode } from "../permissions.js";
import { readJournal } from "../journal.js";

export type EvalAssertContext = {
  workspace: string;
  sessionId: string;
  finalText: string;
  permissionDenies: number;
  toolSuccesses: number;
};

export type EvalCase = {
  id: string;
  description: string;
  userMessage: string;
  permissionMode?: PermissionMode;
  allowTools?: string[];
  /** Scripted assistant messages in order */
  script: CompletionMessage[];
  assert: (ctx: EvalAssertContext) => void;
};

function assistantTool(
  id: string,
  name: string,
  args: Record<string, unknown>
): CompletionMessage {
  return {
    role: "assistant",
    content: null,
    refusal: null,
    tool_calls: [
      {
        id,
        type: "function",
        function: {
          name,
          arguments: JSON.stringify(args),
        },
      },
    ],
  } as CompletionMessage;
}

function assistantText(content: string): CompletionMessage {
  return { role: "assistant", content, refusal: null } as CompletionMessage;
}

export function scriptedProvider(
  script: CompletionMessage[]
): CompletionProvider {
  let i = 0;
  return async () => {
    const message = script[i] ?? assistantText("(eval: script exhausted)");
    i += 1;
    return { message };
  };
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: "artifact-write",
    description: "save_artifact creates a file under sessions/artifacts",
    userMessage: "save a proof artifact",
    permissionMode: "default",
    script: [
      assistantTool("c1", "save_artifact", {
        name: "eval-proof",
        content: "eval-artifact-body",
        label: "Artifact",
      }),
      assistantText("Artifact saved."),
    ],
    assert: ({ workspace, finalText, toolSuccesses }) => {
      if (toolSuccesses < 1) throw new Error("expected tool success");
      if (!finalText.includes("Artifact")) {
        /* soft */
      }
      const art = path.join(workspace, "sessions", "artifacts");
      if (!fs.existsSync(art)) throw new Error("missing artifacts dir");
      const files = fs.readdirSync(art);
      const hit = files.find((f) => f.includes("eval-proof"));
      if (!hit) throw new Error("eval-proof artifact not found");
      const body = fs.readFileSync(path.join(art, hit), "utf8");
      if (!body.includes("eval-artifact-body")) {
        throw new Error("artifact body missing");
      }
    },
  },
  {
    id: "write-read",
    description: "write_file then model finishes (file on disk)",
    userMessage: "write a file",
    permissionMode: "default",
    script: [
      assistantTool("c1", "write_file", {
        path: "out/eval.txt",
        content: "eval-write-ok",
      }),
      assistantText("Wrote file."),
    ],
    assert: ({ workspace, toolSuccesses }) => {
      if (toolSuccesses < 1) throw new Error("expected tool success");
      const p = path.join(workspace, "out", "eval.txt");
      if (!fs.existsSync(p)) throw new Error("file not written");
      if (fs.readFileSync(p, "utf8") !== "eval-write-ok") {
        throw new Error("file content mismatch");
      }
    },
  },
  {
    id: "shell-denied-default",
    description: "run_shell denied under default permission mode",
    userMessage: "run echo hi",
    permissionMode: "default",
    script: [
      assistantTool("c1", "run_shell", { command: "echo should-deny" }),
      assistantText("Shell denied as expected."),
    ],
    assert: ({ permissionDenies, toolSuccesses, sessionId, workspace }) => {
      if (permissionDenies < 1) throw new Error("expected permission deny");
      if (toolSuccesses !== 0) throw new Error("expected no tool successes");
      const rows = readJournal(workspace, sessionId);
      const perm = rows.find((r) => r.type === "permission");
      if (!perm || perm.type !== "permission" || perm.allowed) {
        throw new Error("journal missing denied permission event");
      }
    },
  },
  {
    id: "shell-allowed-bypass",
    description: "run_shell works in bypass mode",
    userMessage: "run echo",
    permissionMode: "bypass",
    script: [
      assistantTool("c1", "run_shell", { command: "echo eval-shell-ok" }),
      assistantText("Shell ok."),
    ],
    assert: ({ toolSuccesses, permissionDenies }) => {
      if (permissionDenies !== 0) throw new Error("unexpected deny");
      if (toolSuccesses < 1) throw new Error("expected shell success");
    },
  },
  {
    id: "safe-blocks-write",
    description: "safe mode denies write_file",
    userMessage: "write something",
    permissionMode: "safe",
    script: [
      assistantTool("c1", "write_file", {
        path: "nope.txt",
        content: "should-not-exist",
      }),
      assistantText("Write denied."),
    ],
    assert: ({ workspace, permissionDenies, toolSuccesses }) => {
      if (permissionDenies < 1) throw new Error("expected deny");
      if (toolSuccesses !== 0) throw new Error("expected no success");
      if (fs.existsSync(path.join(workspace, "nope.txt"))) {
        throw new Error("file should not exist in safe mode");
      }
    },
  },
];
