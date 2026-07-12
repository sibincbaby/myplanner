# Aura — Git-Native Semantic Version Control / IDE for AI Coding Agents

**Source:** <https://github.com/CarpseDeam/Aura-IDE>
**Discovered:** 2026-07-13
**Viability:** 3/4

> Directly hits Claude/LLM tooling (wrapper/control layer around Claude Code), Agent UI (IDE dashboard to run/monitor agents), and Dev productivity (verifies AI work, saves tokens). Runs 100% locally, open source, Claude-buildable — strong fit for the user's openclaw/claw-desk agent-UI interests.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 0/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

The user lives in Claude/agent tooling and multi-stack work (TS/JS, Python, Rust, Flutter), so a git-native layer that tracks agent changes at AST level and compresses handover context genuinely fills a gap and would plausibly be opened daily during agent-driven coding. The concept is meaningfully novel — AST-level intent verification, `aura audit` for --no-verify rogue commits, and dense-XML handover aren't well-served by mature open-source tools. However, the full described product (tree-sitter AST diffing across TS/Python/Rust, intent comparison, a whole IDE, audit engine, handover compression) is clearly a multi-week/month effort, not a 1-2 session MVP; weekend_buildable fails. A scoped slice (e.g. just `aura handover` context compression as a CLI) could be weekend-sized, but the project as described cannot, so I score it 0. Total 3 clears the viable bar.

---

## Implementation Plan

The upstream project is a large PySide6 desktop app. The plan below scopes a Claude-buildable slice that captures the genuinely novel value (AST-level agent-change tracking, handover compression, audit) as a standalone CLI, matching the user's tooling interests. Here is the plan.

# Aura-Lite — Git-Native AST Tracker & Context Compressor for AI Coding Agents (Implementation Plan)

## Overview
The upstream Aura-IDE is a ~1,500-commit PySide6 desktop application — far beyond a 1–2 session build. This plan implements the **genuinely novel and Claude-buildable core** as a standalone CLI called `aura-lite`: a git-native layer that (1) tracks what an AI agent changed at the **function/class level** using tree-sitter AST diffing, (2) `aura handover` — compresses the repo's architecture into a dense XML context blob for cheap agent hand-off, and (3) `aura audit` — flags AST-level changes that landed in git (including `--no-verify` commits) so rogue AI edits are caught. It runs 100% locally, no external API required, and slots directly into the user's Claude Code / agent-driven workflow. TS/JS/React, Python, and Rust are supported via prebuilt tree-sitter grammars.

## Stack Recommendation
- **Language:** Python 3.11 (matches upstream; best tree-sitter binding ergonomics; user works in Python).
- **CLI framework:** `typer` (clean subcommand ergonomics, auto `--help`).
- **AST:** `tree-sitter` + `tree-sitter-language-pack` (single pip install ships prebuilt grammars for Python, TS, TSX, JS, Rust — no compilation, no blocker).
- **Git:** `GitPython` for diffs/log/blame; shell out to `git` only where GitPython is awkward.
- **Output:** stdlib `xml.etree.ElementTree` for handover XML; `rich` for terminal audit tables.
- **Packaging:** `pyproject.toml` with a `aura` console-script entry point; `pipx install .`.
- **Tests:** `pytest` with small fixture repos created in `tmp_path`.

## MVP Scope
In scope:
- `aura index` — parse the working tree into a symbol map (file → functions/classes with span + body hash).
- `aura diff` — show which symbols an agent added/removed/modified between two git refs (default: working tree vs `HEAD`), at function/class granularity, not line granularity.
- `aura handover` — emit a dense XML architecture digest (files, exported symbols, signatures, import graph, key TODOs) to stdout or `.aura/handover.xml`, with a token estimate.
- `aura audit` — scan commits in a range (default `HEAD~5..HEAD`) and flag symbol-level changes, highlighting commits made with `--no-verify` (no CI/hook trailer) or touching sensitive paths.

Out of scope (explicitly deferred): the GUI/IDE, MCP server, live agent orchestration, "intent comparison" against a natural-language spec (stubbed as a heuristic only), multi-provider LLM calls.

## Implementation Phases

### Phase 1: Project skeleton + AST symbol extraction
**Goal:** `aura index` parses a Python/TS/Rust file and prints every function/class with its line span and a content hash.
**Files to create/modify:**
- `pyproject.toml` — project metadata, deps (`typer`, `tree-sitter`, `tree-sitter-language-pack`, `GitPython`, `rich`, `pytest`), `aura = "aura_lite.cli:app"` entry point.
- `aura_lite/__init__.py` — version constant.
- `aura_lite/parser.py` — language detection + tree-sitter parse + symbol extraction.
- `aura_lite/models.py` — `Symbol` dataclass (`name, kind, lang, file, start_line, end_line, signature, body_hash`).
- `aura_lite/cli.py` — typer app with `index` command.
- `tests/fixtures/` — one small `sample.py`, `sample.ts`, `sample.rs`.
- `tests/test_parser.py` — asserts extracted symbols.
**Key steps:**
1. `python -m venv .venv && .venv/bin/pip install -e .` after writing `pyproject.toml`.
2. In `parser.py`, map extension → language via `tree_sitter_language_pack.get_language()` / `get_parser()` (`.py`→python, `.ts`→typescript, `.tsx`→tsx, `.js`/`.jsx`→javascript, `.rs`→rust).
3. Write per-language tree-sitter queries capturing `function_definition`/`class_definition` (Python), `function_declaration`/`method_definition`/`class_declaration`/`arrow_function` bound to a variable (TS/JS), `function_item`/`impl_item`/`struct_item` (Rust). Store queries as `.scm` strings in a `QUERIES` dict.
4. For each captured node, build a `Symbol`: `name` from the identifier child, `signature` = first line of node text, `body_hash` = `hashlib.sha1(node_text).hexdigest()[:12]`.
5. `aura index [path]` walks files (respect `.gitignore` via `git ls-files` if in a repo, else `os.walk` skipping `.git`, `node_modules`, `target`, `__pycache__`), prints a `rich` tree.
**Verify:** `aura index tests/fixtures` lists the known functions/classes for all three languages; `pytest tests/test_parser.py -q` passes.

### Phase 2: Symbol-level git diff (`aura diff`)
**Goal:** `aura diff` reports which functions/classes were added, removed, or modified between two git refs at symbol granularity.
**Files to create/modify:**
- `aura_lite/gitutil.py` — resolve refs, read a file's blob at a ref, list changed files between refs.
- `aura_lite/differ.py` — build symbol maps for two states and compute a `SymbolDiff`.
- `aura_lite/cli.py` — add `diff` command (`--base HEAD`, `--target` defaults to working tree).
- `tests/test_differ.py` — fixture git repo, commit, modify a function body, assert it shows as `modified` not `added`.
**Key steps:**
1. In `gitutil.py`, use `GitPython` `repo.git.show(f"{ref}:{path}")` to fetch file content at a ref; use `repo.git.diff("--name-only", base, target)` for changed files (working tree = no target ref).
2. In `differ.py`, parse each changed file at both states into `{symbol_key: Symbol}` where `symbol_key = f"{file}::{qualified_name}"`.
3. Classify: key present only in target = **added**; only in base = **removed**; in both but `body_hash` differs = **modified**; hash equal = unchanged (skip).
4. Handle renames pragmatically: same file + same `body_hash`, different name → report as `renamed`.
5. Render a `rich` table grouped by file: columns status / kind / name / lines.
**Verify:** In a scratch repo, commit a file, change one function's body, run `aura diff` → that function is listed as `modified` and untouched siblings are absent. `pytest tests/test_differ.py -q` passes.

### Phase 3: `aura handover` — dense XML context compression
**Goal:** `aura handover` emits a compact XML architecture digest of the repo with a token-savings estimate versus dumping raw source.
**Files to create/modify:**
- `aura_lite/imports.py` — extract import/require/use statements per language to build a lightweight dependency edge list.
- `aura_lite/handover.py` — assemble the XML digest from symbol maps + imports.
- `aura_lite/cli.py` — add `handover` command (`-o/--out`, `--stdout`, `--top N` files).
- `tests/test_handover.py` — assert well-formed XML with expected symbol/import elements.
**Key steps:**
1. Reuse `parser.py` to collect all symbols; add an import query per language in `imports.py` (Python `import_statement`/`import_from_statement`, TS/JS `import_statement`/`call_expression` named `require`, Rust `use_declaration`).
2. Build XML: `<repo>` → per-file `<file path=… lang=…>` with `<symbol kind name signature/>` children (signatures only — omit bodies, that is the compression) and `<imports>` edges. Add a top-level `<todos>` gathering `TODO/FIXME` comment lines and a `<entrypoints>` heuristic (`main`, `cli`, `index.*`, `__main__`).
3. Rank files by symbol count so `--top N` keeps the architecturally central files when repos are large.
4. Estimate tokens with a cheap heuristic (`len(text)//4`); print `raw≈X tok → handover≈Y tok (Z% saved)` comparing digest size to concatenated source size.
5. Write to `.aura/handover.xml` by default (create dir), or stdout with `--stdout`, so it can be piped straight into a new agent session.
**Verify:** `aura handover --stdout` on this plan's own repo produces valid XML (`python -c "import xml.dom.minidom,sys; xml.dom.minidom.parseString(open('.aura/handover.xml').read())"` succeeds) and prints a >50% token-savings line; `pytest tests/test_handover.py -q` passes.

### Phase 4: `aura audit` — catch rogue/`--no-verify` AI commits
**Goal:** `aura audit` scans a commit range and flags symbol-level changes, surfacing commits that bypassed verification or touched sensitive paths.
**Files to create/modify:**
- `aura_lite/audit.py` — per-commit symbol diff + risk scoring.
- `aura_lite/cli.py` — add `audit` command (`--range HEAD~5..HEAD`, `--fail-on high` exit code).
- `.aura/audit-config.toml` — default sensitive path globs + secret-ish regexes (created on first run).
- `tests/test_audit.py` — fixture repo with a commit adding a suspicious change, assert it is flagged.
**Key steps:**
1. In `audit.py`, iterate commits via `repo.iter_commits(range)`; for each, reuse `differ.py` to get symbol-level changes between the commit and its first parent.
2. Detect `--no-verify` proxy signals: absence of expected hook/CI trailers and, more reliably, commit metadata heuristics — flag commits whose message lacks a conventional prefix AND that modify sensitive files, since actual `--no-verify` leaves no direct trace (document this limitation in `--help`).
3. Risk scoring: +high for touching `--sensitive` globs (`.env*`, `**/secrets*`, `**/*auth*`, CI configs, `package.json` scripts), +high for added lines matching secret regexes (`AKIA[0-9A-Z]{16}`, `sk-…`, private-key headers), +medium for large single-symbol rewrites, +low for ordinary edits.
4. Render a `rich` table: commit sha / author / risk / flagged symbols/paths / reason. Honor `--fail-on high` by exiting non-zero (usable as a git `pre-push` hook or CI gate).
5. On first run, write `.aura/audit-config.toml` with editable globs/regexes and load it thereafter.
**Verify:** In a scratch repo, commit a change adding a fake `AKIA…` string to a `.env`, run `aura audit --range HEAD~1..HEAD` → row flagged **high** and process exits non-zero with `--fail-on high`; `pytest tests/test_audit.py -q` passes.

## Estimated Effort
**4 Claude Code sessions (~10–14 hours).**
- **Session 1 (Phase 1):** scaffold `pyproject.toml`, wire tree-sitter-language-pack, write per-language symbol queries and `aura index` — the riskiest/foundational session because tree-sitter query grammar per language needs iteration.
- **Session 2 (Phase 2):** git plumbing via GitPython and the symbol-level differ with add/remove/modify/rename classification plus fixture-repo tests.
- **Session 3 (Phase 3):** import extraction, XML digest assembly, token-savings estimation, `.aura/handover.xml` output.
- **Session 4 (Phase 4):** audit engine, risk scoring/secret regexes, `--fail-on` exit codes, config file, and a short README with install (`pipx install .`) and a pre-push-hook example.

## Potential Blockers
- **No auth / no external APIs required** — the whole MVP is local, which removes the usual API-key blocker. (The "intent comparison against a spec" feature from upstream is deliberately not built here because it would require an LLM call; it is stubbed/omitted.)
- **Tree-sitter query correctness is the main complexity spike.** Grammar node names differ across languages and versions (e.g. arrow-function methods in TS, `impl` blocks in Rust). Pin `tree-sitter-language-pack` in `pyproject.toml` and validate queries against fixtures early in Phase 1; expect iteration.
- **`--no-verify` is not directly detectable from git history** — Git records no flag when hooks are skipped. `aura audit` must rely on heuristics (missing trailers + sensitive-path/secret signals). This should be stated honestly in `--help` and the README to avoid overclaiming versus the upstream description.
- **TSX/JSX and monorepo scale.** `.tsx` needs the dedicated `tsx` grammar (not `typescript`); large repos (`node_modules`, `target`) must be excluded via `git ls-files` or the digest balloons and the token-savings claim inverts — enforce ignore rules in Phase 1.
- **GitPython edge cases:** shallow clones, detached HEAD, and initial commit (no parent) will break `iter_commits`/parent diffs — guard the first-commit case in Phase 4.
- **Rename detection is heuristic** (hash-based) and can misclassify heavily-edited renames; acceptable for MVP, note as a known limitation.
