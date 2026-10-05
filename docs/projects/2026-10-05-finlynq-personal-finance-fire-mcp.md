# finlynq — Personal Finance Planning with FIRE/Monte Carlo MCP

**Source:** <https://github.com/finlynq/finlynq>
**Discovered:** 2026-10-05
**Viability:** 3/4

> An AGPL-licensed personal finance planning app with a first-party MCP server (90 HTTP tools, 86 stdio tools) covering budgets, portfolio, goals, loans, auto-categorization rules, a FIRE number calculator, and Monte Carlo retirement simulation. AES-256-GCM at-rest encryption. Self-host with Docker or use finlynq.com/cloud (free).

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

MyFinance MCP (Oct 4) covers expense tracking and reporting (28 tools, cloud-hosted). Finlynq fills a different gap: financial *planning* — FIRE number, Monte Carlo simulation, portfolio tracking, goals, loans. The overlap is small enough to be complementary rather than redundant. Daily utility is 0 because the high-value interactions (FIRE projection, Monte Carlo, budget review) happen weekly or monthly, not daily; day-to-day expense logging is handled by MyFinance MCP. The Docker deploy is the fastest path to value: 20-minute setup, then ask "at my current savings rate, when do I reach FIRE?" directly in Claude chat.

---

## Implementation Plan

**1 Claude Code session** to a running finlynq instance with historical data imported and the MCP server live in Claude Desktop.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Deploy | Docker Compose (included) | One command; PostgreSQL + finlynq app in one `compose.yml` |
| MCP transport | stdio (included) | Works with Claude Desktop and Claude Code |
| Data import | Custom CSV → finlynq API | Bank CSV formats vary; write a thin Python importer |
| Claude integration | Claude Desktop `settings.json` | Most natural for finance queries (not inside a coding session) |

---

## MVP Scope

1. Deploy finlynq via `docker compose up`
2. Import historical transactions (last 12 months) from bank CSV
3. Connect to Claude Desktop as an MCP server
4. Set up: 3-5 budget categories, savings goal, FIRE target
5. Verify: ask Claude "run a Monte Carlo simulation for FIRE at age 45 with current savings rate"

Out of scope for MVP: Plaid/Open Banking live sync, mobile UI, custom reporting dashboards.

---

## Implementation Phases

### Phase 1: Docker deploy + account setup

**Goal:** Finlynq running locally with a user account and basic configuration.

**Steps:**
1. `git clone https://github.com/finlynq/finlynq && cd finlynq`
2. `cp .env.example .env` — set `SECRET_KEY`, `DB_URL=postgresql://...` (auto from compose), `ENCRYPTION_KEY` (32 random bytes, hex-encoded)
3. `docker compose up -d` → wait for health check, open `http://localhost:3001`
4. Register account, complete onboarding (currency, FIRE target, birth year)
5. Verify: dashboard loads, MCP server endpoint is accessible at `http://localhost:3001/api/mcp`

---

### Phase 2: Historical data import

**Goal:** Last 12 months of transactions imported and auto-categorized.

**Files:**
- `scripts/import_csv.py` — reads bank CSV (configurable column mapping), POSTs to finlynq `/api/transactions/import` endpoint

**Key steps:**
1. Export last 12 months from your bank as CSV.
2. Map columns: `date`, `description`, `amount` (negative = expense), `currency`.
3. Script: read CSV, POST each row as `{date, description, amount, currency, type: "expense"|"income"}` to finlynq REST API with bearer token.
4. After import, go to finlynq UI → Rules → configure 5-10 auto-categorization rules (e.g., "Lidl → Groceries", "Spotify → Entertainment").
5. Verify: Spending by category chart shows realistic breakdown.

---

### Phase 3: MCP server connection to Claude Desktop

**Goal:** Finlynq MCP tools available in Claude Desktop.

**Steps:**
1. Locate Claude Desktop `settings.json` (macOS: `~/Library/Application Support/Claude/settings.json`).
2. Add MCP server entry:
   ```json
   {
     "mcpServers": {
       "finlynq": {
         "command": "npx",
         "args": ["-y", "finlynq-mcp"],
         "env": {
           "FINLYNQ_URL": "http://localhost:3001",
           "FINLYNQ_TOKEN": "<your-api-token>"
         }
       }
     }
   }
   ```
3. Restart Claude Desktop; verify "finlynq" appears in the tool picker.
4. Test: "What did I spend on dining last month?" → confirm `spending_by_category` is called.

---

### Phase 4: FIRE + Monte Carlo configuration

**Goal:** FIRE projection and Monte Carlo simulation configured with real numbers.

**Steps:**
1. In finlynq UI → Goals → New Goal: "FIRE" with target amount (calculate as 25× annual expenses), target date.
2. In finlynq UI → Portfolio → add investment accounts (index fund allocations, current balance).
3. Configure Monte Carlo settings: expected return (7%), inflation (2.5%), simulation runs (10,000).
4. Test in Claude Desktop: "Run a Monte Carlo simulation for my FIRE goal — what's the probability I hit it by 45?"
5. Extend: "What if I increase my savings rate by €500/month? Re-run the simulation."

---

## Estimated Effort

About 1 Claude Code session (2-3 hours).
- **30 min:** Docker deploy + account setup.
- **45 min:** Bank CSV importer script + import + categorization rules.
- **30 min:** Claude Desktop MCP connection + verification.
- **45 min:** FIRE target, portfolio, Monte Carlo configuration.

## Potential Blockers

- **AGPL license:** Any modifications to finlynq source must be open-sourced. For personal self-hosted use with no distribution, AGPL is fine. Custom importer scripts are separate tools and not subject to AGPL.
- **PostgreSQL in Docker:** Compose includes PostgreSQL. On macOS with low disk space, the PG image (~200 MB) may be an issue. Alternatively, use finlynq.com/cloud (free tier) to skip Docker entirely.
- **Bank CSV format:** Every bank exports differently. The import script needs column-mapping configuration; budget 20-30 min to get the format right.
- **12-star repo:** Very early stage. Expect rough edges in the MCP tool parameter validation. If a tool call fails, check the finlynq server logs at `docker compose logs finlynq`.
- **MCP token auth:** The API token is created in finlynq UI → Settings → API Keys. Store it in `~/.claude/env` rather than directly in `settings.json` to avoid committing it.
