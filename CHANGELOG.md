# Changelog

AgentMu follows **semver** for the package version in `package.json`.

| Bump | When |
|------|------|
| **MAJOR** | Breaking CLI flags, config shape, or journal event contract |
| **MINOR** | New capabilities (skills, tools, modes) backward-compatible |
| **PATCH** | Fixes, docs, tests |

## 0.5.1 — Public remote + security policy

### Added
- [SECURITY.md](./SECURITY.md) — private vulnerability reporting
- [CONTRIBUTING.md](./CONTRIBUTING.md) — PR / dev ground rules
- [LICENSE](./LICENSE) — MIT
- Git repository + GitHub remote

## 0.5.0 — Week 4 (second-user path)

### Added
- [SECOND_USER.md](./SECOND_USER.md) — host + guest playbook
- [SCORECARD.md](./SCORECARD.md) — full re-score (~30/40)
- README two-phase quick start (offline first, then live auth)

### Changed
- `agentmu doctor` — missing credentials are **warn** by default; use `--strict` to fail
- Onboarding no longer requires API key to “pass” doctor

## 0.4.0 — Week 3 (reliability)

### Added
- `agentmu doctor` — auth, workspace, permission mode, skills, sessions writable
- `agentmu eval` — offline eval suite (5 cases, fake model, no network)
- Journal **secret redaction** (`src/redact.ts`) for keys/tokens in event previews
- npm scripts: `npm run eval`, `npm run doctor`

### Changed
- Version banner default 0.4.0

## 0.3.0 — Week 2 (extensions + headless contract)

### Added
- Markdown **skills** loader (`skills/`, `.agentmu/skills/`, `~/.agentmu/skills/`)
- `agentmu skills` and chat `/skills`
- Skills injected into system prompt (budgeted)
- **Exit codes** for `agentmu run`: `0` ok, `1` error, `2` permission-denied-only
- Example skill `skills/hello-artifact.md`
- Semver policy (this file + README)

### Changed
- Banner shows version + permission mode
- `runAgent` returns `{ stats, skills }` for CI / tests

## 0.2.0 — Week 1 (permissions + journal)

### Added
- Permission modes: `safe` | `default` | `bypass`
- Shell off by default; dangerous shell pattern block
- Session event journal `sessions/<id>.events.jsonl`
- `DATA_PLANE.md`, `ROADMAP.md`
- CLI `--permission-mode`, `--allow-tool`; chat `/mode`, `/allow`

## 0.1.0 — Initial harness

- CLI: init, login/logout, chat, run
- Tools: workspace, web, X, image, artifacts
- OAuth + API key auth
- Injectable completion provider + tests
