# OpenKnowledge — AI-Native Markdown Wiki with MCP

**Inspired by:** [github.com/inkeep/open-knowledge](https://github.com/inkeep/open-knowledge)  
**Source:** Hacker News Show HN (June 28, 2026)  
**Interest score:** 3/4 (Claude tooling + dev productivity + daily writing)

## What It Is

An AI-first, local-file-based markdown editor that wires Claude (and other coding agents) directly into your knowledge base via MCP. Think Obsidian meets VS Code with Claude as a native first-class citizen — your notes become a live context that Claude can read, search, and edit.

## Why Build Your Own

The original is GPL-3.0 and feature-rich (CRDT sync, WYSIWYG + raw markdown duality), but you can get 80% of the value in a single Claude session with a simpler stack. Owning it means you control the MCP schema, the AI prompts, and the data stays fully local.

## Stack Recommendation

- **Electron + React** (or Tauri if you prefer Rust) — local file access
- **Monaco Editor** — VS Code's editor, handles markdown well
- **SQLite** (via better-sqlite3) — note metadata, full-text search index
- **Claude SDK** via MCP server exposed to Claude Code
- **gray-matter** — frontmatter parsing

## MVP Scope

Open a local folder → read/write `.md` files → Monaco editor pane → sidebar chat with Claude that has read/search/write tools over your vault. No CRDT sync, no WYSIWYG toggle, no multi-user.

---

## Implementation Phases

### Phase 1 — Folder Loader + Monaco Editor
**Goal:** Open a folder, see file tree, edit a file.

**Files:**
- `src/main.ts` — Electron main process, IPC handlers for file read/write
- `src/renderer/App.tsx` — root component
- `src/renderer/FileTree.tsx` — recursive folder sidebar
- `src/renderer/Editor.tsx` — Monaco wrapper

**Key steps:**
1. `npx create-electron-app my-wiki --template=webpack-typescript`
2. IPC: `readFile`, `writeFile`, `listDir` handlers in main
3. Render file tree from `listDir` recursive call
4. Mount `@monaco-editor/react` with `language="markdown"`
5. Wire save on `Ctrl+S` via IPC `writeFile`

**Verify:** Open a folder, edit a file, save — confirm changes on disk.

---

### Phase 2 — SQLite Index + Full-Text Search
**Goal:** Index all `.md` files, search by keyword.

**Files:**
- `src/main/db.ts` — SQLite setup, FTS5 virtual table
- `src/main/indexer.ts` — walk folder, parse frontmatter, upsert rows

**Key steps:**
1. `npm install better-sqlite3 gray-matter`
2. Create `notes(path, title, body, tags, mtime)` + `notes_fts` FTS5 table
3. On folder open: walk all `.md` files, index or skip if `mtime` unchanged
4. IPC handler `searchNotes(query)` → SQL `MATCH` query → return top 10
5. Add search bar in FileTree, show results inline

**Verify:** Index a vault of 50 notes, search for a term, see correct results.

---

### Phase 3 — MCP Server Exposing the Vault
**Goal:** Claude Code (and any MCP client) can read, search, and write your notes.

**Files:**
- `src/mcp/server.ts` — MCP server using `@modelcontextprotocol/sdk`
- `src/mcp/tools.ts` — `read_note`, `search_notes`, `write_note`, `list_notes`

**Key steps:**
1. `npm install @modelcontextprotocol/sdk`
2. Implement 4 tools that call the same SQLite + fs logic as the main process
3. Start MCP server on a Unix socket or stdio
4. Add to `~/.claude/settings.json` → `mcpServers` entry pointing at the server
5. Test: ask Claude Code "what does my note on X say?"

**Verify:** Claude Code session can call `search_notes("budget")` and get correct results.

---

### Phase 4 — Chat Sidebar
**Goal:** In-app Claude chat with vault context, without leaving the editor.

**Files:**
- `src/renderer/ChatPanel.tsx` — message list + input
- `src/renderer/useClaudeChat.ts` — hook that calls Claude API with tool use

**Key steps:**
1. `npm install @anthropic-ai/sdk`
2. Send system prompt: "You have access to the user's local markdown vault via tools."
3. Register `search_notes` and `read_note` as Claude tools client-side
4. Stream responses, render markdown in messages
5. Tool calls → IPC → SQLite/fs → result back to Claude

**Verify:** Ask "summarize my last 3 diary entries" — Claude calls `search_notes` and returns a coherent summary.

---

### Phase 5 — Backlinks + Graph View (Optional)
**Goal:** See which notes link to the current note.

**Files:**
- `src/main/linker.ts` — parse `[[wikilinks]]` on index, store edges in `links(src, dst)` table
- `src/renderer/BacklinksPanel.tsx`

**Key steps:**
1. On index, regex `\[\[([^\]]+)\]\]` to extract outgoing links
2. Store in `links` table; query for incoming links on file open
3. Render backlinks list below editor

**Verify:** Create two notes that reference each other; open one and see the other in backlinks.

---

## Estimated Effort

**1–2 Claude sessions.** Phases 1–3 are a solid single session (~3–4 hours). Phase 4 adds another hour. Phase 5 is optional polish.

## Potential Blockers

- **Electron + Monaco packaging** can be finicky — use `webpack` template, not `vite`, to avoid Monaco worker issues
- **MCP stdio transport** requires launching the server as a child process; alternatively use HTTP transport on `localhost:3000`
- **Claude API key in renderer** — keep it in main process only, proxy calls via IPC to avoid exposing key to renderer's devtools
