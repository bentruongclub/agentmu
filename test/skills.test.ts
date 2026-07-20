import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadSkills,
  parseSkillMarkdown,
  formatSkillsForPrompt,
} from "../src/skills.js";
import { runAgent, type CompletionProvider } from "../src/agent.js";
import { defaultConfig } from "../src/config.js";

describe("skills loader", () => {
  it("parseSkillMarkdown reads frontmatter", () => {
    const s = parseSkillMarkdown(
      `---
name: Demo-Skill
description: Does a thing
---

# Title

Body here.
`,
      "fallback",
      "/tmp/x.md"
    );
    assert.equal(s.name, "demo-skill");
    assert.equal(s.description, "Does a thing");
    assert.match(s.body, /Body here/);
  });

  it("loadSkills discovers workspace skills/", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-skills-"));
    try {
      const skillsDir = path.join(dir, "skills");
      fs.mkdirSync(skillsDir);
      fs.writeFileSync(
        path.join(skillsDir, "demo.md"),
        `---
name: demo
description: Demo skill
---
Follow demo steps.
`,
        "utf8"
      );
      fs.writeFileSync(
        path.join(skillsDir, "README.md"),
        "# ignored",
        "utf8"
      );
      const skills = loadSkills(dir);
      assert.ok(skills.some((s) => s.name === "demo"));
      assert.ok(!skills.some((s) => s.name === "readme"));
      const block = formatSkillsForPrompt(skills);
      assert.match(block, /skill:demo/);
      assert.match(block, /Follow demo steps/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runAgent injects skills into system message", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-skills-run-"));
    try {
      const skillsDir = path.join(dir, "skills");
      fs.mkdirSync(skillsDir);
      fs.writeFileSync(
        path.join(skillsDir, "inject.md"),
        `---
name: inject-me
description: Must appear in system prompt
---
UNIQUE_SKILL_TOKEN_XYZ
`,
        "utf8"
      );

      let sawSystem = "";
      const complete: CompletionProvider = async (req) => {
        const sys = req.messages.find((m) => m.role === "system");
        sawSystem = String(sys?.content ?? "");
        return {
          message: { role: "assistant", content: "ok" },
        };
      };

      const cfg = defaultConfig({ workspace: dir, model: "fake" });
      const { skills } = await runAgent({
        cfg,
        userMessage: "hi",
        complete,
      });
      assert.ok(skills.some((s) => s.name === "inject-me"));
      assert.match(sawSystem, /UNIQUE_SKILL_TOKEN_XYZ/);
      assert.match(sawSystem, /skill:inject-me/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
