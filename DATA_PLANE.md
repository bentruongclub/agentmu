# AgentMu Data Plane

What leaves your machine, what stays local, and how to control it.

## Stays on your machine

| Path | Contents |
|------|----------|
| `.agentmu/config.json` | Label, model, permission mode, allow/deny tools |
| `~/.agentmu/auth.json` | OAuth tokens (if you `agentmu login`) |
| `sessions/<id>.json` | Chat messages for resume |
| `sessions/<id>.events.jsonl` | **Append-only audit journal** (user, tools, permissions, results) |
| `sessions/artifacts/` | Saved deliverables + image metadata |

Workspace file tools only read/write under the configured **workspace** root (path escape blocked).

## Leaves your machine

| Channel | When | Payload |
|---------|------|---------|
| **xAI Chat Completions API** | Every `chat` / `run` that needs the model | Prompts, tool schemas, tool results, code snippets the model requested |
| **OAuth (auth.x.ai / accounts)** | `agentmu login` | Auth codes / tokens |
| **web_search** | When the model calls it | Search query (Wikipedia; Brave/Tavily if keys set) |
| **x_search** | When called + `X_BEARER_TOKEN` | Search query |
| **generate_image** | When called | Image prompt (+ API key auth) |

AgentMu does **not** implement product analytics/Mixpanel. What the model provider logs is governed by **your** xAI/SpaceXAI account terms.

## Permission modes (control blast radius)

| Mode | Shell | Write | Read / search / artifacts |
|------|-------|-------|---------------------------|
| **safe** | Deny* | Deny* | Allow |
| **default** (ship default) | Deny* | Allow | Allow |
| **bypass** | Allow† | Allow | Allow |

\* Unless listed in `allowTools`  
† Still blocks known-dangerous patterns (`rm -rf /`, pipe-to-shell, etc.)

```bash
agentmu run "…" --permission-mode safe
agentmu run "…" --allow-tool run_shell
# or in chat: /mode safe   /allow run_shell
```

Config fields: `permissionMode`, `allowTools`, `denyTools` in `.agentmu/config.json`.  
Env: `AGENTMU_PERMISSION_MODE`.

## How to reduce data leaving the box

1. Prefer `--permission-mode safe` for exploration.  
2. Do not put secrets in prompts; keep them out of the workspace when possible.  
3. Review `sessions/*.events.jsonl` after sensitive runs.  
4. Use API key vs OAuth according to your org policy.  
5. Unset optional keys (`X_BEARER_TOKEN`, Brave/Tavily) if you do not want those tools to call out.

## Journal event types

`session_start` · `user_message` · `assistant_text` · `tool_call` · `permission` · `tool_result` · `done` · `error`

Each line is one JSON object with `ts` and `sessionId`.

### Redaction (v0.4+)

String fields are passed through `redactSecrets` before append. Patterns include `xai-…` / `sk-…` keys, Bearer tokens, JWT-shaped strings, and `XAI_API_KEY=…`-style env assignments. Prefer false positives over leaks; redaction is not a substitute for keeping secrets out of the workspace.
