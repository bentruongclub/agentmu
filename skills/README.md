# AgentMu skills

Drop markdown files here to extend the agent without changing core code.

## Locations (first wins on name conflict)

1. `./skills/**/*.md` (this folder)
2. `./.agentmu/skills/**/*.md`
3. `~/.agentmu/skills/**/*.md`

`README.md` files are ignored.

## Format

Optional YAML frontmatter + body:

```markdown
---
name: my-skill
description: One-line when to use this skill
---

# My skill

Instructions the model should follow when the user task matches…
```

Without frontmatter, the filename becomes `name` and the first `# heading` becomes `description`.

## List skills

```bash
agentmu skills
```

Skills are injected into the system prompt (budgeted) on every new agent run.

## Catalog

| Skill | Description | Canonical repo |
|-------|-------------|----------------|
| `hello-artifact` | Quick AgentMu smoke check / "hello artifact" greeting | (local) `skills/hello-artifact.md` |
| `fix-evaluate-loop` | Fix → evaluate → repeat until the task is actually done | https://github.com/bentruongclub/fix-evaluate-loop |
| `agent-reality-check` | Anti-hallucination pack: reality-check + science audit | https://github.com/bentruongclub/agent-reality-check |

Pointer skills above link out for install/clone; they do not vendor the full skill trees.
