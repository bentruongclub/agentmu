---
name: plugin-load-check
description: When the user asks to test a Cursor / Agent Plugin locally, prove a plugin loads, install a plugin locally, or debug why Cursor doesn't show their plugin — PASS/FAIL evidence, not "should work"
---

# Plugin Load Check

Prove a Cursor Plugin or Agent Plugin loads locally: manifest + JSON + kebab-case name → Agent Plugin schema → referenced skills/rules/MCP files exist → `node --check` the stdio server → install as a real directory under `~/.cursor/plugins/local/<name>` → optional loader. Report each check as PASS / FAIL / SKIP, and say plainly that IDE reload and org policy can't be proven from a shell.

## When to use

- "test my plugin locally", "prove the plugin loads", "install this plugin locally", `/plugin-load-check`
- Cursor doesn't show a plugin you just wrote, or before submitting one to a marketplace

## Canonical skill (full instructions)

Full `SKILL.md`, `scripts/check-plugin.sh`, and examples live in:

https://github.com/bentruongclub/plugin-load-check

## Install

```bash
git clone https://github.com/bentruongclub/plugin-load-check.git
cd plugin-load-check
chmod +x install.sh
./install.sh                # → ~/.grok/skills/plugin-load-check
# ./install.sh --target cursor
# ./install.sh --target project
# ./install.sh --target all
```

After install, run `scripts/check-plugin.sh <plugin-dir> [--install] [--home DIR]` and paste its output as-is. `--install` defaults to a temp home, so it won't touch your real `~/.cursor` unless you pass `--home "$HOME"`. See also `EXAMPLES.md` in that repo.
