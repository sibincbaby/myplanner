# CodeGraph

> A pre-indexed, auto-syncing code knowledge graph for Claude Code and other coding agents: deterministic AST parsing builds a JSON graph your agent reads instead of crawling files — 60% lower cost, 69% fewer tool calls per session.

**Inspired by:** [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)  
**Date discovered:** 2026-07-30

---

## What gap it fills

Every Claude Code session starts blind: the agent re-reads entry files, follows imports, re-traces call graphs. On a medium project (~50 files) this costs 10-15 tool calls and thousands of tokens before any real work begins. CodeGraph solves this by giving Claude a pre-built map — a JSON knowledge graph of every symbol, import, and relationship — so the agent can answer "where is `AuthService` defined and what does it call?" in one lookup instead of five file reads.

The benchmark from the colbymchenry repo (July 2026): 60% lower token cost, 69% fewer tool calls, measured across seven repos from Django to Next.js. The graph auto-syncs on file changes via a lightweight watcher, so it stays current without manual rebuilds.

Concrete daily value: open any project in Claude Code, run `/graph-load`, and every subsequent question about "what calls X", "which files depend on Y", "find all usages of Z" resolves from the pre-built index instead of spawning a file-crawl loop.

Viability score: **4/4** (weekend_buildable ✅, fills_gap ✅, novel ✅, daily_utility ✅)

---

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Parser | `tree-sitter` (Python bindings: `tree-sitter-languages`) | Supports 25+ languages; deterministic, no LLM needed for parsing |
| Graph format | JSON (nodes: symbols; edges: calls/imports/inherits) | Directly readable by Claude without extra tooling |
| Watcher | `watchdog` (Python) | Cross-platform file-change watcher, triggers incremental graph updates |
| CLI | Python `typer` | `codegraph build`, `codegraph watch`, `codegraph query` |
| Skill | `SKILL.md` for `/graph-load` and `/graph-query` | Claude Code auto-discovers and uses the graph |
| Storage | `codegraph.json` in project root (gitignore it) | Zero-config; no server, no DB |

---

## MVP scope (1-2 Claude sessions)

**Session 1 — Build + query:**
- `codegraph build` command: walk project files, parse with tree-sitter, emit `codegraph.json` (nodes: file, class, function, variable; edges: imports, calls, inherits)
- `/graph-load` skill: reads `codegraph.json` and injects a condensed summary into Claude's context at session start ("Project has 47 files, 312 functions, 28 classes. Top-level modules: auth, api, db, utils.")
- Manual test on a real project (e.g., this planner repo) — verify Claude answers structural questions without file reads

**Session 2 — Auto-sync + query skill:**
- `codegraph watch` command: `watchdog` daemon runs incremental re-parses on file save
- `/graph-query` skill: "find all callers of X", "list files that import Y", "what does Z class inherit from?" — answered from `codegraph.json` in zero tool calls
- CLAUDE.md entry: tell Claude to load the graph before any code navigation

---

## 3-Phase roadmap

### Phase 1 — Static graph builder (Session 1)
Build + query CLI. tree-sitter parses Python/JS/TS to start. Output `codegraph.json`. `/graph-load` skill for Claude Code.

### Phase 2 — Auto-sync + rich queries (Session 2)
File watcher for incremental updates. `/graph-query` skill for natural-language graph traversal. Add Go, Rust, Dart support via tree-sitter grammars.

### Phase 3 — Diff-aware hints
On `git diff`, emit a "changed symbols + affected callers" summary that Claude sees before suggesting edits. Prevents Claude from missing call-site updates. Optional: export graph to SQLite for larger codebases.

---

## Effort estimate

| Phase | Effort | Output |
|-------|--------|--------|
| Phase 1 | 1 Claude session (~2 hrs) | Build CLI + graph-load skill, works on Python/JS/TS |
| Phase 2 | 1 Claude session (~1.5 hrs) | Auto-sync watcher + graph-query skill + 6 language support |
| Phase 3 | 1 Claude session (~1 hr) | Diff-aware hints + SQLite backend |

Total: **3 sessions, ~4.5 hours elapsed**

---

## Blockers / watch-outs

- **Tree-sitter grammar correctness**: Some languages (especially TypeScript with complex generics) need the `tree-sitter-typescript` grammar, not the JS one — check grammar coverage before committing to a language list
- **Graph staleness**: The watcher must handle rapid saves (e.g., auto-formatter runs) without corrupting the JSON — debounce writes by 500 ms
- **Large repos**: Projects with 500+ files produce large JSON; switch to SQLite with `sqlite3` in Phase 3 before graph reads become slow
- **Dynamic dispatch**: AST parsing can't resolve runtime dispatch (duck typing in Python, interface dispatch in Go) — document this caveat so Claude doesn't over-trust the call graph for dynamic languages

---

## Why now

The colbymchenry/codegraph 2026-07 re-validation landed this week with concrete benchmarks showing 60%+ cost savings. Context costs are the primary scaling constraint for daily Claude Code use. A personal CodeGraph build is achievable in one session with Python + tree-sitter, and the output (a JSON graph + two SKILL.md files) pays back its build time in the first week of daily use.
