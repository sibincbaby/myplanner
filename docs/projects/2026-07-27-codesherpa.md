# CodeSherpa

> A lightweight MCP server that pre-maps your codebase as a call graph so Claude Code can find blast radius, callers, and related files without re-reading everything from scratch

**Inspired by:** [tirth8205/code-review-graph](https://github.com/tirth8205/code-review-graph) (GitHub discovery July 27 2026)  
**Date discovered:** 2026-07-27

---

## What gap it fills

Every Claude Code session re-reads source files from scratch to understand "what calls this function?" or "what breaks if I change this?" The code-review-graph project benchmarks an 82× token reduction by pre-building a persistent structural map. But code-review-graph ships 30 MCP tools and a full daemon — it's a product. CodeSherpa is personal infrastructure: 5 focused tools, a Python script you run once (`codesherpa index .`) and a `codesherpa serve` that integrates with Claude Desktop in 60 seconds.

Concrete daily value: ask Claude Code "show me everything that imports `auth.py`" and instead of reading 40 files it calls `find_callers("auth.py")` and gets back 12 precise callsites. Same for change-impact analysis: "what breaks if I rename this method?" calls `blast_radius("MyClass.authenticate")` and gets a ranked list.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| AST parsing | `tree-sitter` (Python bindings) | 30+ languages; incremental re-parse; same engine as Neovim/Helix |
| Graph storage | SQLite (stdlib `sqlite3`) | Single `.codesherpa.db` file per project; FTS5 for name search |
| MCP server | `fastmcp` | Zero-boilerplate tool registration; Claude Desktop stdio compat |
| File watching | `watchdog` | Sub-second incremental updates on file save |
| CLI | `click` | `codesherpa index`, `codesherpa serve`, `codesherpa query` |
| Grammars | `tree-sitter-languages` PyPI package | All grammars in one wheel; no per-language install |

## MVP scope (1 Claude session)

Python package that:

1. Indexes a codebase into a SQLite graph: nodes (function/class/file), edges (imports, calls)
2. Runs as an MCP server with **5 tools**:
   - `find_callers(name)` → list of call-sites
   - `find_callees(name)` → functions this function calls
   - `blast_radius(name)` → all nodes transitively depending on `name`
   - `changed_files(since_commit)` → files changed since a git ref + their transitive callers
   - `search_symbol(query)` → FTS5 search across all symbol names
3. Stores DB in `<project-root>/.codesherpa.db` (gitignored)
4. `claude_desktop_config.json` snippet in README for one-command server setup

Out of scope for MVP: web UI, cross-repo analysis, semantic embeddings, language server protocol.

## Phases

### Phase 1 — SQLite schema + tree-sitter indexer (1.5 h)
- Schema: `nodes(id, name, kind, file, line, project)` + `edges(from_id, to_id, edge_type)` + `nodes_fts` virtual table
- `edge_type` values: `imports`, `calls`, `defines`, `inherits`
- `indexer.py`: walk project files, pick grammar by extension, extract definitions + call-sites, upsert into SQLite
- One-shot index: `codesherpa index .` builds DB from scratch (incremental comes in Phase 4)
- Prune deleted files automatically before re-index

### Phase 2 — Graph query functions (45 min)
- `get_callers(name, file=None)` → rows from edges WHERE to_id=name_node
- `get_callees(name)` → rows from edges WHERE from_id=name_node
- `blast_radius(name, depth=3)` → BFS traversal of `imports` + `calls` edges up to `depth` hops; returns ranked list by hop count
- `changed_files(ref="HEAD~1")` → `git diff --name-only ref` piped to blast_radius for each changed symbol
- `search_symbol(q)` → FTS5 MATCH on `nodes_fts`, return top-10 ranked

### Phase 3 — MCP server (1 h)
- `server.py` using `fastmcp`, stdio transport
- Register all 5 tools with typed parameters and rich docstrings (Claude reads these)
- Tool results as JSON arrays: `[{name, file, line, kind, distance}]`
- `codesherpa serve` entry point; reads DB path from env or walks up to find `.codesherpa.db`

### Phase 4 — Incremental watcher (1 h)
- `watchdog` observer on project root, ignoring `.git`, `node_modules`, `__pycache__`
- On file-change event: re-parse only that file, delete old nodes/edges for that file, re-insert
- Debounce 200 ms to batch rapid saves
- Wire into `codesherpa serve --watch` flag; server stays running and DB stays current

### Phase 5 — CLI polish + README (30 min)
- `codesherpa query blast-radius MyClass.authenticate` for quick shell queries without starting the MCP server
- `pyproject.toml` with `[project.scripts]`; `pip install` or `uv tool install`
- README: 3-step quickstart, Claude Desktop JSON snippet, example session showing 82× token drop

## Effort estimate

~4.75 hours all phases · 1–2 Claude sessions  
Phase 1–3 alone is a working MVP in ~3.25 hours

## Blockers / risks

- **Dynamic dispatch / duck typing**: Python `obj.method()` where `obj` is not statically typed won't resolve. Accept this: the graph covers ~80% of real call-sites and the remaining 20% is noted in the README.
- **tree-sitter grammar quality varies**: Some language grammars are mature (Python, TS, Go, Rust, C), others are experimental. Start with Python + TypeScript, add others on demand.
- **Large monorepos**: Indexing a 100k-file repo takes minutes. Add `--include` / `--exclude` glob flags in Phase 1 and document a "scope to src/" pattern.
- **Overlap with code-review-graph**: That project is the right choice for teams. CodeSherpa is personal infrastructure — install it in 60 seconds, own the code, tweak it. Position it that way.
- **`.codesherpa.db` in git**: Add to default `.gitignore` templates; make the path configurable for monorepos with a shared cache directory.
