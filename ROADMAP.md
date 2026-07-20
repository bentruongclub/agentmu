# AgentMu Roadmap — Scorecard climb

Baseline (pre-0.2): **~19 / 40**  
Target after this track: **~27–29 / 40**

## Done in 0.2.0 (this slice)

- [x] Permission pipeline (`safe` / `default` / `bypass`)
- [x] Shell off by default; dangerous pattern block
- [x] Append-only session journal (`*.events.jsonl`)
- [x] DATA_PLANE.md
- [x] CLI flags + chat `/mode` `/allow`
- [x] Tests for permissions + journal

**Expected score after 0.2:** ~24–25 / 40

## Week 2 — Extensions + headless contract ✅ (0.3.0)

- [x] Skills directory (markdown skill loader)
- [x] `agentmu run` exit codes: 0 ok, 2 permission denied-only, 1 error
- [x] Semver policy + CHANGELOG.md

**Expected score after 0.3:** ~26–27 / 40

## Week 3 — Reliability ✅ (0.4.0)

- [x] Minimal eval set (5 scripted tool tasks, fake completion)
- [x] Redact secrets in journal previews (API key patterns)
- [x] `agentmu doctor` (auth, workspace, permission mode)

**Expected score after 0.4:** ~28–29 / 40

## Week 4 — Second user ✅ (0.5.0)

- [x] SECOND_USER.md playbook (host + guest phases)
- [x] Friction fixes from cold-start walkthrough (offline-first README, soft doctor)
- [x] SCORECARD.md re-score (~30/40)
- [ ] **Your action:** one real guest completes Phase 1 (and Phase 2 if they have keys)

After a real guest succeeds, bump criterion #15 to 2 in SCORECARD.md.

## Non-goals (for now)

- Full OS sandbox (Landlock/Seatbelt) — later
- Multi-agent swarms — vault owns that story
- Competing with Grok Build feature-for-feature
