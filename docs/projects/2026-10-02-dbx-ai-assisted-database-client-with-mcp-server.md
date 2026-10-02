# dbx – AI-Assisted Database Client with MCP Server

**Source:** <https://github.com/t8y2/dbx>
**Discovered:** 2026-10-02
**Viability:** 4/4

> The combination of natural-language SQL, a 100+ database connector, and an MCP server in one tool hits all four viability bars. The MCP mode is the killer feature: a coding agent can use dbx as a data tool without the user touching SQL, and the tool's schema-aware prompts keep hallucinated column names out. The AI assistant is not a demo—it injects the live schema before every NL query, so the LLM knows what tables and columns exist. Daily utility is strong for any developer who touches a database.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

A minimal version — NL-to-SQL with live schema injection, one or two adapters (SQLite + PostgreSQL), Rich output, and an MCP server — is achievable in a single Claude Code session. The MCP layer specifically fills the gap between Claude Code knowing how to write SQL and Claude Code being able to *run* SQL against a real local database without a custom tool.

---

## Implementation Plan

**2 Claude Code sessions** to a fully MCP-enabled local database assistant.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | SQLAlchemy covers all adapters |
| DB abstraction | SQLAlchemy 2.x core | Single interface for 20+ dialects |
| SQLite | stdlib `sqlite3` (via SQLAlchemy) | Zero install, default for local DBs |
| PostgreSQL | `psycopg[binary]` | Most common server DB |
| MySQL/MariaDB | `pymysql` | Optional extra |
| DuckDB | `duckdb` | Parquet/CSV/JSON query without a server |
| LLM | Anthropic SDK (`claude-haiku-4-5`) | Fast, cheap for NL→SQL translation |
| CLI | Typer + Rich | Tables, syntax-highlighted SQL |
| MCP server | `fastmcp` | `query`, `schema`, `explore` tools |
| Config | TOML (stdlib tomllib) | `~/.config/dbx/config.toml` |

---

## MVP Scope

Connect to a database via connection string, browse schema (tables, columns, types), ask a natural-language question and get SQL + results, run raw SQL with syntax highlighting, and expose all of this as MCP tools so Claude Code can drive it.

Out of scope for MVP: write operations via NL, query history persistence, web UI, MySQL adapter, migrations.

---

## Implementation Phases

### Phase 1: DB Connection + Schema Introspection
**Goal:** CLI can connect to any SQLite or PostgreSQL database and display its schema.

**Files:**
- `pyproject.toml` — deps: sqlalchemy, psycopg[binary], typer, rich, anthropic, fastmcp
- `src/dbx/cli.py` — Typer app: `dbx connect <url>`, `dbx schema`
- `src/dbx/connection.py` — `connect(url)` → SQLAlchemy `Engine`; validates the URL and tests the connection
- `src/dbx/schema.py` — `get_schema(engine)` → `{table: [{name, type, nullable, primary_key}]}` via `inspect(engine)`
- `src/dbx/config.py` — `load_config()`, `save_connection(name, url)` to `~/.config/dbx/config.toml`
- `src/dbx/render.py` — `render_schema(schema)` and `render_results(rows, columns)` using Rich `Table`

**Key steps:**
1. `connect(url)`: `create_engine(url)` + `engine.connect()` inside a context manager; raise a clear `ConnectionError` with the URL on failure.
2. `get_schema`: use `sqlalchemy.inspect(engine).get_table_names()` then per table `get_columns`, `get_pk_constraint`, `get_foreign_keys`.
3. `render_schema`: Rich panel per table, rows = columns with name/type/PK/FK indicators.
4. `dbx connect <url> [--save <name>]` saves to config; `dbx schema [--name <saved>]` loads it.
5. Support `sqlite:///path/to/file.db` and `postgresql://user:pass@host/db` URLs from env var `DBX_URL` as a fallback.

**Verify:** `dbx connect sqlite:///my.db && dbx schema` prints all tables with column types and primary key markers.

---

### Phase 2: NL-to-SQL Query
**Goal:** Ask a question in plain English; the tool generates SQL with live schema context, runs it, and shows results as a Rich table.

**Files:**
- `src/dbx/translator.py` — `nl_to_sql(question, schema, engine)` → `{sql, explanation}`
- `src/dbx/cli.py` — adds `dbx ask "how many users signed up last month?"` command
- `prompts/nl_to_sql.txt` — system prompt with schema injection template, SQL dialect rules, safety constraints

**Key steps:**
1. System prompt template: inject schema as a compact representation (`table(col type PK, col type, …)`) in a `<schema>` block. Include the DB dialect (SQLite, PostgreSQL). Add safety rule: SELECT only; reject INSERT/UPDATE/DELETE/DROP.
2. `nl_to_sql`: call `messages.create` with system prompt + user question. Request JSON `{"sql": "...", "explanation": "..."}`. Parse with `json.loads`; strip markdown fences first.
3. Run the returned SQL with `engine.execute(text(sql))` (read-only transaction). Catch `ProgrammingError` and return it to the LLM with a one-shot retry instruction: "The query failed with: {error}. Fix it."
4. Render results as a Rich table, capped at 100 rows with a "… N more rows" footer.
5. Print the generated SQL in a Rich syntax-highlighted panel (dim) above the results, so the user can audit it.

**Verify:** `dbx ask "what are the 5 most recent orders?"` → prints SQL + results table with no hallucinated column names.

---

### Phase 3: MCP Server
**Goal:** dbx exposes `query`, `schema`, and `explore` as MCP tools usable by Claude Code or any MCP client.

**Files:**
- `src/dbx/mcp_server.py` — `fastmcp` server with three tools
- `src/dbx/cli.py` — adds `dbx serve [--name <saved_connection>]` command

**Tool definitions:**

```python
@mcp.tool()
async def schema() -> str:
    """Return the full schema of the connected database as a compact JSON string."""

@mcp.tool()
async def query(question: str) -> str:
    """Answer a natural-language question about the database. Returns results as a Markdown table."""

@mcp.tool()
async def run_sql(sql: str) -> str:
    """Run a read-only SQL query and return results as a Markdown table. Rejects write statements."""
```

**Key steps:**
1. `dbx serve` loads the connection from config (or env `DBX_URL`), creates the engine, and calls `mcp.run()` on stdio.
2. Each tool function calls the matching function from Phase 1/2 and serialises the result as Markdown.
3. `run_sql` uses a blocklist check before executing: raise `ValueError` if the statement starts with INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE (case-insensitive).
4. Add an `explore(table_name: str)` tool that returns sample rows (10) + column statistics (min, max, count, nulls) for a table — useful for letting the agent understand data shape before querying.
5. Add an `mcpconfig` command that prints the JSON snippet to paste into Claude Code's config file.

**Verify:** Add dbx to Claude Code MCP config. Ask Claude: "how many rows in the users table?" → Claude calls the `query` MCP tool and shows the answer without touching the SQL itself.

---

### Phase 4: DuckDB + CSV/Parquet/JSON
**Goal:** dbx works with local data files (CSV, Parquet, JSON) as a zero-config database — no server needed.

**Files:**
- `src/dbx/duckdb_adapter.py` — `connect_duckdb(path_or_pattern)` → DuckDB connection wrapped as SQLAlchemy-compatible interface
- `src/dbx/cli.py` — `dbx file <path>` command auto-detects extension and opens in DuckDB

**Key steps:**
1. For `.csv` / `.parquet` / `.json` / `.jsonl` paths: open an in-memory DuckDB connection, create a virtual table with `CREATE VIEW t AS SELECT * FROM read_csv_auto(?)` etc., then pass it through the same `schema` + `ask` pipeline.
2. Support glob patterns: `dbx file "data/*.parquet"` → union all matching files.
3. Use DuckDB's `DESCRIBE` output for schema introspection instead of SQLAlchemy inspect.
4. The MCP `schema`, `query`, and `run_sql` tools work identically regardless of whether the backend is DuckDB or SQLAlchemy — the caller doesn't see the difference.

**Verify:** `dbx file transactions.csv && dbx ask "total spending by category this month"` → correct result without any server running.

---

## Estimated Effort

**2 Claude Code sessions** (1 session ≈ 3–4 hours of Claude work).

- **Session 1** — Phases 1 + 2: project scaffold, SQLAlchemy connection, schema introspection, NL→SQL translator, schema injection prompt, retry on error, Rich rendering.
- **Session 2** — Phases 3 + 4: MCP server with three tools, DuckDB file adapter, `mcpconfig` helper command, integration tests.

---

## Potential Blockers

1. **SQLAlchemy dialect coverage** — SQLAlchemy covers ~20 dialects but requires separate pip extras. Provide a clear install guide for each; default to SQLite + DuckDB (no extras needed) and make PostgreSQL an `[postgres]` extra in pyproject.toml.
2. **Schema injection size** — Large databases (100+ tables, 50+ columns each) overflow the prompt context. Mitigate: detect when schema JSON > 8 000 tokens and ask the user which tables are relevant; inject only those.
3. **Read-only enforcement** — The blocklist check is not a security boundary. For production use, configure the database connection with a read-only user. Document this prominently.
4. **DuckDB version mismatch** — DuckDB's Python package version must match any installed duckdb CLI. Pin to a specific version in pyproject.toml.
