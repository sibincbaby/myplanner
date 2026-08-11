# schemactx — Compile a MySQL Database into a Compact, Queryable Context File

**Source:** [shrsv/dbctx](https://github.com/shrsv/dbctx) · HN Show HN Aug 11 2026, 4★, Go, MIT
**Language:** Python 3.11 + `mysqlclient` — the `lwdb` tooling here is already Python-shaped; Go buys nothing
**License:** upstream MIT (PostgreSQL-only) · plan is a MySQL equivalent
**Date discovered:** 2026-08-12

## What it is

dbctx compiles a PostgreSQL database into a portable `.dtx` file — schema, foreign-key relationships, representative values, implicit enums, JSONB structure, and a full-text retrieval index — using **deterministic introspection only**. No LLM, no embeddings, no external service. At query time you ask it a natural-language question and it returns the relevant slice: the tables that matter, their compact schema notation, and the field context needed to write correct SQL.

The point is what it replaces: dumping `information_schema` into a prompt, or worse, letting the agent rediscover the schema table by table across a dozen turns.

**Why it matters here:** the `lwdb` skill already handles the hard part of the Linways setup — multi-server connection management for V3/V4/local MySQL, credential isolation, JSON output, saved query templates. What it does not do is tell the agent *what is in there*. Every bug investigation opens by listing tables, describing three or four of them, guessing at the join, and correcting. That is a fixed cost paid at the start of every session, and it grows with the schema rather than with the question.

A compiled context file turns that into one lookup. It is also cacheable and versionable — schema drift becomes a diff rather than a surprise.

## Why it fits

- Core interest: **Claude/LLM tooling** — an MCP server or a `lwdb` subcommand, consumed by the agent, not by a human
- Core interest: **dev productivity** — removes the schema-rediscovery preamble from every database-touching session
- `novel = 1`: codegraph (07-30) indexes code; nothing in the backlog compiles a database schema into retrievable context, and dbctx itself is PostgreSQL-only
- `fills_gap = 1`: `lwdb` reaches the data and says nothing about the shape of it
- `daily_utility = 1`: the Linways bug lifecycle starts here, and it starts here every time

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | `information_schema` plus SQLite FTS5; the retrieval is a keyword search, not a research problem |
| fills_gap | 1 | `lwdb` queries the data and offers nothing about the schema |
| novel | 1 | Upstream is PostgreSQL-only; no backlog plan covers schema-as-compiled-context |
| daily_utility | 1 | Every `lw-bugfix-lifecycle` run begins with schema exploration |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Build:      Python 3.11 + mysqlclient — read information_schema, sample, write
Artifact:   SQLite .sctx file — tables, columns, FKs, enums, samples, FTS5 index
Retrieval:  SQLite FTS5 over table/column names + comments. No embeddings
Output:     Compact schema notation with a legend, sized to a token budget
Surface:    `schemactx query "<question>"` CLI + an MCP `schema_context` tool
Creds:      Reuse lwdb's connection store. Never handle credentials directly
```

SQLite FTS5 with a BM25 rank is the correct retrieval layer for a schema. Table and column names are short, high-signal, and drawn from a closed vocabulary — the failure mode of keyword search (synonyms, paraphrase) barely applies, and it costs no model call, no index rebuild, and no embedding service. Add semantic search only if a real question misses, and only then.

**Reuse `lwdb`'s connection store rather than reading credentials.** That is the existing boundary on this machine and there is no reason to open a second one.

## MVP Scope (1-2 Claude sessions)

1. `schemactx build --db <lwdb-name>` — introspect and write `<name>.sctx`
2. Column intelligence — nullability, keys, indexes, comments, and detected implicit enums with their values
3. FK graph — real constraints where they exist, plus name-convention inference where they do not
4. `schemactx query "<question>"` — return the relevant tables in compact notation, under a token cap
5. MCP `schema_context(question)` — the same thing where the agent can reach it

## Phases

### Phase 1: Introspection + Artifact (2.5h)
- Read `information_schema.TABLES`, `COLUMNS`, `STATISTICS`, `KEY_COLUMN_USAGE`; write to SQLite
- Record row-count estimates from `TABLES.TABLE_ROWS` — approximate is fine and `COUNT(*)` on a production table is not
- **Read-only, always.** Connect through `lwdb`'s existing connection and never issue a statement that is not a `SELECT` or a `SHOW`
- Verify: build against a real Linways DB, confirm the table count matches `SHOW TABLES`, and confirm the `.sctx` is portable — copy it elsewhere and query it with the database unreachable

### Phase 2: Column Intelligence + Enum Detection (2.5h)
- For low-cardinality string columns, `SELECT DISTINCT ... LIMIT 50` to capture implicit enums (`status`, `type`, `role`) with their real values — the single highest-value thing in the artifact, because guessing `status = 'active'` when the column holds `'A'` is the most common wrong query
- **Gate sampling with `LIMIT` and a hard timeout**, and skip any table above a row threshold. A build step that hangs on a large production table gets deleted after the second time
- Sample representative values for date and numeric columns to establish ranges; never sample a column whose name matches a PII pattern (`email`, `phone`, `password`, `aadhaar`, `name`) — the artifact is a file that will be copied around
- Verify: a known status column comes back with its actual value set; a PII-named column is present in the schema and has no samples

### Phase 3: FK Graph + Retrieval Index (2h)
- Declared constraints first; then infer edges from naming convention (`student_id` → `student.id`) and **mark inferred edges as inferred**. A confidently wrong join is worse than a missing one
- FTS5 index over table names, column names and comments; BM25 ranking
- `query` expands one FK hop from the top hits — the joined table is usually the thing actually needed
- Verify: "which table holds attendance marks" returns the attendance tables ahead of unrelated ones, and an inferred edge is visibly labelled

### Phase 4: Compact Output + Token Budget (1.5h)
- Emit a compact notation with a short legend, not raw DDL. `student(id PK, name, batch_id→batch.id, status[active|inactive|alumni])` carries more per token than a `CREATE TABLE`
- Hard token cap with a default around 2k; when hits are trimmed, **name the omitted tables** so the agent can ask for more instead of assuming it saw everything
- Verify: a broad question stays under the cap and lists what it dropped

### Phase 5: MCP Tool + lwdb Integration (1.5h)
- `schema_context(question, db)` over stdio MCP, registered in `~/.claude.json`
- `schemactx build --all` to refresh every configured `lwdb` connection; record the build timestamp in the artifact and surface it in query output, because a stale schema that looks current is the failure mode here
- Verify: from a live session, ask a real Linways question and confirm the agent writes correct SQL without a `DESCRIBE` round-trip

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Introspection + Artifact | 2.5h |
| Column Intelligence + Enum Detection | 2.5h |
| FK Graph + Retrieval Index | 2h |
| Compact Output + Token Budget | 1.5h |
| MCP Tool + lwdb Integration | 1.5h |
| **Total** | **10h (~1-2 weekends)** |

Phases 1-2 plus a `grep` over the artifact already beat the current workflow, at **5h**.

## Blockers / Risks

- **Sampling against production is the risk that matters.** Phase 2 issues `SELECT DISTINCT` across many columns. Without a `LIMIT`, a statement timeout and a row-count skip threshold, this is a self-inflicted load spike on a live college database. Set all three before the first run against anything but local, and run the first build against local regardless.
- **The artifact will contain production data samples.** Enum values and date ranges are the point; a stray sample from a name or email column is a data leak in a file designed to be copied and cached. The PII name filter in Phase 2 is necessary and not sufficient — `.sctx` files belong in `.gitignore` from the first commit, not after the first accident.
- **Staleness is the quiet failure.** A schema compiled three weeks ago will answer confidently and wrongly after a migration. The build timestamp must appear in every query result, and a cheap freshness check (compare table count and max `UPDATE_TIME`) is worth adding the moment the tool is used twice.
- **Inferred foreign keys are heuristics and Linways may not follow the convention.** Check a dozen real tables before trusting name-based inference; if the hit rate is poor, ship declared constraints only. A join graph that is right 70% of the time produces queries that are wrong in ways that look right.
- **Multi-server means multiple artifacts**, and V3 and V4 schemas differ. Key each artifact to its `lwdb` connection name and refuse to answer if the requested database has no build, rather than silently using another one.
- Upstream dbctx is MIT, Go, PostgreSQL-only, and 4★ two days old. The `.dtx` format design and the compact-notation idea are what transfer; read those, port neither.
