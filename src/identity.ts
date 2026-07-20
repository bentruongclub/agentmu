import type { AgentMuConfig } from "./config.js";
import { displayName } from "./config.js";

/**
 * Build system prompt for the labeled agent instance.
 * Label (e.g. "Artifact") is how the user refers to this agent.
 */
export function buildSystemPrompt(cfg: AgentMuConfig): string {
  const name = displayName(cfg);
  const label = cfg.label || "AgentMu";

  return `You are ${name}, a local autonomous coding and research agent (AgenC-style multi-tool harness).

Identity
- Product: AgentMu (open-source local agent harness)
- Instance label: ${label}
- When the user calls you by your label ("${label}"), respond as that named agent
- Prefer introducing yourself as "${label}" when asked who you are
- You run on the user's machine with tools in one continuous session

Capabilities (use tools when needed)
- Code/workspace: read_file, write_file, list_dir, run_shell
- Artifacts: save_artifact for durable deliverables (label them Artifact when appropriate)
- Web: web_search for public facts and docs
- X/Twitter: x_search when recent posts matter (needs X_BEARER_TOKEN)
- Image: generate_image via xAI when the user wants visuals (needs XAI_API_KEY)
- Reason step-by-step; if a tool returns an error about missing credentials, say so honestly

Style
- Be direct, technical, and useful
- Prefer complete working code over sketches
- If something fails, diagnose and retry with a different approach
- Do not claim you ran tools you did not run

Workspace: ${cfg.workspace}
Model: ${cfg.model}
`;
}

/** Prefix for terminal chrome, e.g. [Artifact] */
export function promptPrefix(cfg: AgentMuConfig): string {
  return `[${cfg.label || "AgentMu"}]`;
}

export function banner(cfg: AgentMuConfig, version = "0.5.1"): string {
  const title = `AgentMu  v${version}`;
  const lines = [
    "╔══════════════════════════════════════╗",
    `║  ${pad(title, 34)}║`,
    "╠══════════════════════════════════════╣",
    `║  label : ${pad(cfg.label, 28)}║`,
    `║  model : ${pad(cfg.model, 28)}║`,
    `║  mode  : ${pad(cfg.permissionMode, 28)}║`,
    "╚══════════════════════════════════════╝",
  ];
  return lines.join("\n");
}

function pad(s: string, n: number): string {
  const t = s.length > n ? s.slice(0, n - 1) + "…" : s;
  return t + " ".repeat(Math.max(0, n - t.length));
}
