# AgentMu — Builder’s Scorecard (re-score)

Scoring rubric: project Builder's Scorecard (0–2 each, max 40).  
Bands: 0–15 toy · 16–27 useful product · **28–35 infra candidate** · 36–40 strong infra discipline.

## Timeline

| Milestone | Version | Approx total | Band |
|-----------|---------|-------------:|------|
| Baseline (pre-work) | 0.1 | ~19 | Useful product (early) |
| Week 1 permissions + journal | 0.2 | ~24–25 | Useful product |
| Week 2 skills + exit codes | 0.3 | ~26–27 | Useful product |
| Week 3 doctor + eval + redact | 0.4 | ~28–29 | Infra candidate |
| **Week 4 second-user path** | **0.5** | **~30–31** | **Infra candidate** |
| **Git remote + SECURITY.md** | **0.5.x** | **~32** | **Infra candidate** |

---

## Post–Week-4 detailed score (v0.5 + remote/security)

| # | Criterion | Score | Evidence |
|---|-----------|------:|----------|
| 1 | Stable interface | **1** | CLI + config fields; semver in CHANGELOG; not published to npm registry yet |
| 2 | Others integrate without DMing you | **1** | SECOND_USER.md + offline doctor/eval; still needs real guest pass to become **2** |
| 3 | Session / audit journal | **2** | `sessions/<id>.events.jsonl` + message JSON |
| 4 | Permission model | **2** | safe/default/bypass + allow/deny + dangerous shell block |
| 5 | Safe defaults | **2** | Shell off by default; safe mode; dangerous patterns |
| 6 | Data plane clarity | **2** | DATA_PLANE.md + redaction notes |
| 7 | Local-first path | **1** | Tools local; model still xAI cloud |
| 8 | Headless / CI | **2** | `run` exit 0/1/2; `eval` offline; npm scripts |
| 9 | Extensibility | **1** | Markdown skills; no MCP yet |
| 10 | Boundary tests | **2** | 39+ tests, real disk tools, offline eval suite |
| 11 | Contribution path | **1** | MIT + CONTRIBUTING.md + public git remote; still early community |
| 12 | Honest framing | **2** | Not AgenC, OAuth caveats, permission honesty |
| 13 | Breaking-change discipline | **1** | Semver policy + CHANGELOG; young project |
| 14 | Security response | **2** | SECURITY.md + private report path + redaction + doctor |
| 15 | Second independent user | **1** | Playbook shipped; score **2** only after a real guest completes it |
| 16 | Survives if you vanish 3 mo | **1** | Docs + tests + eval; no package release channel |
| 17 | Composable | **1** | Injectable CompletionProvider; library entry not packaged |
| 18 | Agent evals | **2** | `agentmu eval` 5 offline cases |
| 19 | Secret handling | **2** | Journal redaction + auth file path isolation |
| 20 | Boring reliability | **1** | Eval/doctor/tests; not production load-proven |

### Total: **32 / 40**

**Band: infrastructure candidate**

*(#11 and #14 raised after public remote + SECURITY.md / CONTRIBUTING.md.)*

---

## How to move 32 → 36+

| Action | Criteria helped |
|--------|-----------------|
| Real guest completes SECOND_USER.md Phase 1–2 | #2, #15 → 2 |
| Active PR triage / CODEOWNERS | #11 → 2 |
| `npm publish` or clear install one-liner | #1, #16 |
| MCP or skill-invoke tool (not only prompt inject) | #9 → 2 |
| Optional local model endpoint doc | #7 → 2 |

---

## Honest comparison (reminder)

| Lens | Grok Build (public tree) | AgentMu v0.5 |
|------|--------------------------|--------------|
| Product depth | Much higher | Smaller, focused |
| Safe defaults | Weaker (sandbox off) | Stronger on shell default |
| Open contribution | Closed PRs | Not opened yet either |
| Study / scorecard fit | Heavy specimen | **Your** controlled climb |

AgentMu is not competing with Grok Build feature-for-feature. It is practicing **infrastructure discipline** on a harness you own.
