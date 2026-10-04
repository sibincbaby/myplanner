# Vault — UserPromptSubmit Context-Injection Hook for Claude Code

**Source:** <https://github.com/Reklund3/vault>
**Discovered:** 2026-10-04
**Viability:** 4/4

> A `UserPromptSubmit` hook that intercepts every prompt going to Claude, retrieves the most relevant chunks from an indexed knowledge store (BM25 + cosine similarity over SQLite FTS5), and appends them within a configurable token budget — invisibly, without changing the prompt text.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

The original is Rust with a local Gemma 4 / MLX embedding stack and Anthropic Haiku for routing. The personal version described below replaces the Rust binary with a TypeScript Claude Code hook (no separate process needed), drops the MLX embedding layer in favour of SQLite FTS5 BM25 (good enough for project notes), and keeps Haiku for the optional semantic re-rank. 1-2 sessions to a working hook; the embedding layer is a stretch goal. Zero polished OSS alternatives do this as a Claude Code hook specifically.

---

## Implementation Plan

**2 Claude Code sessions** to a hook that automatically injects relevant project context into every prompt.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Hook runtime | Claude Code hooks (`UserPromptSubmit`) | No separate binary needed |
| Language | TypeScript | Loads natively in Claude Code hooks |
| Storage | SQLite + FTS5 | BM25 search with no dependencies |
| Driver | `better-sqlite3` | Synchronous, no async needed in hook |
| Embeddings (stretch) | Anthropic `claude-haiku` embeddings via `$.model.embed` | Zero extra infra |
| Ingestion trigger | `PostToolUse` on Write/Edit | Auto-index on file save |

---

## MVP Scope

- A `UserPromptSubmit` hook reads the incoming prompt text, runs an FTS5 BM25 query against an indexed store, and appends the top-3 chunks as a `<vault-context>` block, staying within a configurable token ceiling (default 2 000 tokens).
- A `PostToolUse` hook on Write and Edit chunks and upserts the saved file into the SQLite store.
- A `/vault-add <text>` slash command lets the user manually add notes or decisions.
- A `/vault-search <query>` command for interactive lookup.
- Config: `VAULT_PATH` (default `~/.claude/vault.db`), `VAULT_TOKEN_BUDGET` (default 2 000), `VAULT_MIN_SCORE` (default 0.15 BM25 threshold).

Out of scope for MVP: MLX or LanceDB vector search, TTL expiry, repo-scoped namespaces.

---

## Implementation Phases

### Phase 1: SQLite store and FTS5 ingestion

**Goal:** A file-backed SQLite database with an FTS5 virtual table, a chunking function, and a search function.

**Files:**
- `hooks/lib/db.ts` — `openDb(path)`, `upsert(docId, chunks[])`, `search(query, limit, minScore)` returning `{chunk, score, docId}[]`
- `hooks/lib/chunk.ts` — `chunkText(text, maxTokens=400)` → `string[]` (splits on blank lines, then size)
- `hooks/lib/tokens.ts` — `estimateTokens(text)` → number (4 chars/token heuristic)

**Key steps:**
1. `CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(doc_id, text, tokenize='porter')` plus a `CREATE TABLE IF NOT EXISTS meta(doc_id TEXT PRIMARY KEY, path TEXT, updated INTEGER)`.
2. Upsert: delete existing rows for `doc_id`, insert new chunks with `INSERT INTO chunks(doc_id,text)`.
3. Search: `SELECT doc_id, text, rank FROM chunks WHERE chunks MATCH ? ORDER BY rank LIMIT ?`, filtering by `rank < -minScore` (FTS5 rank is negative BM25).
4. Chunk: split on double newline, then merge until a chunk would exceed `maxTokens` estimate.

**Verify:** Unit-test `search` with a 5-doc fixture; confirm `rank` ordering is correct and `minScore` filter removes noise.

---

### Phase 2: Hooks wiring

**Goal:** `UserPromptSubmit` injects context; `PostToolUse` auto-indexes writes; slash commands work.

**Files:**
- `hooks/register.ts` — hook registrations
- `hooks/lib/inject.ts` — `buildContextBlock(chunks[], budget)` → string within token budget

**Key steps:**
1. `on('userPromptSubmit', async ($, e, next) => {...})`:
   - Open DB (cache the connection in a module-level variable; re-open if the file changes).
   - Call `search(e.text, 6, 0.15)`.
   - Build the context block with `buildContextBlock`, staying under budget.
   - If the block is non-empty, return `next({...e, text: e.text + '\n\n' + block})`.
   - Otherwise return `next(e)`.
2. `on('postToolUse', { tool: ['Write','Edit'] }, async ($, e, next) => {...})`:
   - Read the saved file path from `e.filePath`.
   - Read the file with `$.fs.read(e.filePath)` (skip binary files: check for null bytes).
   - Chunk and upsert into DB with `doc_id = e.filePath`.
   - Return `next(e)`.
3. Register `/vault-add <text>` in `session.start`:
   - On `command.run`, upsert with `doc_id = 'manual:' + Date.now()`, chunk size = whole text.
   - Return `{text: 'vault: saved'}`.
4. Register `/vault-search <query>` similarly:
   - Run `search(args, 5, 0.0)`, format as markdown list, return `{text: ...}`.

**Verify:** Start `claude --plugin-dir .`, write a file with a distinctive phrase, then ask a question that should surface it. Confirm the `<vault-context>` block appears in the prompt (visible in `/debug` output or via a `userPromptSubmit` log).

---

### Phase 3: Bootstrap indexing and config

**Goal:** The user can index an existing project directory on first run.

**Files:**
- `scripts/index.ts` — CLI: `ts-node scripts/index.ts <dir> [--ext ts,md,py]`
- `hooks/lib/config.ts` — reads `VAULT_PATH`, `VAULT_TOKEN_BUDGET`, `VAULT_MIN_SCORE` from `$.env`

**Key steps:**
1. `index.ts`: walk the directory with `glob('**/*.{ts,md,py,...}', {ignore:['node_modules','dist']})`, read each file, chunk, upsert. Print progress.
2. In `config.ts`, export `getConfig($)` reading from env with sensible defaults.
3. Document `.claude/settings.json` snippet: `"env": {"VAULT_PATH": "~/.claude/vault.db", "VAULT_TOKEN_BUDGET": "2000"}`.

**Verify:** Run `ts-node scripts/index.ts ~/my-project`, then start Claude Code and verify context is injected for a question about a symbol in the indexed project.

---

## Estimated Effort

About 1-2 Claude Code sessions.
- **Session 1 (≈ 2 h):** Phases 1 and 2. SQLite FTS5 schema, chunking, search, hook wiring, and live test in a real project.
- **Session 2 (≈ 1.5 h):** Phase 3 + stretch. Bootstrap indexer, config env vars, and optionally a semantic re-rank pass using `$.model.embed` with dot-product.

## Potential Blockers

- **`PostToolUse` timing:** If the hook runs before the file is flushed to disk, `$.fs.read` may return stale content. Add a 50 ms `$.clock.sleep` or re-read until size stabilises.
- **Binary files:** Check for null bytes in the first 512 bytes before indexing. Skip `.lock`, `.db`, image, and binary files.
- **Module-level DB handle:** The DB connection must be re-opened if `VAULT_PATH` changes between sessions, or just open lazily on first use.
- **Token budget accuracy:** The 4 chars/token heuristic under-estimates code. For safety, set the budget 20% lower than the real target.
- **FTS5 porter stemmer:** Over-stems some technical terms (e.g., "typing" → "type"). Acceptable for notes; if precision matters, switch to `tokenize='unicode61'`.
