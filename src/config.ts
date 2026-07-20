import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import type { PermissionMode } from "./permissions.js";
import { parsePermissionMode } from "./permissions.js";

export type AgentMuConfig = {
  /** Product name — always AgentMu */
  product: "AgentMu";
  /** User-facing label for this instance (e.g. "Artifact") */
  label: string;
  model: string;
  baseUrl: string;
  workspace: string;
  maxToolRounds: number;
  /**
   * Tool permission mode:
   * - safe: read-ish only (list/read/search/artifacts)
   * - default: write ok, run_shell off unless allowTools
   * - bypass: all tools (old behavior)
   */
  permissionMode: PermissionMode;
  /** Tool names always allowed (unless in denyTools) */
  allowTools: string[];
  /** Tool names always denied */
  denyTools: string[];
  createdAt: string;
  updatedAt: string;
};

const DEFAULTS = {
  product: "AgentMu" as const,
  label: "Artifact",
  model: "grok-4.5",
  baseUrl: "https://api.x.ai/v1",
  maxToolRounds: 12,
  permissionMode: "default" as PermissionMode,
  allowTools: [] as string[],
  denyTools: [] as string[],
};

function homeConfigDir(): string {
  return path.join(os.homedir(), ".agentmu");
}

export function configPath(cwd = process.cwd()): string {
  const local = path.join(cwd, ".agentmu", "config.json");
  if (fs.existsSync(local)) return local;
  return path.join(homeConfigDir(), "config.json");
}

export function localConfigDir(cwd = process.cwd()): string {
  return path.join(cwd, ".agentmu");
}

export function loadEnvFile(cwd = process.cwd()): void {
  const candidates = [
    path.join(cwd, ".env"),
    path.join(homeConfigDir(), ".env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

export function defaultConfig(partial: Partial<AgentMuConfig> = {}): AgentMuConfig {
  const now = new Date().toISOString();
  const envMode = process.env.AGENTMU_PERMISSION_MODE;
  return {
    product: DEFAULTS.product,
    label: partial.label ?? process.env.AGENTMU_LABEL ?? DEFAULTS.label,
    model: partial.model ?? process.env.AGENTMU_MODEL ?? DEFAULTS.model,
    baseUrl: partial.baseUrl ?? process.env.AGENTMU_BASE_URL ?? DEFAULTS.baseUrl,
    workspace: partial.workspace ?? process.cwd(),
    maxToolRounds: partial.maxToolRounds ?? DEFAULTS.maxToolRounds,
    permissionMode: parsePermissionMode(
      partial.permissionMode ?? envMode ?? DEFAULTS.permissionMode
    ),
    allowTools: partial.allowTools ?? DEFAULTS.allowTools,
    denyTools: partial.denyTools ?? DEFAULTS.denyTools,
    createdAt: partial.createdAt ?? now,
    updatedAt: now,
  };
}

export function loadConfig(cwd = process.cwd()): AgentMuConfig {
  loadEnvFile(cwd);
  const file = configPath(cwd);
  if (!fs.existsSync(file)) {
    return defaultConfig({ workspace: cwd });
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<AgentMuConfig>;
    return defaultConfig({
      ...raw,
      workspace: raw.workspace ?? cwd,
      createdAt: raw.createdAt,
    });
  } catch {
    return defaultConfig({ workspace: cwd });
  }
}

export function saveConfig(cfg: AgentMuConfig, target: "local" | "home" = "local"): string {
  const dir =
    target === "home" ? homeConfigDir() : localConfigDir(cfg.workspace || process.cwd());
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "config.json");
  const next: AgentMuConfig = {
    ...cfg,
    product: "AgentMu",
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", "utf8");
  return file;
}

export function displayName(cfg: AgentMuConfig): string {
  if (!cfg.label || cfg.label === cfg.product) return cfg.product;
  return `${cfg.product} · ${cfg.label}`;
}

/** Env API key only (OAuth is separate — use resolveXaiCredentials for runtime). */
export function getApiKey(): string | undefined {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY;
}
