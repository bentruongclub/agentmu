import type OpenAI from "openai";
import type { AgentMuConfig } from "./config.js";
import { createClient } from "./client.js";
import { buildSystemPrompt, promptPrefix } from "./identity.js";
import { runTool, toolDefinitions } from "./tools/index.js";
import { authorizeTool } from "./permissions.js";
import { appendJournal } from "./journal.js";
import {
  formatSkillsForPrompt,
  loadSkills,
  type Skill,
} from "./skills.js";
import type { RunStats } from "./exit-codes.js";
import fs from "node:fs";
import path from "node:path";

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export type CompletionRequest = {
  model: string;
  messages: ChatMessage[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  tool_choice: "auto";
};

export type CompletionMessage = OpenAI.Chat.Completions.ChatCompletionMessage;

/** Injectable completion port — production uses xAI; tests inject a fake sequence. */
export type CompletionProvider = (
  req: CompletionRequest
) => Promise<{ message: CompletionMessage }>;

export type RunOptions = {
  cfg: AgentMuConfig;
  messages?: ChatMessage[];
  userMessage: string;
  onEvent?: (event: AgentEvent) => void;
  sessionId?: string;
  /** When set, used instead of live xAI client */
  complete?: CompletionProvider;
};

export type AgentEvent =
  | { type: "assistant_text"; text: string }
  | { type: "tool_call"; name: string; args: string }
  | { type: "permission"; name: string; allowed: boolean; reason: string }
  | { type: "tool_result"; name: string; result: string }
  | { type: "done"; text: string };

function emit(onEvent: RunOptions["onEvent"], event: AgentEvent): void {
  onEvent?.(event);
}

function journal(
  opts: RunOptions,
  event: Parameters<typeof appendJournal>[2]
): void {
  if (!opts.sessionId) return;
  try {
    appendJournal(opts.cfg.workspace, opts.sessionId, event);
  } catch {
    /* journal must never crash the agent */
  }
}

export function createXaiCompletionProvider(
  cfg: AgentMuConfig
): CompletionProvider {
  let clientPromise: Promise<OpenAI> | null = null;
  const getClient = () => {
    if (!clientPromise) clientPromise = createClient(cfg);
    return clientPromise;
  };
  return async (req) => {
    const client = await getClient();
    const completion = await client.chat.completions.create({
      model: req.model,
      messages: req.messages,
      tools: req.tools,
      tool_choice: req.tool_choice,
    });
    const choice = completion.choices[0];
    if (!choice) throw new Error("Empty completion from model");
    return { message: choice.message };
  };
}

export async function runAgent(opts: RunOptions): Promise<{
  finalText: string;
  messages: ChatMessage[];
  stats: RunStats;
  skills: Skill[];
}> {
  const { cfg, userMessage, onEvent } = opts;
  const complete = opts.complete ?? createXaiCompletionProvider(cfg);
  const skills = loadSkills(cfg.workspace);
  const skillBlock = formatSkillsForPrompt(skills);

  const systemBase = buildSystemPrompt(cfg);
  const systemContent = skillBlock
    ? `${systemBase}\n\n${skillBlock}`
    : systemBase;

  const messages: ChatMessage[] = opts.messages
    ? [...opts.messages]
    : [{ role: "system", content: systemContent }];

  // If resuming mid-session, still attach skills once when first message is system without skills
  if (
    opts.messages?.length &&
    skillBlock &&
    messages[0]?.role === "system" &&
    typeof messages[0].content === "string" &&
    !messages[0].content.includes("Skills (follow when")
  ) {
    messages[0] = {
      role: "system",
      content: `${messages[0].content}\n\n${skillBlock}`,
    };
  }

  const stats: RunStats = {
    permissionDenies: 0,
    toolSuccesses: 0,
  };

  if (opts.sessionId && !opts.messages) {
    journal(opts, {
      type: "session_start",
      sessionId: opts.sessionId,
      label: cfg.label,
      model: cfg.model,
    });
  }

  messages.push({ role: "user", content: userMessage });
  journal(opts, { type: "user_message", text: userMessage });

  let finalText = "";
  const maxRounds = cfg.maxToolRounds ?? 12;
  const permCfg = {
    mode: cfg.permissionMode,
    allowTools: cfg.allowTools,
    denyTools: cfg.denyTools,
  };

  for (let round = 0; round < maxRounds; round++) {
    const { message: msg } = await complete({
      model: cfg.model,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
    });

    messages.push(msg);

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      finalText = msg.content?.toString() ?? "";
      emit(onEvent, { type: "assistant_text", text: finalText });
      journal(opts, { type: "assistant_text", text: finalText });
      emit(onEvent, { type: "done", text: finalText });
      journal(opts, { type: "done", text: finalText });
      break;
    }

    if (msg.content) {
      const t = msg.content.toString();
      emit(onEvent, { type: "assistant_text", text: t });
      journal(opts, { type: "assistant_text", text: t });
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const name = call.function.name;
      const args = call.function.arguments ?? "{}";
      emit(onEvent, { type: "tool_call", name, args });
      journal(opts, { type: "tool_call", name, args });

      const decision = authorizeTool(name, args, permCfg);
      emit(onEvent, {
        type: "permission",
        name,
        allowed: decision.allowed,
        reason: decision.reason,
      });
      journal(opts, {
        type: "permission",
        name,
        allowed: decision.allowed,
        reason: decision.reason,
        via: decision.via,
      });

      let result: string;
      if (!decision.allowed) {
        stats.permissionDenies += 1;
        result = `Permission denied: ${decision.reason}`;
      } else {
        result = await runTool(name, args, { workspace: cfg.workspace });
        stats.toolSuccesses += 1;
      }

      emit(onEvent, {
        type: "tool_result",
        name,
        result: result.slice(0, 4000),
      });
      journal(opts, {
        type: "tool_result",
        name,
        result_preview: result.slice(0, 500),
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }

    if (round === maxRounds - 1) {
      finalText =
        "(stopped: max tool rounds reached — ask me to continue if needed)";
      emit(onEvent, { type: "done", text: finalText });
      journal(opts, { type: "done", text: finalText });
    }
  }

  if (opts.sessionId) {
    persistSession(cfg, opts.sessionId, messages);
  }

  return { finalText, messages, stats, skills };
}

export function persistSession(
  cfg: AgentMuConfig,
  sessionId: string,
  messages: ChatMessage[]
): string {
  const dir = path.join(cfg.workspace, "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionId}.json`);
  const payload = {
    product: cfg.product,
    label: cfg.label,
    model: cfg.model,
    permissionMode: cfg.permissionMode,
    updatedAt: new Date().toISOString(),
    messages,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return file;
}

export function loadSession(
  cfg: AgentMuConfig,
  sessionId: string
): ChatMessage[] | null {
  const file = path.join(cfg.workspace, "sessions", `${sessionId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      messages?: ChatMessage[];
    };
    return raw.messages ?? null;
  } catch {
    return null;
  }
}

export function printEvent(cfg: AgentMuConfig, event: AgentEvent): void {
  const p = promptPrefix(cfg);
  switch (event.type) {
    case "assistant_text":
      if (event.text.trim()) process.stdout.write(`\n${p} ${event.text}\n`);
      break;
    case "tool_call":
      process.stdout.write(
        `\n${p} ⚙ ${event.name}(${truncate(event.args, 120)})\n`
      );
      break;
    case "permission":
      if (!event.allowed) {
        process.stdout.write(`${p} 🛡 DENY ${event.name}: ${event.reason}\n`);
      }
      break;
    case "tool_result":
      process.stdout.write(
        `${p} ← ${event.name}: ${truncate(event.result, 200)}\n`
      );
      break;
    case "done":
      break;
  }
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}
