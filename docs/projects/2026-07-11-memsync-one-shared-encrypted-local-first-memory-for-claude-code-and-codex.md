# memsync — One Shared, Encrypted, Local-First Memory for Claude Code and Codex

**Source:** <https://github.com/gregtuc/memsync>
**Discovered:** 2026-07-11
**Viability:** 3/4

> Claude/LLM tooling + dev-productivity — cross-agent persistent memory, a recurring theme in the user's interests (diary/logging, agent memory). Simple static-binary reference Claude can build on.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

The user lives in Claude Code / Codex tooling (claude, claudecodeui, csess, dev-diary, assistant) yet has no purpose-built cross-session memory tool — only ad-hoc CLAUDE.md/MEMORY.md files — so a searchable memory_search/memory_get layer fills a genuine gap they'd hit every single session (daily_utility=1, fills_gap=1). A weekend MVP is realistic: post-session capture hook, a local git-backed store, and two retrieval commands are a focused sprint Claude can execute, especially reimplemented in Python/Node rather than Go (weekend_buildable=1). Novelty is the weak point — this space is crowded with mature, popular alternatives (mem0, Claude's own native memory/CLAUDE.md, MCP memory servers, letta), so the concept is not meaningfully distinct (novel=0), but the total of 3 clears the viability bar.

---

## Implementation Plan

Now I have enough grounding on the actual design. Writing the plan.

## Overview

memsync is a local-first, cross-agent memory layer: after a Claude Code or Codex session ends, useful coding context is captured into an encrypted, git-backed store; at the start of a new session (in *either* agent) that context is surfaced via two MCP tools, `memory_search` and `memory_get`. The upstream project is Go compiled to a static binary. For a weekend Claude-buildable MVP we reimplement it in **Node.js/TypeScript**, which is the natural fit because (a) the MCP TypeScript SDK is first-class, (b) Claude Code exposes native session lifecycle **hooks** (`SessionStart`, `Stop`/`SessionEnd`) that we can wire directly to a Node CLI, and (c) the user already lives in Node tooling.

The MVP delivers the full loop on a single machine: a `Stop` hook captures the just-finished session into a local store, an MCP server exposes `memory_search`/`memory_get` to both agents, and a git-backed encrypted vault makes the store portable. Cross-machine sync is a thin layer on top of an ordinary private git repo, so it needs no server, account, or network beyond `git push`/`pull`.

The differentiator vs. ad-hoc `CLAUDE.md`/`MEMORY.md` files (which the user maintains today) is that memory becomes *searchable*, *shared across Claude Code and Codex*, and *captured automatically* rather than hand-edited.

## Stack Recommendation

- **Language/runtime:** Node.js 20+ with TypeScript. Single-package CLI + MCP server.
- **CLI framework:** `commander` for subcommands (`init`, `capture`, `sync`, `join`, `doctor`, `serve`).
- **MCP:** `@modelcontextprotocol/sdk` (stdio transport) exposing `memory_search` and `memory_get`.
- **Storage:** newline-delimited JSON records under a git repo, one JSON file per memory entry (`memories/<ulid>.json`) so git diffs stay clean and merges rarely conflict. `ulid` package for sortable IDs.
- **Search (MVP):** local BM25-style ranking with `minisearch` (pure JS, zero native deps, builds an in-memory index over entries at query time). Avoids embeddings/API keys for the weekend build.
- **Encryption:** Node built-in `crypto` — AES-256-GCM with a key derived via `scrypt` from a passphrase; key stored at `~/.memsync/key` (chmod 600), never committed. Encrypt entry payloads at rest so the git remote only holds ciphertext.
- **Git:** shell out to the system `git` binary via `execFileSync` (simplest, matches upstream's shell components) rather than a JS git library.
- **Session transcript source:** Claude Code writes JSONL transcripts under `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`; the `Stop` hook receives the transcript path on stdin, so capture reads that. (The `csess` skill/CLI available here can be used to locate transcripts during development/testing.)
- **Packaging:** `npm link` for local install; `bin` entry `memsync`. Optionally `pkg`/`bun build --compile` later for a static binary to match upstream — out of MVP scope.

## MVP Scope

In scope:
1. `memsync init` — create the local vault (git repo + config + encryption key).
2. Automatic capture on session end via a Claude Code `Stop` hook that calls `memsync capture`, summarizing the session into 1–N memory entries.
3. MCP server (`memsync serve`) exposing `memory_search(query, limit)` and `memory_get(id)`, registered with both Claude Code and Codex.
4. Encrypted-at-rest storage in a git repo; `memsync sync` (commit + push/pull) for cross-machine sharing; `memsync join <remote>` to pair a second machine.
5. `memsync doctor` health check.

Out of scope for MVP: real-time device pairing handshake, embedding/vector search, conflict-resolution UI, Windows support, the Codex-side automatic capture hook (Codex capture is manual/`memory_get`-driven at first; Codex still *reads* via MCP).

## Implementation Phases

### Phase 1: Vault, config, and encrypted store
**Goal:** `memsync init` produces a working local encrypted git-backed store, and low-level add/read/list of memory entries works from the CLI.
**Files to create/modify:**
- `package.json` — deps: `commander`, `@modelcontextprotocol/sdk`, `minisearch`, `ulid`; `bin.memsync` → `dist/cli.js`; `type: module`.
- `tsconfig.json` — NodeNext module resolution, `outDir: dist`.
- `src/config.ts` — resolve `~/.memsync/` root, load/write `config.json` (vault path, remote, device name).
- `src/crypto.ts` — `deriveKey(passphrase)` via `scrypt`; `encrypt(obj)`/`decrypt(buf)` with AES-256-GCM (random 12-byte IV prepended, GCM tag appended).
- `src/store.ts` — `addMemory(entry)`, `getMemory(id)`, `listMemories()`. Writes `vault/memories/<ulid>.json` containing `{ iv, tag, ciphertext }` (base64); metadata index kept plaintext-minimal.
- `src/cli.ts` — commander wiring for `init`, plus hidden `add`/`get`/`list` for testing.
**Key steps:**
1. Implement `crypto.ts` with a round-trip: `decrypt(encrypt(x)) === x`; key file at `~/.memsync/key` written with mode `0600`.
2. `memsync init`: create `~/.memsync/vault/`, run `git init`, write `.gitignore` (exclude nothing sensitive — key lives outside vault), create `memories/` dir and a `manifest.json`, generate the encryption key from a prompted or `--passphrase` arg, `git commit` the empty scaffold.
3. Define the memory entry schema in `src/types.ts`: `{ id, createdAt, agent: "claude"|"codex", project, cwd, title, summary, tags[], body }`. Only `id`/`createdAt` live in the filename/plaintext; the rest is inside the encrypted blob.
4. `store.addMemory` serializes the entry, encrypts, writes `<ulid>.json`; `getMemory`/`listMemories` decrypt on read.
**Verify:** `memsync init --passphrase test` then `memsync add --title t --body hello` then `memsync get <id>` prints the decrypted entry, and `cat ~/.memsync/vault/memories/*.json` shows only base64 ciphertext (no plaintext "hello").

### Phase 2: MCP server with memory_search / memory_get
**Goal:** Running `memsync serve` exposes `memory_search` and `memory_get` over stdio MCP, and Claude Code can call them in a live session.
**Files to create/modify:**
- `src/search.ts` — build a `minisearch` index over decrypted entries (fields `title`, `summary`, `body`, `tags`); `search(query, limit)` returns ranked `{id, title, summary, score}`.
- `src/mcp.ts` — MCP `Server` with two tools: `memory_search({query, limit=5})` → ranked hits (summaries only, to keep context small); `memory_get({id})` → full decrypted body.
- `src/cli.ts` — add `serve` subcommand launching the stdio MCP server.
- `claude-mcp-register.md` — doc snippet with the exact `claude mcp add` command.
**Key steps:**
1. Implement `search.ts`: on each `memory_search`, load+decrypt all entries (fine for MVP volumes), index, query, return top-N. Cache the index in-process keyed by store mtime to avoid re-decrypting every call.
2. Implement `mcp.ts` using `@modelcontextprotocol/sdk` `Server` + `StdioServerTransport`; register the two tools with JSON-schema input validation; return `memory_get` errors as MCP tool errors, not crashes.
3. Register with Claude Code: `claude mcp add memsync -- node <abs>/dist/cli.js serve`. Register with Codex by adding the same stdio command to Codex's MCP config.
4. Keep tool output compact: `memory_search` returns at most `limit` results with truncated summaries; the agent calls `memory_get` for full text.
**Verify:** After registering, start `claude`, and in-session ask it to run `memory_search` for a term present in a seeded entry — it returns the hit; `memory_get` on that id returns the full body. Also verify standalone via the MCP inspector or `echo`-piped JSON-RPC to `memsync serve`.

### Phase 3: Automatic post-session capture (Claude Code hook)
**Goal:** Finishing a Claude Code session automatically writes a useful memory entry into the vault with no manual step.
**Files to create/modify:**
- `src/capture.ts` — read a transcript JSONL, extract a capture-worthy summary, produce one memory entry via `store.addMemory`.
- `src/cli.ts` — add `capture` subcommand reading hook JSON from stdin (`{ transcript_path, cwd, session_id }`).
- `hooks/install.ts` (or `memsync install-hooks` subcommand) — merge a `Stop` hook into the user's `~/.claude/settings.json`.
- `hooks/README.md` — manual hook config example.
**Key steps:**
1. Implement `capture.ts`: parse the last N turns of the transcript JSONL; derive `title`/`summary`/`tags` from the session. MVP heuristic first (files touched, first user message, last assistant summary); optionally upgrade to an LLM summarization call later (would introduce an API-key blocker — see Blockers).
2. Add `memsync capture` that reads the Claude Code hook stdin payload, resolves `transcript_path`, dedupes against an already-captured `session_id` (store a `captured/<session_id>` marker to avoid double-writes on repeated `Stop` events).
3. `memsync install-hooks`: register a `Stop` hook in `~/.claude/settings.json` of the form `{ "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "node <abs>/dist/cli.js capture" }] }] } }`, merging rather than overwriting existing hooks.
4. Tag entries with `agent: "claude"`, `project`, and `cwd` so cross-agent search can attribute origin.
**Verify:** Register the hook, run a short `claude` session in a test dir, exit; confirm a new `memories/<ulid>.json` appears and `memory_search` finds content from that session. Re-triggering `Stop` for the same `session_id` does not create a duplicate.

### Phase 4: Git sync and cross-machine join
**Goal:** `memsync sync` pushes/pulls encrypted memories to a private git remote, and a second machine can `join` and immediately search shared memory.
**Files to create/modify:**
- `src/git.ts` — `commitAll(msg)`, `push()`, `pull()` via `execFileSync("git", ...)` scoped to the vault dir.
- `src/cli.ts` — add `sync`, `join <remote-url>`, `doctor`.
- `src/sync.ts` — orchestrate: `git pull --rebase`, resolve trivial conflicts (per-file entries rarely collide), commit new/local entries, `git push`.
**Key steps:**
1. Implement `sync`: stage `memories/`, commit with a machine+timestamp message, `pull --rebase` then `push`. Because each entry is its own file, concurrent captures on two machines produce add/add-different-file, not conflicts.
2. Implement `join <remote>`: `git clone` (or add remote + fetch) into the vault path, then prompt for the shared passphrase to write the local key file (the passphrase — not the key — is the shared secret; key is derived identically on both machines so ciphertext decrypts everywhere).
3. Implement `doctor`: check key file perms/existence, git remote reachability, that all `memories/*.json` decrypt cleanly, and that Claude/Codex MCP registration is present.
4. Add a lightweight `Stop`-hook post-capture `sync` (opt-in flag) or leave sync manual for MVP to avoid slowing session exit.
**Verify:** Clone the vault into a second directory simulating machine B (`memsync join <path>` with the same passphrase), run `memory_search` there, and confirm entries captured on "machine A" are found and decrypt. Corrupt the passphrase and confirm `doctor` reports decryption failure rather than returning garbage.

## Estimated Effort

**3 Claude Code sessions (~8–10 hours total).**
- **Session 1 — Phases 1 & 2:** project scaffold, crypto round-trip, encrypted store, and the MCP server with `memory_search`/`memory_get` registered and callable from Claude Code. This is the highest-value slice (retrieval works end-to-end on seeded data).
- **Session 2 — Phase 3:** transcript parsing, the `capture` command, and the `Stop` hook installer, so memory populates automatically. Includes dedup and hook-merge edge cases.
- **Session 3 — Phase 4 + hardening:** git sync, `join`, `doctor`, Codex-side MCP registration, and a README. Buffer for the transcript-format and hook-payload surprises that usually surface only against real sessions.

## Potential Blockers

- **Claude Code hook contract drift:** the exact `Stop`/`SessionEnd` hook name, the stdin JSON shape, and the settings.json schema can change between Claude Code versions. Verify the current contract against `~/.claude/settings.json` and a live hook fire before building on assumptions; the `csess` skill here can dump a real transcript to confirm its JSONL structure.
- **Codex integration asymmetry:** Codex's MCP config location/format and whether it exposes a post-session hook are less documented than Claude Code's. MVP guarantees Codex can *read* via MCP; automatic Codex *capture* may slip to a follow-up. Confirm Codex's MCP config path early.
- **Capture quality vs. API keys:** a heuristic summary is weak; a good summary wants an LLM call, which reintroduces the exact "no account/network required" property the project sells against. Keep MVP heuristic-only, or route optional summarization through the local `devgate`/`gateway-endpoint` skill so no real key is committed.
- **Encryption key management footgun:** if the passphrase is lost, all memories are unrecoverable, and if the key file is ever committed the encryption is moot. Enforce key-outside-vault, `0600` perms, and a `doctor` check; do not auto-commit anything under `~/.memsync/key`.
- **Search cost at scale:** decrypt-all-then-index on every `memory_search` is fine for hundreds of entries but degrades later; the mtime-keyed in-process cache mitigates it for MVP, and an encrypted-plaintext index or embeddings is the documented upgrade path, not a launch requirement.
- **Static-binary parity:** upstream ships a single Go binary; the Node reimplementation needs Node present. If a true portable binary is required, add a `bun build --compile` step — extra work, flagged but out of MVP.

Relevant upstream reference: https://github.com/gregtuc/memsync
