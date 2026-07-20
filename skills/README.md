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
