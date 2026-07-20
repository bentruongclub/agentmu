/**
 * Markdown skill loader — lightweight extension surface.
 *
 * Discovery order (first name wins):
 *   1. workspace/skills/ (recursive .md)
 *   2. workspace/.agentmu/skills/
 *   3. home/.agentmu/skills/
 *
 * Format: optional YAML frontmatter (name, description) + markdown body.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type Skill = {
  name: string;
  description: string;
  body: string;
  sourcePath: string;
};

const MAX_SKILLS_IN_PROMPT = 12;
const MAX_BODY_CHARS = 6_000;

function walkMdFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      walkMdFiles(full, out);
    } else if (e.isFile() && e.name.endsWith(".md") && e.name.toLowerCase() !== "readme.md") {
      out.push(full);
    }
  }
  return out;
}

function skillDirs(workspace: string): string[] {
  return [
    path.join(workspace, "skills"),
    path.join(workspace, ".agentmu", "skills"),
    path.join(os.homedir(), ".agentmu", "skills"),
  ];
}

/** Parse optional --- frontmatter --- and body. */
export function parseSkillMarkdown(
  raw: string,
  fallbackName: string,
  sourcePath: string
): Skill {
  let name = fallbackName;
  let description = "";
  let body = raw.trim();

  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end !== -1) {
      const fm = raw.slice(3, end).trim();
      body = raw.slice(end + 4).trim();
      for (const line of fm.split("\n")) {
        const m = line.match(/^(\w+)\s*:\s*(.*)$/);
        if (!m) continue;
        const key = m[1]!.toLowerCase();
        const val = m[2]!.trim().replace(/^["']|["']$/g, "");
        if (key === "name" && val) name = val;
        if (key === "description" && val) description = val;
      }
    }
  }

  if (!description) {
    const h1 = body.match(/^#\s+(.+)$/m);
    description = h1?.[1]?.trim() ?? `Skill: ${name}`;
  }

  // slug-safe name
  name = name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallbackName;

  return { name, description, body, sourcePath };
}

export function loadSkills(workspace: string): Skill[] {
  const byName = new Map<string, Skill>();
  for (const dir of skillDirs(workspace)) {
    for (const file of walkMdFiles(dir)) {
      try {
        const raw = fs.readFileSync(file, "utf8");
        const base = path.basename(file, ".md");
        const skill = parseSkillMarkdown(raw, base, file);
        if (!byName.has(skill.name)) {
          byName.set(skill.name, skill);
        }
      } catch {
        /* skip unreadable */
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Build a system-prompt fragment listing skills and including bodies (budgeted).
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const selected = skills.slice(0, MAX_SKILLS_IN_PROMPT);
  const lines: string[] = [
    "Skills (follow when the user task matches; treat body as instructions)",
    "",
  ];

  for (const s of selected) {
    lines.push(`### skill:${s.name}`);
    lines.push(s.description);
    const body =
      s.body.length > MAX_BODY_CHARS
        ? s.body.slice(0, MAX_BODY_CHARS) + "\n…(truncated)"
        : s.body;
    lines.push(body);
    lines.push("");
  }

  if (skills.length > MAX_SKILLS_IN_PROMPT) {
    lines.push(
      `(+${skills.length - MAX_SKILLS_IN_PROMPT} more skills not inlined — name them to prioritize later)`
    );
  }

  return lines.join("\n").trim();
}

export function skillsSummaryLine(skills: Skill[]): string {
  if (skills.length === 0) return "skills: (none — add skills/*.md)";
  return `skills: ${skills.map((s) => s.name).join(", ")}`;
}
