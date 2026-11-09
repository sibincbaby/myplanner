# lorekit agent memory — Portable Agent Memory MCP Server

**Source:** [lorekit.io/blog/open-agent-memory-format](https://lorekit.io/blog/open-agent-memory-format) (blog post proposing a standard, Nov 8–9 2026)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** implement-the-spec. The Lorekit blog post proposes a portable `.agmem` format for agent memory. The standard is early-stage and has no reference implementation yet. Build the MCP server that makes the spec real.

## Why this one

Agent memory is fragmented: claude-mem (115k★) stores memory for Claude sessions, mem0 (another layer) has its own API, and each tool uses an incompatible format. If you switch agents or tools, your accumulated context is lost. The Lorekit proposal addresses this by defining a simple portable JSON format that any agent can read and write.

The opportunity is to build the reference MCP server: an `agmem` server that exposes `remember`, `recall`, and `list_memories` tools to any MCP-compatible agent. Because it stores memories as plain `.agmem` files, another agent (or a future tool) can pick up exactly where this one left off.

**Why FG=1:** Agent memory is broken today. claude-mem is Claude-specific. mem0 requires an API key and an account. LEANN is a full RAG system. There's no simple, portable, file-based memory layer that works across Claude Code, Codex, and Gemini CLI. This fills that gap.

**Why N=1:** No existing MCP memory server uses a portable, file-first format. claude-mem stores memory in an opaque database; mem0 stores it on their servers. A file-based format that you can version-control, diff, and hand to any agent is a genuinely new approach.

**Why WB=1:** A minimal MCP server with three tools and a JSON file per topic is a focused afternoon build. The MCP server framework in TypeScript has good tooling; `@modelcontextprotocol/sdk` handles the protocol.

**Why DU=1:** Every Claude Code session that benefits from remembering project conventions, personal preferences, or cross-session decisions benefits from this. Once installed it runs transparently; memory accumulates over days.

## Stack recommendation

- **TypeScript + Node.js** — `@modelcontextprotocol/sdk` handles the MCP protocol
- **`.agmem` files** — one JSON file per memory namespace (e.g., `project-myplanner.agmem`, `personal-prefs.agmem`)
- **`fuse.js`** — fuzzy search across memory entries for the `recall` tool
- **`chokidar`** — watch `.agmem` files for changes (useful if another agent writes to them)
- **Zod** — schema validation for the `.agmem` format

## MVP scope

An MCP server (`agmem-server`) with four tools:

1. **`remember(topic, content, tags[])`** — append an entry to `~/.agmem/<topic>.agmem`
2. **`recall(query, topic?)`** — fuzzy-search entries, return top 5 by relevance
3. **`list_memories(topic?)`** — list all topics or all entries in a topic
4. **`forget(topic, entry_id)`** — delete a specific entry by ID

The `.agmem` format: a JSON file with a `version` field and an `entries` array. Each entry has `id` (uuid), `content` (string), `tags` (string[]), `created_at` (ISO date), and `source` (agent name, e.g. "claude-code").

Configure Claude Code to use the server via `~/.claude/settings.json` mcpServers block.

Out of scope (MVP): semantic vector search, cross-device sync, memory expiry, encryption.

## Phases

1. **MCP server scaffold (1 session).** Set up the TypeScript MCP server with `@modelcontextprotocol/sdk`. Implement `remember` and `list_memories`. Write the first `.agmem` file. Configure Claude Code to connect. Verify that "remember that I prefer tabs over spaces" writes to `personal-prefs.agmem`.
2. **Recall tool (1 session).** Add `recall` with fuzzy search via fuse.js. Test on a 50-entry `.agmem` file. Tune the relevance threshold so irrelevant entries don't surface.
3. **Multi-agent portability (30 min).** Test reading the same `.agmem` file from Gemini CLI or Codex via the same MCP server. The format is portable because it's plain JSON.
4. **Auto-inject (1 session, optional).** Add a session-start hook that reads the top 3 most-recently-accessed entries and injects them as a system message. This makes memory proactive rather than query-driven.
5. **Version control integration (30 min, optional).** Add a `git add ~/.agmem/*.agmem && git commit -m "agmem: checkpoint"` command that snapshots memory on demand. Now memory is durable, diffable, and reversible.

## Effort

Phases 1–2: 1 session. Phase 3: 30 minutes. Phases 4–5: 1 more session total.

## Blockers / risks

- **Lorekit spec maturity:** the blog post proposes a format but it may not be finalized. This is a feature, not a risk: building the reference implementation shapes the spec.
- **Fuzzy search quality:** fuse.js is fast but limited for semantic similarity. For recall to be genuinely useful, queries like "what did I decide about the database schema?" need to match entries that say "chose PostgreSQL over SQLite for the production backend." Test with 20 real queries; if fuse.js misses too many, add a lightweight embedding step with a local model.
- **File contention:** if two agents write to the same `.agmem` file simultaneously, the last write wins. For MVP (single-agent use), this is not an issue. For multi-agent use, add append-only writes with a file lock.
- **Privacy:** `.agmem` files contain personal preferences and project context in plaintext. Don't commit them to public repos; add `*.agmem` to `.gitignore` by default.
