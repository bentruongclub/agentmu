#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  defaultConfig,
  displayName,
  loadConfig,
  saveConfig,
  getApiKey,
  type AgentMuConfig,
} from "./config.js";
import { banner, promptPrefix } from "./identity.js";
import {
  loadSession,
  printEvent,
  runAgent,
  type ChatMessage,
} from "./agent.js";
import { parsePermissionMode } from "./permissions.js";
import { loadSkills, skillsSummaryLine } from "./skills.js";
import {
  classifyRunExit,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_PERMISSION,
} from "./exit-codes.js";
import {
  clearOAuthStore,
  loadOAuthStore,
  loginWithBrowser,
  oauthStatusSummary,
  resolveXaiCredentials,
} from "./oauth.js";
import { formatDoctorReport, runDoctor } from "./doctor.js";
import { formatEvalSuite, runEvalSuite } from "./eval/runner.js";

const VERSION = "0.5.1";

function usage(): string {
  return `
AgentMu v${VERSION} — local Grok agent harness (Artifact)

Usage:
  agentmu init [--label NAME] [--model MODEL] [--permission-mode MODE]
  agentmu label <NAME>                          Set instance label (e.g. Artifact)
  agentmu whoami                                Product + label + auth status
  agentmu doctor [--strict]                     Health check (auth optional unless --strict)
  agentmu eval                                  Offline tool eval suite (no API)
  agentmu login [--no-browser]                  SuperGrok / X Premium+ OAuth
  agentmu logout                                Clear stored OAuth tokens
  agentmu skills                                List markdown skills
  agentmu chat [session-id]                     Interactive REPL
  agentmu run "<prompt>" [flags]                One-shot prompt (CI exit codes)
  agentmu help                                  This help

Permission modes:
  safe      Read-ish only (read/list/search/save_artifact)
  default   Write ok; run_shell OFF unless allowTools (default)
  bypass    All tools (still blocks dangerous shell patterns)

Flags:
  --permission-mode <safe|default|bypass>
  --allow-tool <name>     Repeatable; e.g. --allow-tool run_shell

Exit codes (agentmu run):
  0  ok
  1  error / fatal
  2  completed with permission-denied tools only (no successful tool)

Skills: workspace/skills, .agentmu/skills, ~/.agentmu/skills

Auth: agentmu login | XAI_API_KEY

Sessions:
  sessions/<id>.json           chat messages
  sessions/<id>.events.jsonl   audit journal (secrets redacted)

Examples:
  agentmu doctor
  agentmu eval
  agentmu run "Summarize README" --permission-mode safe
  agentmu chat
`.trim();
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0] ?? "help";

  switch (cmd) {
    case "help":
    case "-h":
    case "--help":
      console.log(usage());
      return;
    case "version":
    case "-v":
    case "--version":
      console.log(`agentmu ${VERSION}`);
      return;
    case "init":
      await cmdInit(argv.slice(1));
      return;
    case "label":
      await cmdLabel(argv.slice(1));
      return;
    case "whoami":
      await cmdWhoami();
      return;
    case "login":
    case "grok-login":
      await cmdLogin(argv.slice(1));
      return;
    case "logout":
      cmdLogout();
      return;
    case "skills":
      cmdSkills();
      return;
    case "doctor":
      await cmdDoctor(argv.slice(1));
      return;
    case "eval":
      await cmdEval();
      return;
    case "chat":
      await cmdChat(argv.slice(1));
      return;
    case "run":
      await cmdRun(argv.slice(1));
      return;
    default:
      if (cmd.startsWith("-")) {
        console.error(`Unknown option: ${cmd}\n\n${usage()}`);
        process.exit(1);
      }
      console.error(`Unknown command: ${cmd}\n\n${usage()}`);
      process.exit(1);
  }
}

function parseFlags(args: string[]): {
  flags: Record<string, string | boolean>;
  rest: string[];
} {
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      rest.push(a);
    }
  }
  return { flags, rest };
}

async function cmdInit(args: string[]): Promise<void> {
  const { flags } = parseFlags(args);
  const existing = loadConfig();
  const label =
    (typeof flags.label === "string" && flags.label) ||
    existing.label ||
    "Artifact";
  const model =
    (typeof flags.model === "string" && flags.model) ||
    existing.model ||
    "grok-4.5";
  const permissionMode = parsePermissionMode(
    typeof flags["permission-mode"] === "string"
      ? flags["permission-mode"]
      : existing.permissionMode
  );

  const cfg = defaultConfig({
    ...existing,
    label,
    model,
    permissionMode,
    workspace: process.cwd(),
    createdAt: existing.createdAt,
  });
  const file = saveConfig(cfg, "local");
  console.log(banner(cfg, VERSION));
  console.log(`\nConfig written: ${file}`);
  console.log(`Labeled as: ${cfg.label}`);
  console.log(`Permission mode: ${cfg.permissionMode} (shell off unless allowTools)`);
  const creds = await resolveXaiCredentials().catch(() => null);
  if (!creds) {
    console.log(
      "\nAuth: not configured yet.\n" +
        "  agentmu login          # SuperGrok / X Premium+ (your subscription)\n" +
        "  or set XAI_API_KEY     # https://console.x.ai"
    );
  } else {
    console.log(`\nAuth: ${creds.source} ready. Start with: agentmu chat`);
  }
}

/** Apply CLI permission flags onto config (mutates). */
function applyPermissionFlags(
  cfg: AgentMuConfig,
  flags: Record<string, string | boolean>,
  restArgs: string[]
): void {
  if (typeof flags["permission-mode"] === "string") {
    cfg.permissionMode = parsePermissionMode(flags["permission-mode"]);
  }
  // Support repeated --allow-tool by scanning raw argv-style rest is not enough;
  // parseFlags only keeps last. Re-scan process.argv for all --allow-tool.
  const allows: string[] = [...cfg.allowTools];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--allow-tool" && argv[i + 1]) {
      allows.push(argv[i + 1]!);
      i++;
    }
  }
  if (allows.length) cfg.allowTools = [...new Set(allows)];
  void restArgs;
}

async function cmdLabel(args: string[]): Promise<void> {
  const name = args.join(" ").trim();
  if (!name) {
    console.error(
      "Usage: agentmu label <NAME>\nExample: agentmu label Artifact"
    );
    process.exit(1);
  }
  const cfg = loadConfig();
  cfg.label = name;
  cfg.workspace = process.cwd();
  const file = saveConfig(cfg, "local");
  console.log(`${displayName(cfg)}`);
  console.log(`Label set to "${name}" → ${file}`);
}

async function cmdWhoami(): Promise<void> {
  const cfg = loadConfig();
  cfg.workspace = process.cwd();
  console.log(banner(cfg, VERSION));
  console.log(`display : ${displayName(cfg)}`);
  console.log(`workspace: ${cfg.workspace}`);
  console.log(`permission: ${cfg.permissionMode}`);
  console.log(skillsSummaryLine(loadSkills(cfg.workspace)));
  if (cfg.allowTools.length) {
    console.log(`allowTools: ${cfg.allowTools.join(", ")}`);
  }
  if (cfg.denyTools.length) {
    console.log(`denyTools : ${cfg.denyTools.join(", ")}`);
  }
  console.log(`api key : ${getApiKey() ? "set (env)" : "not set"}`);
  console.log(`        ${oauthStatusSummary()}`);
  try {
    const creds = await resolveXaiCredentials();
    if (creds) {
      console.log(`runtime : ${creds.source} → ready`);
    } else {
      console.log(`runtime : no credentials (agentmu login or XAI_API_KEY)`);
    }
  } catch (e) {
    console.log(
      `runtime : oauth error — ${e instanceof Error ? e.message : e}`
    );
  }
}

async function cmdLogin(args: string[]): Promise<void> {
  const { flags } = parseFlags(args);
  const noBrowser = Boolean(flags["no-browser"]);
  loadConfig(); // load .env
  const existing = loadOAuthStore();
  if (existing?.tokens?.access_token) {
    console.log("Existing SuperGrok OAuth session found.");
    console.log("Continuing will replace it with a new login.");
  }
  console.log("");
  console.log("AgentMu OAuth — each person uses their own SuperGrok / X Premium+.");
  console.log("This does not share your subscription with other machines unless they log in.");
  console.log("");
  try {
    await loginWithBrowser({
      openBrowser: !noBrowser,
      timeoutMs: 300_000,
    });
    console.log("");
    console.log("Login successful. You can now:");
    console.log("  agentmu whoami");
    console.log("  agentmu chat");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

function cmdLogout(): void {
  const ok = clearOAuthStore();
  if (ok) console.log("Logged out — OAuth tokens removed.");
  else console.log("No OAuth session stored.");
}

function cmdSkills(): void {
  const cfg = loadConfig();
  cfg.workspace = process.cwd();
  const skills = loadSkills(cfg.workspace);
  if (skills.length === 0) {
    console.log("No skills found.");
    console.log("Add markdown files under:");
    console.log("  ./skills/");
    console.log("  ./.agentmu/skills/");
    console.log("  ~/.agentmu/skills/");
    console.log("See skills/README.md for the format.");
    return;
  }
  console.log(skillsSummaryLine(skills));
  console.log("");
  for (const s of skills) {
    console.log(`• ${s.name}`);
    console.log(`  ${s.description}`);
    console.log(`  ${s.sourcePath}`);
  }
}

async function cmdDoctor(args: string[]): Promise<void> {
  const { flags } = parseFlags(args);
  const strict = Boolean(flags.strict);
  const cfg = loadConfig();
  cfg.workspace = process.cwd();
  const report = await runDoctor(cfg.workspace, { strict });
  console.log(formatDoctorReport(report, cfg));
  if (!strict && report.checks.some((c) => c.id === "credentials_runtime" && c.level === "warn")) {
    console.log("\nTip: offline path is fine. For live chat/run: agentmu login  or  export XAI_API_KEY=...");
    console.log("     CI/auth gate: agentmu doctor --strict");
  }
  if (report.exitCode !== EXIT_OK) process.exit(report.exitCode);
}

async function cmdEval(): Promise<void> {
  console.log(`AgentMu eval v${VERSION} (offline, fake model)\n`);
  const suite = await runEvalSuite();
  console.log(formatEvalSuite(suite));
  if (suite.exitCode !== EXIT_OK) process.exit(suite.exitCode);
}

async function cmdRun(args: string[]): Promise<void> {
  const { flags, rest } = parseFlags(args);
  const prompt = rest.join(" ").trim();
  if (!prompt) {
    console.error(
      'Usage: agentmu run "<prompt>" [--permission-mode MODE] [--allow-tool NAME]'
    );
    process.exit(EXIT_ERROR);
  }
  const cfg = loadConfig();
  cfg.workspace = process.cwd();
  applyPermissionFlags(cfg, flags, rest);
  try {
    await ensureCreds();
  } catch {
    process.exit(EXIT_ERROR);
  }
  // ensureCreds already exits 1; keep try for future throws
  console.log(banner(cfg, VERSION));
  console.log(`permission: ${cfg.permissionMode}`);
  const skills = loadSkills(cfg.workspace);
  console.log(skillsSummaryLine(skills));
  const sessionId = `run-${Date.now()}`;
  try {
    const { stats } = await runAgent({
      cfg,
      userMessage: prompt,
      sessionId,
      onEvent: (e) => printEvent(cfg, e),
    });
    console.log(`\n(session: sessions/${sessionId}.json)`);
    console.log(`(journal: sessions/${sessionId}.events.jsonl)`);
    const code = classifyRunExit(stats);
    if (code === EXIT_PERMISSION) {
      console.log(
        `(exit ${EXIT_PERMISSION}: permission denied only — no successful tool)`
      );
    }
    process.exitCode = code;
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(EXIT_ERROR);
  }
}

async function cmdChat(args: string[]): Promise<void> {
  const { flags, rest } = parseFlags(args);
  const cfg = loadConfig();
  cfg.workspace = process.cwd();
  applyPermissionFlags(cfg, flags, rest);
  await ensureCreds();
  const sessionId =
    rest[0] || `chat-${new Date().toISOString().slice(0, 10)}`;
  let messages: ChatMessage[] | undefined =
    loadSession(cfg, sessionId) ?? undefined;

  console.log(banner(cfg, VERSION));
  console.log(`session: ${sessionId}`);
  console.log(`permission: ${cfg.permissionMode}`);
  console.log(skillsSummaryLine(loadSkills(cfg.workspace)));
  console.log(
    `Type /quit · /whoami · /skills · /label NAME · /mode safe|default|bypass · /allow run_shell\n`
  );

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const line = (await rl.question(`${promptPrefix(cfg)} you> `)).trim();
      if (!line) continue;
      if (line === "/quit" || line === "/exit") break;
      if (line === "/whoami") {
        await cmdWhoami();
        continue;
      }
      if (line.startsWith("/label ")) {
        const name = line.slice("/label ".length).trim();
        if (name) {
          cfg.label = name;
          saveConfig(cfg, "local");
          console.log(
            `Label → ${name} (new system identity on next fresh session)`
          );
        }
        continue;
      }
      if (line.startsWith("/mode ")) {
        const m = parsePermissionMode(line.slice("/mode ".length).trim());
        cfg.permissionMode = m;
        console.log(`Permission mode → ${m}`);
        continue;
      }
      if (line.startsWith("/allow ")) {
        const tool = line.slice("/allow ".length).trim();
        if (tool && !cfg.allowTools.includes(tool)) {
          cfg.allowTools = [...cfg.allowTools, tool];
        }
        console.log(`allowTools → ${cfg.allowTools.join(", ") || "(none)"}`);
        continue;
      }
      if (line === "/skills") {
        cmdSkills();
        continue;
      }

      const result = await runAgent({
        cfg,
        messages,
        userMessage: line,
        sessionId,
        onEvent: (e) => printEvent(cfg, e),
      });
      messages = result.messages;
    }
  } finally {
    rl.close();
  }
  console.log("bye.");
}

async function ensureCreds(): Promise<void> {
  loadConfig();
  try {
    const creds = await resolveXaiCredentials();
    if (creds) return;
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  console.error(
    "No xAI credentials.\n" +
      "  agentmu login                 # SuperGrok / X Premium+ (your own subscription)\n" +
      "  export XAI_API_KEY=...        # or API key from https://console.x.ai"
  );
  process.exit(1);
}

void (null as unknown as AgentMuConfig);

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
