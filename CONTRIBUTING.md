# Contributing to AgentMu

Thanks for helping turn AgentMu into something others can depend on.

## Ground rules

- **Security issues** → [SECURITY.md](./SECURITY.md) (private report). Do not file public issues for vulns.
- Keep the **scorecard spirit**: stable interfaces, safe defaults, honest docs.
- Small, focused PRs beat large rewrites.

## Dev setup

```bash
git clone <this-repo>
cd AgentMu   # or agentmu
npm install
npm test
npm run build
npx tsx src/index.ts doctor
npx tsx src/index.ts eval
```

Node **20+** required.

## Before you open a PR

1. `npm test` and `npm run build` pass  
2. If you change permissions, journal, or exit codes — add/adjust a test  
3. Update `CHANGELOG.md` under an Unreleased or next version note for user-visible changes  
4. Do not commit `.env`, `sessions/*` data, `auth.json`, or real API keys  

## What we especially want

- Permission / sandbox hardening  
- Journal redaction edge cases  
- Offline eval cases  
- Docs clarity (second-user friction)  
- Optional local-model / multi-backend sampling (without breaking the CLI)

## What to discuss first (open an issue)

- New default permission behavior (breaking)  
- New network tools  
- Publishing to npm / renames  

## License

By contributing, you agree your contributions are licensed under the MIT License (see [LICENSE](./LICENSE)).
