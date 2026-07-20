import type OpenAI from "openai";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { webSearch } from "./web.js";
import { xSearch } from "./x_search.js";
import { generateImage } from "./image.js";

const execFileAsync = promisify(execFile);

export type ToolContext = {
  workspace: string;
};

export const toolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a text file relative to the workspace (or absolute path).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          offset: {
            type: "integer",
            description: "1-based start line (optional)",
          },
          limit: {
            type: "integer",
            description: "Max lines to return (optional, default 400)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write full contents to a file (creates parent dirs). Prefer for new files or full rewrites.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files and directories at a path (non-recursive by default).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path, default ." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_shell",
      description:
        "Run a shell command in the workspace. Use for builds, tests, git, etc. Avoid destructive commands unless asked.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          timeout_ms: {
            type: "integer",
            description: "Timeout in ms (default 120000)",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_artifact",
      description:
        "Save a named deliverable (artifact) under sessions/artifacts/ with a label. Use for final outputs the user should keep.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Short slug, e.g. summary-md or api-design",
          },
          content: { type: "string" },
          extension: {
            type: "string",
            description: "File extension without dot, default md",
          },
          label: {
            type: "string",
            description: "Optional human label (e.g. Artifact)",
          },
        },
        required: ["name", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the public web (Wikipedia by default; Brave/Tavily if API keys set). Use for facts, docs, current topics.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          max_results: { type: "integer", description: "1-10, default 5" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "x_search",
      description:
        "Search recent posts on X (Twitter). Requires X_BEARER_TOKEN. Returns post text and links.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "X advanced search query" },
          max_results: { type: "integer", description: "default 5" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image with xAI (requires XAI_API_KEY). Saves metadata under sessions/artifacts/images.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
        },
        required: ["prompt"],
      },
    },
  },
];

/** Tool names exposed for tests and capability checks */
export const TOOL_NAMES = toolDefinitions.map((t) =>
  t.type === "function" ? t.function.name : ""
).filter(Boolean);

function resolveSafe(workspace: string, p: string): string {
  const abs = path.isAbsolute(p) ? path.normalize(p) : path.resolve(workspace, p);
  const root = path.resolve(workspace);
  // Require relative paths (and absolute that stay under workspace) to stay in workspace
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return abs;
}

export async function runTool(
  name: string,
  argsJson: string,
  ctx: ToolContext
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    return `Invalid JSON arguments: ${argsJson}`;
  }

  try {
    switch (name) {
      case "read_file": {
        const filePath = resolveSafe(ctx.workspace, String(args.path ?? ""));
        const raw = await fs.readFile(filePath, "utf8");
        const lines = raw.split("\n");
        const offset = Math.max(1, Number(args.offset ?? 1));
        const limit = Math.min(2000, Math.max(1, Number(args.limit ?? 400)));
        const slice = lines.slice(offset - 1, offset - 1 + limit);
        const numbered = slice
          .map((l, i) => `${String(offset + i).padStart(5)}|${l}`)
          .join("\n");
        const more =
          offset - 1 + limit < lines.length
            ? `\n… (${lines.length - (offset - 1 + limit)} more lines)`
            : "";
        return numbered + more || "(empty file)";
      }
      case "write_file": {
        const filePath = resolveSafe(ctx.workspace, String(args.path ?? ""));
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, String(args.content ?? ""), "utf8");
        return `Wrote ${filePath} (${Buffer.byteLength(String(args.content ?? ""), "utf8")} bytes)`;
      }
      case "list_dir": {
        const dirPath = resolveSafe(ctx.workspace, String(args.path ?? "."));
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return (
          entries
            .map((e) => `${e.isDirectory() ? "dir " : "file"} ${e.name}`)
            .join("\n") || "(empty)"
        );
      }
      case "run_shell": {
        const command = String(args.command ?? "");
        if (!command.trim()) return "Empty command";
        const timeout = Math.min(
          600_000,
          Math.max(1_000, Number(args.timeout_ms ?? 120_000))
        );
        try {
          const { stdout, stderr } = await execFileAsync(
            "bash",
            ["-lc", command],
            {
              cwd: ctx.workspace,
              timeout,
              maxBuffer: 2 * 1024 * 1024,
              env: process.env,
            }
          );
          const out = [stdout, stderr].filter(Boolean).join("\n").trim();
          return out.slice(0, 80_000) || "(no output)";
        } catch (err: unknown) {
          const e = err as {
            stdout?: string;
            stderr?: string;
            message?: string;
            code?: number;
          };
          const out = [e.stdout, e.stderr, e.message]
            .filter(Boolean)
            .join("\n")
            .trim();
          return `exit ${e.code ?? 1}\n${out}`.slice(0, 80_000);
        }
      }
      case "save_artifact": {
        const nameSlug =
          String(args.name ?? "artifact")
            .replace(/[^a-zA-Z0-9._-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80) || "artifact";
        const ext = String(args.extension ?? "md").replace(/^\./, "") || "md";
        const label = args.label ? String(args.label) : undefined;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const dir = path.join(ctx.workspace, "sessions", "artifacts");
        await fs.mkdir(dir, { recursive: true });
        const file = path.join(dir, `${stamp}_${nameSlug}.${ext}`);
        const header =
          label != null
            ? `<!-- agentmu-artifact label="${label}" name="${nameSlug}" -->\n\n`
            : `<!-- agentmu-artifact name="${nameSlug}" -->\n\n`;
        await fs.writeFile(file, header + String(args.content ?? ""), "utf8");
        return `Artifact saved: ${file}${label ? ` (label: ${label})` : ""}`;
      }
      case "web_search": {
        return await webSearch(String(args.query ?? ""), {
          maxResults: args.max_results != null ? Number(args.max_results) : 5,
        });
      }
      case "x_search": {
        return await xSearch(String(args.query ?? ""), {
          maxResults: args.max_results != null ? Number(args.max_results) : 5,
        });
      }
      case "generate_image": {
        return await generateImage(String(args.prompt ?? ""), {
          workspace: ctx.workspace,
        });
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Tool error (${name}): ${msg}`;
  }
}
