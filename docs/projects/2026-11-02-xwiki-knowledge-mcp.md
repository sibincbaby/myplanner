# Local Knowledge MCP — give Claude real-time read access to your private docs and notes

**Source:** [MCP Server by XWiki](https://www.producthunt.com/products/xwiki) (175 votes, Nov 1, 2026; XWiki MCP server concept)
**Score:** 3/4 (WB 1 · FG 1 · N 0 · DU 1)
**Shape:** build-first. The XWiki MCP is specific to XWiki users; this plan generalizes the concept to your own local knowledge base (Obsidian vault, local markdown files, a Notion export).

## Why this one

The XWiki MCP server lets Claude query a self-hosted XWiki instance for documentation, meeting notes, and internal knowledge — during a coding session, without copy-pasting. The general pattern is: private knowledge base → MCP server → Claude Code has live access.

The user doesn't run XWiki, but the same pattern applies to any local document store: an Obsidian vault, a `~/notes/` directory of markdown files, or a local SQLite knowledge base.

**Why FG=1:** During Claude Code sessions, referring to personal notes, project docs, or a local knowledge base requires breaking the session to copy-paste content. An MCP tool that reads your local notes on demand makes those sessions materially smarter.

**Why N=0:** MCP servers for wikis and knowledge bases are an established pattern. The XWiki server itself is new, but the concept isn't.

**Why WB=1:** A simple MCP server that reads a directory of markdown files and exposes `search_notes(query)` and `read_note(path)` tools is a 2–3 hour build.

**Why DU=1:** Every Claude Code session benefits from on-demand access to project docs, decision logs, and personal notes.

## Stack recommendation

- **MCP SDK:** `@anthropic-ai/claude-code-sdk` (TypeScript) or `mcp` Python package
- **Note storage:** Local markdown files in `~/notes/` or an Obsidian vault
- **Search:** `fuse.js` (fuzzy search, no server needed) or `minisearch` for keyword search; optionally add sqlite-vec for semantic search
- **Expose:** `search_notes(query: str) -> [{path, title, snippet}]`, `read_note(path: str) -> str`
- **Auth:** none needed for local files; MCP runs over stdio, not HTTP

## MVP scope

1. MCP server with two tools: `search_notes` (fuzzy search over filenames + first 200 chars) and `read_note` (full content by path)
2. Reads `~/notes/**/*.md` recursively
3. Added to Claude Code's MCP config, accessible in sessions
4. Test: ask Claude "what did I write about MCP server design?" and verify it finds the relevant note

Out of scope (MVP): semantic/vector search, write operations, web interface, sync.

## Phases

1. **File indexer (1h).** Write a Node.js or Python script that walks `~/notes/` and builds an in-memory index: `{path, title (first H1 or filename), content, tags}`. Test the index.
2. **MCP server (1 session).** Implement the MCP server using the standard SDK. Expose `search_notes` (returns top 5 matches with snippets) and `read_note` (full content). Test locally with the MCP inspector.
3. **Claude Code integration (30 min).** Add the server to `.claude/settings.json` under `mcpServers`. Test in a live Claude Code session: ask a question that requires consulting a note.
4. **Search quality improvement (optional, 1 session).** Replace fuzzy filename search with full-text content search using `minisearch`. Add tag-based filtering if notes have YAML frontmatter.
5. **Semantic search (optional, 1 session).** Add sqlite-vec + a local embedding model (Nomic Embed via Ollama) for semantic retrieval. Useful for notes where the question vocabulary doesn't match the notes' vocabulary.

## Effort

MVP (search + read): 1 session. With better search: 2 sessions. With semantic search: 3rd session.

## Blockers / risks

- **Note vault size:** Large vaults (10,000+ files) will be slow to index on every server start. Add a file-watcher and incremental index updates if the vault is large.
- **MCP stdio transport:** Claude Code's MCP integration uses stdio, which means the server process is restarted per session. The in-memory index rebuilds each time. For large vaults, persist the index to a SQLite file.
- **Content privacy:** This MCP server reads your private notes and sends relevant content to Claude's context. If notes contain sensitive personal information, be deliberate about which directories are indexed.
- **Search recall:** Simple fuzzy search will miss semantic matches ("capital allocation" won't find a note titled "where to put money"). The semantic search phase (phase 5) is the fix, but adds complexity.
