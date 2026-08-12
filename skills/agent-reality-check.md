---
name: agent-reality-check
description: When the user wants anti-hallucination verification, a reality check against live system state, or an independent Science audit before trusting agent claims
---

# Agent Reality Check

Sibling skill pack: **reality-check** (orchestrates live data collection + verification) and **science** (independent audit of claims vs evidence). Use when answers must be grounded in real commands/data before delivery.

## When to use

- Anti-hallucination / truth-pipeline requests
- "reality check", "verify against live state", Science 🧪 audit
- Catching assumptions, stale knowledge, or overconfident claims

## Canonical skill pack

Full skill trees live under `SKILLS/` in:

https://github.com/bentruongclub/agent-reality-check

- `SKILLS/reality-check/SKILL.md`
- `SKILLS/science/SKILL.md`

See also `WORKFLOW.md` and `EXAMPLE_AUDIT.md` in that repo.

## Install

Clone the pack, then run `install.sh` once it lands — or point at `SKILLS/` directly:

```bash
git clone https://github.com/bentruongclub/agent-reality-check.git
cd agent-reality-check
# Prefer when available:
# chmod +x install.sh && ./install.sh
# Or copy/symlink SKILLS/reality-check and SKILLS/science into your agent skills dir
# (e.g. ~/.agentmu/skills/ or ~/.hermes/skills/)
```
