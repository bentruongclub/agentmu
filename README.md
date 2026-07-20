# AgentMu · Artifact

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Local open-source **multi-tool agent harness** (Grok / SpaceXAI): code tools, web search, X search, image generation — on your machine.

**Repo:** https://github.com/bentruongclub/agentmu

**v0.5** — Builder’s Scorecard track (permissions, journal, skills, doctor, offline eval, second-user playbook).

| Doc | Purpose |
|-----|---------|
| [SECOND_USER.md](./SECOND_USER.md) | **Week 4** — hand this to a friend |
| [SCORECARD.md](./SCORECARD.md) | Live 0–40 score vs infrastructure criteria |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting (private) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev setup + PR ground rules |
| [DATA_PLANE.md](./DATA_PLANE.md) | What stays local / what leaves |
| [ROADMAP.md](./ROADMAP.md) | Weeks 1–4 |
| [CHANGELOG.md](./CHANGELOG.md) | Semver history |
| [skills/README.md](./skills/README.md) | Markdown skills |

**Product:** AgentMu · **Default label:** Artifact  

Requires **Node.js 20+**.

---

## Quick start (two phases)

### Phase 1 — Offline (no API key)

Anyone can verify the harness without xAI credentials:

```bash
cd AgentMu          # directory that contains package.json
npm install
npm run build

npx tsx src/index.ts init --label Artifact
npx tsx src/index.ts doctor     # Overall OK without keys (warn only)
npx tsx src/index.ts eval       # offline 5/5, fake model
npx tsx src/index.ts skills
npm test
```

### Phase 2 — Live model (your subscription or key)

```bash
# Option A — SuperGrok / X Premium+ (your account)
npx tsx src/index.ts login

# Option B — API key
cp .env.example .env   # set XAI_API_KEY from https://console.x.ai

npx tsx src/index.ts whoami
npx tsx src/index.ts doctor --strict   # fails if still no credentials
npx tsx src/index.ts run "Reply in one sentence: who are you?"
npx tsx src/index.ts chat
```

### Optional: `agentmu` on PATH

```bash
npm run build && npm link
agentmu doctor
agentmu eval
agentmu run "…"
```

### Multi-user auth

OAuth is **per machine / home directory**. Each person runs `agentmu login` with **their** account. Do not share `~/.agentmu/auth.json` or passwords.

---

## Commands

| Command | Purpose |
|---------|---------|
| `init` / `label` / `whoami` | Config + identity |
| `login` / `logout` | OAuth |
| `doctor [--strict]` | Health (auth soft unless `--strict`) |
| `eval` | Offline tool eval suite |
| `skills` | List markdown skills |
| `run "…"` | One-shot (exit `0` / `1` / `2`) |
| `chat` | Interactive REPL |

Chat helpers: `/quit` · `/whoami` · `/skills` · `/label NAME` · `/mode safe\|default\|bypass` · `/allow run_shell`

---

## Permissions (defaults are intentional)

| Mode | Shell | Write | Read / search / artifacts |
|------|-------|-------|---------------------------|
| **default** | Off* | On | On |
| **safe** | Off* | Off* | On |
| **bypass** | On† | On | On |

\* Unless in `allowTools` · † Still blocks `rm -rf /`-class patterns  

```bash
npx tsx src/index.ts run "explore" --permission-mode safe
npx tsx src/index.ts run "run tests" --allow-tool run_shell
```

---

## Tools

| Tool | Purpose | Credentials |
|------|---------|-------------|
| `read_file` / `write_file` / `list_dir` / `run_shell` | Workspace | — |
| `save_artifact` | `sessions/artifacts/` | — |
| `web_search` | Public web | optional Brave/Tavily |
| `x_search` | Recent X posts | `X_BEARER_TOKEN` |
| `generate_image` | xAI images | API / OAuth |

Missing credentials → **explicit errors** (no silent no-op).

---

## Sessions & journal

| File | Role |
|------|------|
| `sessions/<id>.json` | Messages for resume |
| `sessions/<id>.events.jsonl` | Audit log (**secrets redacted**) |

---

## Headless exit codes (`run`)

| Code | Meaning |
|------|---------|
| 0 | OK |
| 1 | Error / fatal |
| 2 | Only permission denials (no successful tool) |

---

## Layout

```
AgentMu/
  src/           CLI, agent loop, permissions, journal, skills, doctor, eval
  skills/        Markdown extensions
  test/          node:test suite
  sessions/      created at runtime
  .agentmu/      local config after init
```

---

## Env

| Variable | Purpose |
|----------|---------|
| `XAI_API_KEY` | API key if not using OAuth |
| `AGENTMU_AUTH_PATH` | Override OAuth store path |
| `AGENTMU_LABEL` / `AGENTMU_MODEL` | Defaults |
| `AGENTMU_PERMISSION_MODE` | `safe` \| `default` \| `bypass` |
| `X_BEARER_TOKEN` | X search |
| `BRAVE_API_KEY` / `TAVILY_API_KEY` | Richer web search |

OAuth: PKCE loopback `http://127.0.0.1:56121/callback`. Some SuperGrok tiers may 403 OAuth API — use API key then.

---

## Semver

See [CHANGELOG.md](./CHANGELOG.md). **MAJOR** breaking CLI/config/journal · **MINOR** features · **PATCH** fixes/docs.

## Not AgenC

Independent harness (MIT). Same *local multi-tool* idea; different product.

## License

MIT
