# CopilotMoneyMCP — Personal Finance MCP for Copilot Money App

**Source:** [github.com/ignaciohermosillacornejo/copilot-money-mcp](https://github.com/ignaciohermosillacornejo/copilot-money-mcp)  
**Stars:** 68 · **Language:** TypeScript  
**Date discovered:** 2026-08-02

## What it is

An MCP server that connects Claude (or any MCP client) to the local data cache of [Copilot Money](https://copilot.money), a popular macOS/iOS personal finance app. Reads directly from the app's LevelDB + Protocol Buffers cache — no API keys, no network calls, no cloud service.

Provides:
- **14 read-only tools** (cache mode): transactions, accounts, account balances, holdings, budgets, net worth, recurring charges, merchants
- **25 read-only tools** (live-reads mode): same set + live refresh from Copilot servers
- **17 write tools** (optional): transaction notes, budgets, custom categories

Example queries Claude can answer: "How much did I spend on restaurants this month?", "What subscriptions can I cancel?", "Am I on track with my grocery budget?"

## Why it fits

- Personal finance AI is a core interest area
- Copilot Money is a popular existing app (not building from scratch)
- Local-only reads = total privacy, no data leaves the machine
- Directly extends Claude Code / Claude Desktop with finance superpowers
- Daily utility: weekly or daily spending check via natural language

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | TypeScript + MCP SDK + existing repo as template — very achievable |
| fills_gap | 1 | No other Copilot Money MCP exists; previous MCPs (Monarch, Actual Budget) serve different apps |
| novel | 1 | Copilot Money-specific: local LevelDB + protobuf decode is distinctive from generic finance MCPs |
| daily_utility | 1 | Daily spending analysis via Claude = immediate, recurring value |
| **Total** | **4/4** | **VIABLE (strongest pick today)** |

## Stack Recommendation

```
TypeScript (match existing repo)
Node.js 18+ (Bun for dev)
@modelcontextprotocol/sdk — MCP server
leveldown / level — LevelDB access
protobufjs — decode Copilot's protobuf schemas
zod — input validation
```

## MVP Scope (1 Claude session)

Read-only MCP with the 5 most useful tools:
1. `get_recent_transactions(days: number)` → list of transactions with amount, category, merchant
2. `get_account_balances()` → checking, savings, credit cards
3. `get_monthly_spending_by_category(month: string)` → category breakdown
4. `get_budget_status()` → current month budget vs. actual
5. `get_subscriptions()` → recurring charges with monthly cost

Wire to Claude Desktop config: `~/.claude/claude_desktop_config.json`

## Phases

### Phase 1: LevelDB Access (2h)
- Locate Copilot Money's local cache: `~/Library/Group Containers/*/LevelDB`
- Open LevelDB with `level` npm package (read-only mode)
- Enumerate keys, identify transaction and account key patterns

### Phase 2: Protobuf Decoding (2-3h)
- Reverse-engineer or borrow protobuf schemas from existing repo
- Decode raw buffers into typed TS objects
- Normalize to clean `Transaction`, `Account`, `Budget` interfaces

### Phase 3: Core MCP Tools (2h)
- Implement 5 MVP tools with Zod input schemas
- Date filtering, category aggregation, budget % calculation
- Test with `mcp-inspector` or Claude Desktop

### Phase 4: Expand to 14 Read Tools (2-3h)
- Net worth (assets - liabilities)
- Holdings (brokerage positions + gains)
- Merchant rankings
- Subscription detection (recurring charge pattern)

### Phase 5: Write Tools + Documentation (2h)
- Transaction notes and custom categories via LevelDB write
- CLAUDE.md skill for common queries
- README with Claude Desktop config snippet

## Effort Estimate

| Phase | Hours |
|-------|-------|
| LevelDB Access | 2h |
| Protobuf Decoding | 2-3h |
| Core MCP Tools (5) | 2h |
| Full 14 Read Tools | 2-3h |
| Write Tools + Polish | 2h |
| **Total** | **10-12h (~1-2 sessions)** |

MVP (5 tools): **6-7h (1 Saturday)**

## Blockers / Risks

- Copilot Money app must be installed on macOS with active account
- LevelDB schema may change with Copilot app updates — brittle
- Protobuf `.proto` files are not public; need reverse engineering or reference the existing repo's decoded schemas
- Copilot Money's local cache may not be present if app hasn't synced recently
- Write tools risk corrupting local cache — test on a copy first
- macOS only (iOS app cache is on-device and inaccessible without jailbreak)
