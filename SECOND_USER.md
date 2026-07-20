# Week 4 — Second-user playbook

Goal: someone who is **not the author** can clone AgentMu from GitHub, verify it offline, then (optionally) run a live prompt — **using only this repo’s docs**.

**Public repo:** https://github.com/bentruongclub/agentmu  

## Why this week matters

Builder’s Scorecard **#15 Second independent user** and **#2 Others integrate without DMing you**.  
If only the author can run it, it is still a personal tool — not infrastructure.

**Verified (2026-07-21):** fresh `git clone` + Phase 1 passes offline (doctor OK, eval 5/5, 40 tests).

---

## Role A — Host (you)

### Before you invite them

```bash
cd agentmu   # your clone
git pull
npm test
npm run build
npx tsx src/index.ts eval
npx tsx src/index.ts doctor   # Overall: OK without keys
```

### What to send (copy-paste)

Use the message in [docs/INVITE_SECOND_USER.txt](./docs/INVITE_SECOND_USER.txt) — or this short form:

> Hey — could you try my open-source local AI agent harness for ~15 min?  
> **No API key needed** for the first part.  
>  
> 1. https://github.com/bentruongclub/agentmu  
> 2. Open **SECOND_USER.md** → section **Role B**  
> 3. Do Phase 1 only; paste back the 5 feedback answers at the bottom  
>  
> Don’t ask me until you’re stuck 15+ minutes. Thanks!

### After they finish

1. Collect their notes (template at end of Role B)  
2. File issues / fix friction  
3. If Phase 1 succeeded **without** host help → set SCORECARD.md **#15 → 2** and note the date  
4. Thank them  

---

## Role B — Guest (second user)

**Requirements:** Node.js **20+** (`node -v`), network for `npm install`.

### Phase 1 — Offline (no API key, ~10–15 minutes)

```bash
git clone https://github.com/bentruongclub/agentmu.git
cd agentmu
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
| `doctor` → **Overall: OK** (credentials may show **!** warn) | Copy the ✗ line |
| `eval` → **Passed 5/5** | Paste full output |
| `skills` lists `hello-artifact` | Say what you see |
| `npm test` → all pass | Paste first failure |

**Phase 1 success** = eval + tests pass. You do **not** need xAI login for that.

### Phase 2 — Live model (optional; your own key/subscription)

Only if you want to talk to a real model:

```bash
# Option A
npx tsx src/index.ts login

# Option B
cp .env.example .env
# set XAI_API_KEY=... from https://console.x.ai

npx tsx src/index.ts doctor --strict
npx tsx src/index.ts run "Reply in one sentence: who are you?"
```

Optional chat:

```bash
npx tsx src/index.ts chat
# try: /whoami  /skills  /mode safe  /quit
```

### Phase 3 — Feedback (send to host)

1. OS + `node -v`  
2. Minutes for Phase 1  
3. Anything unclear in README / this file?  
4. Exact error text (if any)  
5. Did you need to ask the host anything? What?  

---

## Optional: `agentmu` on PATH

```bash
cd agentmu && npm run build && npm link
agentmu doctor
agentmu eval
```

---

## Host: friction log

| # | Symptom | Root cause | Fix / issue |
|---|---------|------------|-------------|
| 1 | | | |
| 2 | | | |

## Success criteria

- [ ] Guest completed Phase 1 without host help  
- [ ] Guest completed Phase 2 **or** documented auth blocker  
- [ ] Friction fixed or filed  
- [ ] SCORECARD.md #15 → 2 after real guest Phase 1 success  
