# actual-budget-mcp — Actual Budget MCP with Full Write Access

**Source:** GitHub — https://github.com/rk8s-collab/actual-budget-mcp  
**Tagline:** "LLM-ready financial assistant with correct semantics, unit conversion and real split transactions"  
**Discovered:** 2026-10-10

---

## Why it fits

Actual Budget is the best self-hosted personal finance tool (local-first, no subscription, powerful rules engine), but querying it today means opening the app and clicking through reports. This MCP gives Claude Code direct read/write access: ask about spending by category, create transactions, assign budget amounts, and build automation rules — all in natural language. Unlike the other Actual Budget MCPs (`henfrydls`, `s-stefanov`), the rk8s-collab version emphasises correct unit handling (amounts in milliunits, not dollars) and supports real split transactions, which removes the footgun of off-by-1000 errors in write operations.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | MCP wrapper + Actual Budget server setup is achievable in one session |
| fills_gap | 1 | No working read+write Actual Budget MCP in current toolkit |
| novel | 1 | Correct unit semantics and split-transaction support distinguishes it from the two older MCPs |
| daily_utility | 0 | Finance queries are weekly rather than daily for most users |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **Actual Budget** — self-hosted on local machine or NAS (`npx @actual-app/api start`)
- **actual-budget-mcp** — install via Claude Code: `claude mcp add actual-budget-mcp`
- **Write tools** — disabled by default; enable in config with `ACTUAL_ALLOW_WRITES=true`
- **Claude Code** — query via natural language (`@actual-budget-mcp show April spending by category`)

## MVP Scope

Connect Claude Code to a local Actual Budget server in read-only mode; run 5 real finance queries to verify data accuracy. Enable writes in a second pass once read queries are confirmed correct.

Not in MVP: automated monthly reports, budget alert automations, recurring transaction rules.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Set up self-hosted Actual Budget server; import existing bank data (OFX/CSV) | 2 h |
| 2 | Install `actual-budget-mcp` and configure read-only connection in Claude Code | 1 h |
| 3 | Run validation queries: monthly totals, category breakdown, budget vs. actual | 1 h |
| 4 | Enable write tools; test transaction creation and budget assignment | 2 h |
| 5 | Build a CLAUDE.md-triggered monthly finance summary prompt | 1 h |

**Total estimate:** ~7 h (1 Claude session)

## Blockers

- Requires Actual Budget self-hosted server — `npx @actual-app/api start` on a machine that stays up
- Write tools touch live financial data; test with a cloned budget file first
- Split-transaction support requires Actual Budget server version ≥ 24.x

## References

- GitHub: https://github.com/rk8s-collab/actual-budget-mcp
- Actual Budget docs: https://actualbudget.org/docs/
