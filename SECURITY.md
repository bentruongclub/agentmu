# Security Policy

AgentMu is a **local agent harness** that can read/write files and (when allowed) run shell commands. Treat it like giving a trusted assistant access to a workspace — not like a sandboxed chat widget.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.5.x   | Yes — current |
| < 0.5   | Best-effort only |

Report issues against the latest commit on the default branch when possible.

## What to report

Please report **privately** (see below) if you find:

- Remote code execution or unexpected shell/file access **outside** the configured workspace
- Path traversal that escapes the workspace root
- Permission-mode bypass (`safe` / `default` allowing tools that should be denied)
- Secret leakage (API keys, OAuth tokens) into journals, logs, or network calls beyond the intended model API
- Auth bugs (token theft, insecure storage, open redirect on OAuth loopback misuse)
- Supply-chain issues in release artifacts you believe we published

### Out of scope (usually)

- Model hallucinations or “the agent did something dumb” when tools were explicitly allowed
- User ran with `--permission-mode bypass` / always-allow shell and damaged their own machine
- Issues only in untrusted third-party **skills** the user installed
- Vulnerabilities only in upstream dependencies already fixed in a newer release (unless we pin a known-bad version)

## How to report

**Do not open a public GitHub issue for vulnerabilities.**

1. **Preferred:** GitHub Security Advisories  
   → Repository → **Security** → **Report a vulnerability**  
   (If the repo has advisories enabled.)

2. **Email:** `Ben.startupclub@gmail.com`  
   Subject: `[AgentMu security] short title`

Include when you can:

- AgentMu version (`npx tsx src/index.ts --version` or `package.json`)
- OS and Node.js version
- Minimal reproduction steps
- Impact (what an attacker could do)
- Whether a fix is included (optional patch welcome)

You should get an acknowledgement within **7 days**. We aim to ship a fix or mitigation for confirmed high-severity issues as soon as practical; coordinated disclosure timelines can be discussed.

## Safe usage (operators)

- Prefer `permission-mode safe` or default (shell **off** unless `allowTools` / `--allow-tool`)
- Do not use `bypass` on untrusted repos or shared machines
- Keep `XAI_API_KEY` / OAuth tokens out of the workspace; use env or `~/.agentmu/auth.json`
- Review `sessions/*.events.jsonl` after sensitive work (previews are redacted, not perfect)
- See [DATA_PLANE.md](./DATA_PLANE.md) for what leaves the machine

## Hardening already in tree

- Workspace path confinement for file tools
- Permission pipeline (`safe` / `default` / `bypass`) + deny/allow lists
- Dangerous shell pattern block even in bypass
- Journal secret redaction (`src/redact.ts`)
- `agentmu doctor` / `agentmu doctor --strict` for local health

These reduce risk; they do **not** replace OS sandboxing or running untrusted agents in a VM/container.

## Thank you

Responsible reports help AgentMu become infrastructure others can trust. We appreciate researchers and second users who treat security as a feature, not an afterthought.
