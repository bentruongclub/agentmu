/**
 * Permission pipeline for tool calls.
 *
 * Order:
 *  1. Explicit deny list (always wins)
 *  2. Explicit allow list
 *  3. Mode policy (safe / default / bypass)
 *  4. Built-in dangerous shell patterns (always deny)
 */

export type PermissionMode = "safe" | "default" | "bypass";

export type PermissionDecision = {
  allowed: boolean;
  reason: string;
  /** allow | deny | auto */
  via: "deny_list" | "allow_list" | "mode" | "dangerous";
};

export type PermissionConfig = {
  /** safe = read-ish only; default = write ok, shell off; bypass = all tools */
  mode: PermissionMode;
  /** Tool names always denied */
  denyTools?: string[];
  /** Tool names always allowed (unless denied) */
  allowTools?: string[];
};

/** Tools that only read / fetch / write under sessions/artifacts */
export const READISH_TOOLS = new Set([
  "read_file",
  "list_dir",
  "web_search",
  "x_search",
  "save_artifact",
]);

/** Tools that mutate workspace or spend paid APIs aggressively */
export const WRITE_TOOLS = new Set([
  "write_file",
  "run_shell",
  "generate_image",
]);

const DANGEROUS_SHELL =
  /\b(rm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r)|mkfs|dd\s+if=|: \(\)\s*\{|curl\s+[^\n|]*\|\s*(ba)?sh|wget\s+[^\n|]*\|\s*(ba)?sh|shutdown|reboot|passwd\b)/i;

export function parsePermissionMode(raw: string | undefined): PermissionMode {
  const v = (raw ?? "default").toLowerCase().trim();
  if (v === "safe" || v === "dontask" || v === "strict") return "safe";
  if (v === "bypass" || v === "yolo" || v === "always-approve") return "bypass";
  return "default";
}

/**
 * Authorize a single tool call.
 * `argsJson` is inspected for run_shell dangerous patterns.
 */
export function authorizeTool(
  name: string,
  argsJson: string,
  cfg: PermissionConfig
): PermissionDecision {
  const deny = new Set(cfg.denyTools ?? []);
  const allow = new Set(cfg.allowTools ?? []);

  if (deny.has(name)) {
    return {
      allowed: false,
      reason: `Denied by denyTools: ${name}`,
      via: "deny_list",
    };
  }

  if (name === "run_shell") {
    let command = "";
    try {
      const args = JSON.parse(argsJson || "{}") as { command?: string };
      command = String(args.command ?? "");
    } catch {
      /* ignore */
    }
    if (command && DANGEROUS_SHELL.test(command)) {
      return {
        allowed: false,
        reason: `Blocked dangerous shell pattern: ${command.slice(0, 80)}`,
        via: "dangerous",
      };
    }
  }

  if (allow.has(name)) {
    return {
      allowed: true,
      reason: `Allowed by allowTools: ${name}`,
      via: "allow_list",
    };
  }

  const mode = cfg.mode ?? "default";

  if (mode === "bypass") {
    return {
      allowed: true,
      reason: "bypass mode — all tools allowed",
      via: "mode",
    };
  }

  if (mode === "safe") {
    if (READISH_TOOLS.has(name)) {
      return {
        allowed: true,
        reason: "safe mode — read-ish tool auto-allowed",
        via: "mode",
      };
    }
    return {
      allowed: false,
      reason: `safe mode — ${name} denied (add to allowTools or use --permission-mode default|bypass)`,
      via: "mode",
    };
  }

  // default: write + network tools ok; shell off unless allowlisted
  if (name === "run_shell") {
    return {
      allowed: false,
      reason:
        "default mode — run_shell denied (add allowTools: [\"run_shell\"] or --permission-mode bypass)",
      via: "mode",
    };
  }

  if (READISH_TOOLS.has(name) || WRITE_TOOLS.has(name)) {
    return {
      allowed: true,
      reason: `default mode — ${name} auto-allowed`,
      via: "mode",
    };
  }

  // unknown tools: deny in default/safe
  return {
    allowed: false,
    reason: `Unknown tool denied: ${name}`,
    via: "mode",
  };
}
