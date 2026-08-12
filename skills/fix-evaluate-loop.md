---
name: fix-evaluate-loop
description: When the user asks to fix and verify, loop until done, keep fixing until it works, or evaluate after fixing — especially for bots, services, and pipelines needing runtime proof
---

# Fix → Evaluate → Loop

Orchestrate a completion loop: define DONE → fix → evaluate with independent evidence (logs, tests, runtime) → repeat until DONE or BLOCKED. Do not declare victory after a code change alone.

## When to use

- "fix and verify", "loop until done", "keep fixing until it works", `/fix-evaluate-loop`, `/until-done`, `/fix-loop`
- Runtime bugs on bots, services, tunnels, APIs, or multi-step pipelines

## Canonical skill (full instructions)

Full `SKILL.md`, examples, and references live in:

https://github.com/bentruongclub/fix-evaluate-loop

## Install

```bash
git clone https://github.com/bentruongclub/fix-evaluate-loop.git
cd fix-evaluate-loop
chmod +x install.sh
./install.sh                # → ~/.grok/skills/fix-evaluate-loop
# ./install.sh --target cursor
# ./install.sh --target project
# ./install.sh --target all
```

After install, follow the full `SKILL.md` (Done Checklist → Fix → Evaluate → Decide; default cap 8 rounds). See also `EXAMPLES.md` in that repo.
