/**
 * agentmu doctor — non-destructive health report for auth, workspace, mode, skills.
 */

import fs from "node:fs";
import path from "node:path";
import {
  loadConfig,
  getApiKey,
  type AgentMuConfig,
} from "./config.js";
import {
  loadOAuthStore,
  resolveXaiCredentials,
  authStorePath,
  accessTokenIsExpiring,
} from "./oauth.js";
import { loadSkills } from "./skills.js";
import { EXIT_ERROR, EXIT_OK } from "./exit-codes.js";

export type DoctorCheck = {
  id: string;
  ok: boolean;
  level: "ok" | "warn" | "fail";
  message: string;
};

export type DoctorReport = {
  checks: DoctorCheck[];
  ok: boolean;
  exitCode: number;
};

export type DoctorOptions = {
  /**
   * When true, missing runtime credentials are a hard FAIL.
   * Default false so second users can pass doctor offline (eval/skills still work).
   */
  strict?: boolean;
};

export async function runDoctor(
  cwd = process.cwd(),
  opts: DoctorOptions = {}
): Promise<DoctorReport> {
  const strict = Boolean(opts.strict);
  const checks: DoctorCheck[] = [];
  const cfg = loadConfig(cwd);
  cfg.workspace = cwd;

  // workspace
  try {
    const st = fs.statSync(cfg.workspace);
    checks.push({
      id: "workspace",
      ok: st.isDirectory(),
      level: st.isDirectory() ? "ok" : "fail",
      message: st.isDirectory()
        ? `workspace readable: ${cfg.workspace}`
        : `workspace is not a directory: ${cfg.workspace}`,
    });
  } catch (e) {
    checks.push({
      id: "workspace",
      ok: false,
      level: "fail",
      message: `workspace unreadable: ${e instanceof Error ? e.message : e}`,
    });
  }

  // config
  const localCfg = path.join(cwd, ".agentmu", "config.json");
  checks.push({
    id: "config",
    ok: true,
    level: fs.existsSync(localCfg) ? "ok" : "warn",
    message: fs.existsSync(localCfg)
      ? `local config: ${localCfg}`
      : "no .agentmu/config.json — using defaults (run: agentmu init)",
  });

  // permission mode
  checks.push({
    id: "permission_mode",
    ok: true,
    level: "ok",
    message: `permissionMode=${cfg.permissionMode}; allowTools=[${cfg.allowTools.join(", ") || "—"}]; denyTools=[${cfg.denyTools.join(", ") || "—"}]`,
  });
  if (cfg.permissionMode === "bypass") {
    checks.push({
      id: "permission_bypass_warn",
      ok: true,
      level: "warn",
      message:
        "bypass mode allows shell — fine for trusted machines, risky for CI/untrusted repos",
    });
  }
  if (
    cfg.permissionMode === "default" &&
    !cfg.allowTools.includes("run_shell")
  ) {
    checks.push({
      id: "shell_default",
      ok: true,
      level: "ok",
      message: "run_shell denied by default (scorecard-safe)",
    });
  }

  // skills
  const skills = loadSkills(cfg.workspace);
  checks.push({
    id: "skills",
    ok: true,
    level: skills.length ? "ok" : "warn",
    message: skills.length
      ? `skills loaded: ${skills.map((s) => s.name).join(", ")}`
      : "no skills found (optional — add skills/*.md)",
  });

  // auth — API key
  const apiKey = getApiKey();
  checks.push({
    id: "api_key",
    ok: true,
    level: apiKey ? "ok" : "warn",
    message: apiKey
      ? "XAI_API_KEY/GROK_API_KEY set in env"
      : "no API key in env (ok if OAuth works)",
  });

  // auth — OAuth store
  const storePath = authStorePath();
  const store = loadOAuthStore(storePath);
  if (!store?.tokens?.access_token) {
    checks.push({
      id: "oauth_store",
      ok: true,
      level: "warn",
      message: `no OAuth session at ${storePath} (run: agentmu login)`,
    });
  } else {
    const expiring = accessTokenIsExpiring(store.tokens.access_token);
    checks.push({
      id: "oauth_store",
      ok: true,
      level: expiring ? "warn" : "ok",
      message: expiring
        ? `OAuth token present but near expiry (refresh on next resolve) — ${storePath}`
        : `OAuth session present — ${storePath}`,
    });
  }

  // runtime resolve (no network login)
  try {
    const creds = await resolveXaiCredentials();
    if (creds) {
      checks.push({
        id: "credentials_runtime",
        ok: true,
        level: "ok",
        message: `runtime credentials ready via ${creds.source}`,
      });
    } else {
      checks.push({
        id: "credentials_runtime",
        ok: !strict,
        level: strict ? "fail" : "warn",
        message: strict
          ? "no runtime credentials — agentmu login or set XAI_API_KEY (--strict)"
          : "no runtime credentials — offline OK (eval/doctor); login or XAI_API_KEY for chat/run",
      });
    }
  } catch (e) {
    checks.push({
      id: "credentials_runtime",
      ok: false,
      level: "fail",
      message: `credential resolve error: ${e instanceof Error ? e.message : e}`,
    });
  }

  // node version
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({
    id: "node",
    ok: major >= 20,
    level: major >= 20 ? "ok" : "fail",
    message: `node ${process.version} (need >= 20)`,
  });

  // sessions dir writable
  try {
    const sessions = path.join(cfg.workspace, "sessions");
    fs.mkdirSync(sessions, { recursive: true });
    const probe = path.join(sessions, ".doctor-write-probe");
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    checks.push({
      id: "sessions_writable",
      ok: true,
      level: "ok",
      message: `sessions/ writable under workspace`,
    });
  } catch (e) {
    checks.push({
      id: "sessions_writable",
      ok: false,
      level: "fail",
      message: `sessions/ not writable: ${e instanceof Error ? e.message : e}`,
    });
  }

  const failed = checks.some((c) => c.level === "fail");
  return {
    checks,
    ok: !failed,
    exitCode: failed ? EXIT_ERROR : EXIT_OK,
  };
}

export function formatDoctorReport(report: DoctorReport, cfg?: AgentMuConfig): string {
  const lines: string[] = ["AgentMu doctor", ""];
  if (cfg) {
    lines.push(`label=${cfg.label} model=${cfg.model}`);
    lines.push("");
  }
  for (const c of report.checks) {
    const mark =
      c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✗";
    lines.push(`${mark} [${c.id}] ${c.message}`);
  }
  lines.push("");
  lines.push(report.ok ? "Overall: OK" : "Overall: FAIL (see ✗ above)");
  return lines.join("\n");
}
