# Foremerge — Catch Intent Conflicts Between Parallel Coding Agents Before They Become Git Conflicts

**Source:** <https://github.com/naw103/foremerge>
**Discovered:** 2026-09-22
**Viability:** 3/4

> Most multi-agent tooling solves orchestration (worktrees, tmux, kanban); this solves the failure mode that actually bites — two agents independently deciding to refactor the same thing. The MCP surface means it plugs into Claude Code directly with no harness changes, and 425 stars says the problem resonates broadly.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

An MVP is well-scoped for a focused sprint: a SQLite-backed claim registry (agent declares files/symbols/intent), an overlap checker, a thin CLI, and an MCP server exposing register/check/release — no ML needed for v1, just scope overlap plus optional LLM intent comparison. It fills a real gap: the user builds agent UIs and Claude CLI wrappers (openclaw, claw-desk, gravity-claw) but has nothing coordinating concurrent agents, and it is meaningfully distinct from git worktree managers and orchestrators that only detect collisions after code is written. Daily utility is the weak leg — it only pays off on days with genuinely parallel agents touching the same repo, which for a solo developer is intermittent rather than constant; still, 3/4 makes it worth building.

---

## Implementation Plan

## Overview

Foremerge is a local coordination layer that sits *above* Git. Before an agent writes code, it registers a **claim**: the files/globs and symbols it intends to touch, plus a natural-language intent string. Foremerge stores claims in a SQLite registry scoped per-repo and answers one question fast: *does what I'm about to do collide with what another live agent already claimed?* Collisions are reported as **path overlap** (deterministic), **symbol overlap** (deterministic, via tree-sitter), and optionally **intent overlap** (LLM comparison of intent strings when scopes are disjoint but the described work rhymes — e.g. "extract auth middleware" vs "consolidate request guards").

The reimplementation target is a personal-scale tool: one developer, several Claude Code sessions, one repo. That shapes everything — no server, no auth, no multi-machine sync. A single SQLite file at `.foremerge/registry.db` in the repo root, a CLI for humans and hooks, and an MCP server (stdio) so Claude Code sessions call `foremerge_claim` / `foremerge_check` / `foremerge_release` as tools with zero harness changes.

Daily utility is the honest weak point, so the plan front-loads the *passive* path: a Git pre-commit hook and a Claude Code `SessionStart`/`PreToolUse` hook that auto-claim and auto-check without the user remembering the tool exists. If it only works when you remember to call it, it will not get used.

## Stack Recommendation

**Rust**, matching the upstream project and giving a single static binary that both the CLI and MCP server ship from (`foremerge` and `foremerge mcp`).

| Concern | Choice | Why |
|---|---|---|
| CLI | `clap` 4 (derive) | subcommands, shell completions for free |
| Storage | `rusqlite` 0.32 (`bundled` feature) | no system SQLite dependency; single-file DB |
| Migrations | `rusqlite_migration` | versioned schema without a heavy ORM |
| Async runtime | `tokio` (rt-multi-thread, io-std) | required by MCP transport + LLM calls |
| MCP server | `rmcp` (official Rust MCP SDK) with `transport-io` | stdio server, `#[tool]` macros |
| Serialization | `serde`, `serde_json` | MCP payloads + `--json` CLI output |
| Path matching | `globset` + `path-clean` | glob claims, normalized repo-relative paths |
| Symbol extraction | `tree-sitter` + `tree-sitter-{rust,javascript,typescript,python,dart}` | language-aware symbol lists |
| Git introspection | `gix` (read-only) | repo root discovery, current branch, HEAD sha — avoids shelling out |
| LLM intent check | `reqwest` + JSON to an OpenAI-compatible endpoint | works with the local `devgate` endpoint in dev, real key in prod |
| Errors | `thiserror` (lib) + `anyhow` (bin) | idiomatic split |
| Terminal output | `owo-colors` + `tabled` | readable `foremerge status` |
| Testing | `assert_cmd`, `predicates`, `tempfile`, `insta` | CLI golden tests |

Deliberately excluded from v1: any daemon, any network listener, any embedding model, any vector store. Overlap is set intersection; intent comparison is one optional LLM call.

## MVP Scope

**In:**
1. `foremerge init` — create `.foremerge/registry.db`, add `.foremerge/` to `.gitignore`.
2. `foremerge claim` — register agent id, session id, branch, file globs, optional symbols, intent text, TTL. Returns a claim id and any conflicts found at claim time.
3. `foremerge check` — dry-run a prospective scope against live claims; exit code 0 clean / 2 conflict. Hook-friendly.
4. `foremerge release <id> | --session <id>` — release claims; auto-release on TTL expiry.
5. `foremerge status` — table of live claims, who owns what, age, TTL remaining.
6. Overlap engine: path/glob intersection, symbol intersection (same file + same symbol name), severity ranking (`hard` = same file+symbol, `soft` = same file, `advisory` = intent-only).
7. `foremerge mcp` — stdio MCP server exposing `foremerge_claim`, `foremerge_check`, `foremerge_release`, `foremerge_status`.
8. Optional `--intent-check` LLM pass, off by default, degrades silently to deterministic-only when no endpoint configured.
9. Git `pre-commit` hook + Claude Code hook JSON snippet, installed by `foremerge install-hooks`.

**Out of v1:** multi-repo/global registry, remote sync, web UI, automatic scope inference from an agent's plan, conflict *resolution* (v1 only reports), non-tree-sitter languages (fall back to path-level claims), claim negotiation/queuing.

## Implementation Phases

### Phase 1: Core registry and overlap engine (library)

**Goal:** A Rust library that persists claims to SQLite and, given a prospective scope, returns a ranked list of conflicting live claims — proven by unit tests, no CLI yet.

**Files to create/modify:**
- `Cargo.toml` — workspace-less binary+lib crate, deps: `rusqlite` (bundled), `rusqlite_migration`, `serde`, `serde_json`, `globset`, `path-clean`, `gix`, `thiserror`, `chrono`, `uuid`
- `src/lib.rs` — public API surface: `Registry`, `Claim`, `Scope`, `Conflict`, `Severity`
- `src/model.rs` — `Claim`, `Scope { paths: Vec<String>, symbols: Vec<SymbolRef> }`, `SymbolRef { file: String, name: String }`, `Conflict`, `Severity { Hard, Soft, Advisory }`
- `src/db.rs` — connection open, migration runner, CRUD
- `src/migrations/001_init.sql` — schema
- `src/overlap.rs` — the intersection logic
- `src/repo.rs` — repo root discovery via `gix`, path normalization to repo-relative
- `tests/overlap.rs` — table-driven overlap tests

**Key steps:**
1. `cargo init --name foremerge`, set `[lib] path = "src/lib.rs"` and `[[bin]] name = "foremerge"`. Pin edition 2021.
2. Write `001_init.sql`: table `claims(id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, session_id TEXT, branch TEXT, intent TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER, released_at INTEGER, status TEXT NOT NULL DEFAULT 'active')`; table `claim_paths(claim_id TEXT, pattern TEXT, is_glob INTEGER)`; table `claim_symbols(claim_id TEXT, file TEXT, symbol TEXT)`; indexes on `claims(status, expires_at)`, `claim_paths(claim_id)`, `claim_symbols(file, symbol)`. Foreign keys with `ON DELETE CASCADE`, and `PRAGMA foreign_keys=ON` + `PRAGMA journal_mode=WAL` + `PRAGMA busy_timeout=5000` on every open (WAL and busy_timeout matter — concurrent agents *will* hit the DB simultaneously).
3. Implement `Registry::open(repo_root)` → creates `.foremerge/registry.db`, runs migrations idempotently.
4. Implement `Registry::sweep_expired()` — mark `status='expired'` where `expires_at < now`. Call it at the top of every read so stale claims from a crashed agent never block anyone. This is the single most important robustness detail: a dead agent must not deadlock the repo.
5. Implement `Registry::insert_claim`, `list_active`, `release(id)`, `release_session(session_id)`.
6. Implement `overlap::find_conflicts(prospective: &Scope, live: &[Claim], self_agent: &str) -> Vec<Conflict>`:
   - Normalize every path: repo-relative, `path-clean`, forward slashes.
   - Build a `GlobSet` per live claim from its patterns; a prospective literal path conflicts if any live glob matches it. For glob-vs-glob, compare literal prefixes plus exact-pattern equality (document this as a deliberate approximation — full glob intersection is undecidable-ish and not worth it).
   - Severity: same file AND intersecting symbol names → `Hard`; same file, no symbol info on either side → `Soft`; same file but provably disjoint symbol sets → `Soft` downgraded to `Advisory`.
   - Always exclude claims whose `agent_id` equals the caller's (an agent never conflicts with itself), but *not* claims from the same agent id in a different session — surface those as `Advisory`.
7. Write `tests/overlap.rs` covering: identical path, glob-covers-literal, disjoint dirs, same file/different symbols, same file/same symbol, expired claim ignored, self-claim ignored.

**Verify:** `cargo test` — all overlap tests pass; `cargo clippy --all-targets -- -D warnings` clean.

### Phase 2: CLI

**Goal:** A working `foremerge` binary — two terminals can claim overlapping scopes and the second one is told exactly who it collides with, with a nonzero exit code.

**Files to create/modify:**
- `src/main.rs` — clap parser + dispatch
- `src/cli/mod.rs`, `src/cli/{init,claim,check,release,status}.rs` — one module per subcommand
- `src/output.rs` — human table (`tabled` + `owo-colors`) and `--json` renderers
- `src/config.rs` — `.foremerge/config.toml` (default TTL, default agent id, LLM endpoint)
- `tests/cli.rs` — `assert_cmd` end-to-end tests against a `tempfile` repo

**Key steps:**
1. Define the clap enum: `Init`, `Claim`, `Check`, `Release`, `Status`, `Mcp`, `InstallHooks`. Global flags: `--json`, `--repo <path>`, `--agent <id>`.
2. Agent identity resolution order: `--agent` flag → `FOREMERGE_AGENT_ID` env → `CLAUDE_SESSION_ID` env → hostname+pid. Session id from `--session` → `CLAUDE_SESSION_ID` → generated uuid persisted in `.foremerge/session`.
3. `claim` flags: `--path <glob>` (repeatable), `--symbol <file:name>` (repeatable), `--intent <text>` (required), `--ttl <duration>` (default `2h`, parsed with `humantime`), `--force` (claim anyway despite conflicts, recording that it was forced).
4. `check` takes the same `--path`/`--symbol`/`--intent` flags but writes nothing. Exit codes: `0` no conflict, `2` conflict found, `1` error. Hooks depend on this contract — document it in `--help`.
5. `status` renders a table: claim id (short), agent, intent (truncated 60 chars), paths count, age, TTL left. `--all` includes released/expired.
6. `init` creates `.foremerge/`, writes `config.toml` with commented defaults, appends `.foremerge/` to the repo `.gitignore` (idempotent — grep before appending).
7. Human-readable conflict output must name the other agent, its intent, and the specific overlapping path/symbol. "Conflict detected" alone is useless to an agent trying to decide what to do next.
8. `tests/cli.rs`: init → claim A → check B overlapping (expect exit 2 + agent A named in stdout) → release A → check B (expect exit 0).

**Verify:** In a scratch repo: `foremerge init && foremerge --agent alice claim --path 'src/auth/**' --intent 'refactor auth middleware' && foremerge --agent bob check --path src/auth/session.rs --intent 'add session timeout'; echo "exit=$?"` → prints the conflict naming alice, `exit=2`.

### Phase 3: MCP server

**Goal:** A Claude Code session with Foremerge configured can call `foremerge_claim` and `foremerge_check` as native tools and get structured conflict reports back.

**Files to create/modify:**
- `src/mcp/mod.rs` — `rmcp` server construction, stdio transport wiring
- `src/mcp/tools.rs` — the four tool handlers
- `src/cli/mcp.rs` — `foremerge mcp` subcommand entry
- `Cargo.toml` — add `rmcp` (features `server`, `transport-io`, `macros`), `tokio`
- `.mcp.json.example` — drop-in config for Claude Code
- `README.md` — install + MCP setup section

**Key steps:**
1. Add a `#[tokio::main]`-flavored async entry only for the `mcp` subcommand; keep the rest of the CLI synchronous (do not async-ify the whole binary for one subcommand).
2. Build a `ForemergeTools` struct holding `Arc<Mutex<Registry>>` (SQLite connection is not `Sync`; a mutex around it is correct and cheap at this scale — contention is nil).
3. Define tools with `rmcp`'s `#[tool]` derive:
   - `foremerge_claim { paths: string[], symbols?: string[], intent: string, ttl_minutes?: number }`
   - `foremerge_check { paths: string[], symbols?: string[], intent?: string }`
   - `foremerge_release { claim_id?: string }` (defaults to releasing the calling session's claims)
   - `foremerge_status {}`
4. Tool *descriptions* are the real product surface here — they are the only instruction the model gets. Write them imperatively: "Call before you begin editing. Declare every file you expect to modify. If conflicts are returned, do not proceed; report the conflict to the user and propose coordination." Test the wording by actually running two sessions, not by reading it.
5. Return structured JSON content (not prose) from every tool: `{ "conflicts": [...], "claim_id": "...", "verdict": "clear" | "conflict" }`. Include a `recommendation` string per conflict so the model has an obvious next action.
6. Agent identity in MCP mode: derive from the MCP client info (`clientInfo.name` + pid) and allow override via `FOREMERGE_AGENT_ID` in the `.mcp.json` `env` block. Each Claude Code session must get a distinct id or the whole thing is a no-op.
7. Write `.mcp.json.example`:
   ```json
   { "mcpServers": { "foremerge": { "command": "foremerge", "args": ["mcp"],
     "env": { "FOREMERGE_AGENT_ID": "${CLAUDE_SESSION_ID}" } } } }
   ```
8. Add `tests/mcp_stdio.rs`: spawn the binary, write a raw `initialize` then `tools/list` JSON-RPC frame to stdin, assert all four tools are listed. This catches transport regressions without needing a live model.

**Verify:** `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | foremerge mcp` lists four tools; then in a real repo with `.mcp.json` installed, run `claude` and confirm `/mcp` shows foremerge connected, and two parallel sessions claiming `src/auth/**` produce a conflict in the second.

### Phase 4: Symbol extraction and LLM intent comparison

**Goal:** Claims can be file-level *or* symbol-level, symbols are auto-extracted from claimed files, and disjoint-scope-but-same-idea collisions get flagged by an optional LLM pass.

**Files to create/modify:**
- `src/symbols.rs` — tree-sitter parsing, language dispatch by extension
- `src/intent.rs` — LLM intent comparison client
- `src/overlap.rs` — wire intent results into `Severity::Advisory` conflicts
- `src/config.rs` — add `[intent]` section: `enabled`, `endpoint`, `model`, `api_key_env`
- `tests/symbols.rs` — fixture files per language
- `tests/fixtures/` — small `.rs`, `.ts`, `.py`, `.dart` samples

**Key steps:**
1. Add `tree-sitter` plus grammars for rust, typescript, javascript, python, dart. Map extension → language; unknown extensions return `None` and the claim silently stays path-level (never error out on an unsupported language).
2. Implement `symbols::extract(path) -> Vec<String>` using per-language queries for function/method/class/struct/impl names. Keep queries in `src/queries/{lang}.scm` and `include_str!` them.
3. Add `foremerge claim --auto-symbols`: for each claimed path that resolves to an existing file, extract symbols and store them. Cap at ~200 symbols per claim to keep the DB sane.
4. Implement `intent::compare(a, b) -> Option<IntentVerdict>`: single chat-completion call to an OpenAI-compatible endpoint with a strict JSON-schema-ish prompt returning `{ "collides": bool, "confidence": 0..1, "reason": string }`. Use the `gateway-endpoint` / `devgate` local endpoint during development instead of a real key.
5. Gate it hard: only run when `[intent].enabled = true`, only for claim pairs with *no* deterministic overlap, cap at N=5 comparisons per check, 3-second timeout, and on any error return `None` and continue. The deterministic path must never be slowed or broken by the LLM path.
6. Cache verdicts in a new `intent_cache(hash_a, hash_b, collides, reason, created_at)` table keyed by a hash of the two intent strings — the same pair gets compared repeatedly across checks otherwise.
7. Report intent-only collisions as `Severity::Advisory` with the LLM's `reason` verbatim, clearly labeled as a heuristic so it is never confused with a hard file-level conflict.

**Verify:** `cargo test --test symbols` passes for all four languages; then `foremerge --agent alice claim --path src/auth/mw.rs --auto-symbols --intent 'extract auth middleware'` followed by `foremerge --agent bob check --path src/guards/req.rs --intent 'consolidate request guards' --intent-check` reports an advisory collision with a reason string, while the same command without `--intent-check` reports clean.

### Phase 5: Passive integration, packaging, docs

**Goal:** Foremerge works without anyone remembering it exists — hooks auto-check on commit and on agent edits — and the binary is installable in one command.

**Files to create/modify:**
- `src/cli/install_hooks.rs` — writes Git and Claude Code hooks
- `hooks/pre-commit` — template shell hook
- `hooks/claude-settings-snippet.json` — `PreToolUse`/`SessionEnd` config
- `.github/workflows/ci.yml` — fmt, clippy, test on push
- `.github/workflows/release.yml` — `cargo-dist` or manual cross-build for linux/macos
- `README.md` — full usage, conflict-severity table, MCP setup
- `CLAUDE.md` — repo conventions so future sessions pick up context

**Key steps:**
1. `foremerge install-hooks` writes `.git/hooks/pre-commit` that runs `foremerge check --paths-from-staged --agent "$USER-manual"` and warns (exit 0, print warning) rather than blocking by default; `--strict` makes it block. Chain to any existing pre-commit hook rather than clobbering it — detect and back up to `pre-commit.foremerge-backup`.
2. Add `foremerge check --paths-from-staged` reading `git diff --cached --name-only` via `gix`.
3. Write the Claude Code hook snippet: a `PreToolUse` matcher on `Edit|Write` that pipes the target file path into `foremerge check --path "$FILE" --quiet`, printing a warning into the transcript on exit 2. Keep it advisory — a blocking hook that misfires will get uninstalled within a day. Also add a `SessionEnd` hook running `foremerge release --session "$CLAUDE_SESSION_ID"` so claims never leak past a session.
4. Add `foremerge status --watch` (2-second poll, redraw) for a glanceable "what are my agents doing" pane.
5. CI: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` on ubuntu + macos.
6. Release workflow producing `x86_64-unknown-linux-gnu` and `aarch64-apple-darwin` binaries; document `cargo install --git`.
7. README with a 60-second quickstart, the severity table, the `.mcp.json` block, and an explicit "what this does NOT do" section (it does not resolve conflicts, does not sync across machines, does not replace Git).
8. Write `CLAUDE.md` capturing: the exit-code contract, the "sweep before read" invariant, the "LLM path must never block the deterministic path" rule.

**Verify:** In a real repo with two live Claude Code sessions: session A calls `foremerge_claim` on `src/api/**`; session B then tries to `Edit src/api/routes.ts` and the PreToolUse hook surfaces the conflict naming session A in B's transcript. Then `git commit` with staged `src/api/routes.ts` prints the pre-commit warning. Kill session A; confirm `foremerge status` shows its claims released.

## Estimated Effort

**4–5 Claude Code sessions.**

- **Session 1 — Phases 1:** crate scaffold, schema + migrations, the overlap engine and its test table. The overlap semantics (glob-vs-glob, severity ladder, self-exclusion, expiry sweep) are where the thinking is; getting them right here makes every later phase mechanical.
- **Session 2 — Phase 2:** clap surface, five subcommands, identity resolution, output rendering, end-to-end CLI tests. Mostly plumbing, but the exit-code contract and conflict message quality deserve real attention.
- **Session 3 — Phase 3:** `rmcp` wiring, four tool handlers, `.mcp.json`, and the empirical loop of tuning tool descriptions by running two actual Claude sessions. Budget time for MCP SDK API drift — the crate moves fast.
- **Session 4 — Phase 4:** tree-sitter grammars and queries for four languages (the per-language `.scm` queries are fiddly), plus the intent LLM client, caching, and gating.
- **Session 5 — Phase 5:** hooks, CI, cross-build release, README/CLAUDE.md, and the two-session live validation. Can compress into half a session if Phase 4 goes cleanly; call it 4.5 sessions realistically.

## Potential Blockers

1. **`rmcp` API churn.** The official Rust MCP SDK is pre-1.0 and its `#[tool]` macro signature and transport constructors have changed between minor versions. Mitigation: pin an exact version in `Cargo.toml` (`rmcp = "=0.x.y"`), and resolve the actual current API via Context7 / `docs.rs` at the start of Phase 3 rather than writing from memory. If it fights back, the fallback is a hand-rolled JSON-RPC-over-stdio loop — MCP's stdio protocol is ~200 lines to implement directly, and that is a legitimate escape hatch, not a defeat.
2. **Agent identity is the whole ballgame.** If two Claude Code sessions both report the same `agent_id`, every conflict self-cancels and the tool silently does nothing while appearing to work. Verify early and explicitly that `CLAUDE_SESSION_ID` (or whatever the harness actually exposes — confirm the env var name empirically, do not assume) differs per session. Add a `foremerge whoami` command in Phase 2 purely to make this debuggable.
3. **Glob-vs-glob intersection.** Deciding whether `src/**/*.rs` overlaps `**/auth/*.rs` in general is genuinely hard. The plan punts to a prefix + exact-match approximation. Accept false negatives here; do not let this become a research project. Document the limitation in the README.
4. **SQLite concurrency.** Multiple agent processes writing the same DB file will hit `SQLITE_BUSY` without WAL mode and a busy timeout. This is called out in Phase 1 step 2 — if it gets skipped, the failure shows up only under real parallel load, which is exactly the scenario the tool exists for.
5. **tree-sitter grammar build friction.** The grammar crates compile C at build time; `tree-sitter-dart` in particular is community-maintained and version-mismatches against the `tree-sitter` core crate are common (ABI version errors). Mitigation: add grammars one at a time, verify each compiles before adding the next, and drop any grammar that fights for more than ~20 minutes — path-level claims still work without it.
6. **LLM intent check must be optional and non-blocking.** An LLM call in the hot path of a pre-commit hook or a `PreToolUse` hook will make the tool feel broken. Hard timeout, hard cap on comparison count, off by default.
7. **The real risk is adoption, not code.** This ships correct and then goes unused because the user forgets to claim. Phase 5's hooks are the mitigation and should not be treated as optional polish — if sessions 1–4 run long, cut Phase 4 (symbols/LLM) before cutting Phase 5. A path-level-only Foremerge that runs automatically beats a semantically brilliant one nobody invokes.
