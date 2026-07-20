# Week 4 — Second-user playbook

Goal: someone who is **not you** can clone/copy AgentMu, verify it offline, then run a live prompt — **using only this repo’s docs**.

## Why this week matters

Builder’s Scorecard **#15 Second independent user** and **#2 Others integrate without DMing you**.  
If only you can run it, it is still a personal tool — not infrastructure.

---

## Role A — Host (you)

### Before you invite them

```bash
cd /path/to/AgentMu
npm test
npm run build
npx tsx src/index.ts eval
npx tsx src/index.ts doctor          # should Overall: OK without their keys
```

Send them **only**:

1. How to get the code (zip, git, USB, Tailscale path — whatever you use)
2. Link or path to this file: `SECOND_USER.md`
3. “Start at **Role B**. Don’t ping me until you finish the checklist or get stuck 15+ minutes.”

### After they finish

1. Collect their notes (what was confusing, exact error text)
2. Fix friction in README / doctor / scripts (small PR or commit)
3. Update [SCORECARD.md](./SCORECARD.md) if scores changed
4. Thank them — second users are rare and valuable

---

## Role B — Guest (second user)

**Requirements:** Node.js **20+**, network for `npm install` (and later for live model).

### Phase 1 — Offline (no API key, ~10 minutes)

```bash
cd AgentMu          # or wherever you unpacked the project
npm install
npm run build

npx tsx src/index.ts init --label Artifact
npx tsx src/index.ts doctor
npx tsx src/index.ts eval
npx tsx src/index.ts skills
npm test
```

| Expect | If not |
|--------|--------|
| `doctor` → **Overall: OK** (credentials may show **!** warn) | Note the ✗ line |
| `eval` → **Passed 5/5** | Paste full output |
| `skills` lists `hello-artifact` | Check `skills/` exists |
| `npm test` all pass | Paste first failure |

You have **already succeeded offline** if eval + tests pass. Live chat is Phase 2.

### Phase 2 — Live model (needs your own subscription/key)

**Option A — browser login**

```bash
npx tsx src/index.ts login
npx tsx src/index.ts whoami
npx tsx src/index.ts run "Reply in one sentence: who are you?"
```

**Option B — API key**

```bash
cp .env.example .env
# edit .env → XAI_API_KEY=... from https://console.x.ai
npx tsx src/index.ts doctor --strict
npx tsx src/index.ts run "List files in the workspace root with list_dir if needed"
```

| Expect | If not |
|--------|--------|
| `run` prints a short reply | Auth error → re-check login/key |
| `sessions/*.json` and `*.events.jsonl` appear | Say so |

Optional:

```bash
npx tsx src/index.ts chat
# /whoami  /skills  /mode safe  /quit
```

### Phase 3 — Feedback (send to host)

Copy-paste answers:

1. OS + Node version (`node -v`)
2. Time to finish Phase 1 (minutes)
3. Anything unclear in README?
4. Exact error text (if any)
5. Did you need to ask the host anything? What?

---

## Optional: put `agentmu` on PATH

```bash
cd AgentMu
npm run build
npm link          # needs write access to global npm prefix
agentmu doctor
agentmu eval
```

Or without global link:

```bash
alias agentmu='npx tsx /absolute/path/to/AgentMu/src/index.ts'
```

---

## Host: friction log template

| # | Symptom | Root cause | Fix committed? |
|---|---------|------------|----------------|
| 1 | | | |
| 2 | | | |

---

## Success criteria (Week 4 done)

- [ ] Guest completed Phase 1 without host help  
- [ ] Guest completed Phase 2 **or** documented auth blocker (tier/key)  
- [ ] At least one friction item fixed in repo  
- [ ] SCORECARD.md updated with post–Week-4 scores  
