# SessionVault

> Self-hosted search and archive for Claude Code, Codex, and Aider sessions: ingest JSONL transcripts, full-text search, keyword alerts

**Inspired by:** [llmh](https://github.com/silascutler/llmh)  
**Date discovered:** 2026-07-22

---

## What gap it fills

After dozens of Claude Code sessions you're sitting on a goldmine of decision context, code snippets, and debugging notes — all locked in per-project JSONL files with no way to search across them. "What did Claude say about the auth bug last week?" requires manual grep through raw JSON. SessionVault ingests those files into SQLite, adds full-text search, and lets you set keyword alerts — all self-hosted, no cloud required.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Server | Python + FastAPI | Simple async API; auto-docs |
| Storage | SQLite + FTS5 | No separate process; excellent full-text search built in |
| Frontend | HTMX + Tailwind via CDN | No build step; fast to iterate |
| Ingestion | File watcher + CLI push | `sessionvault push <file>` or watch `~/.claude/projects/` |
| Alerts | Webhook POST on keyword match | Simple; integrates with Slack, ntfy, or email via curl |

## MVP scope (1 Claude session)

Three core features:
1. `sessionvault push <jsonl_file>` — parses and inserts a session into SQLite with FTS5 indexing
2. `sessionvault search "auth bug"` — returns matching sessions with highlighted context
3. Simple web UI at `localhost:7474` listing sessions, with search bar

Out of scope for MVP: multi-user auth, Redis ingestion, real-time tail, email alerts.

## Phases

### Phase 1 — Schema + ingestion (1.5 h)
- SQLite tables: `sessions(id, source, start_ts, end_ts, model, raw_path)`, `messages(id, session_id, role, content, tool_name, ts)`
- FTS5 virtual table over `messages.content`
- JSONL parser that handles Claude Code, Codex, and Aider formats

### Phase 2 — FastAPI server (1 h)
- `POST /ingest` — receive JSONL content or path
- `GET /search?q=...` — FTS5 query, returns session + snippet list
- `GET /sessions` — paginated session list
- Static HTMX frontend served at root

### Phase 3 — CLI client (0.5 h)
- `sessionvault push <path>` — POST to local server
- `sessionvault search <query>` — print results in terminal
- `sessionvault watch` — inotify/FSEvents watcher on `~/.claude/projects/`

### Phase 4 — Minimal web UI (1 h)
- Session list with source tag (Claude Code / Codex / Aider), date, token count
- Search bar with FTS5 results and highlighted snippets
- Click session → full conversation view

### Phase 5 — Keyword alerts (1 h)
- `~/.sessionvault/alerts.toml`: `[[alert]] keyword = "error" webhook = "https://ntfy.sh/my-topic"`
- Checked on every ingest; fires webhook if keyword found in new messages

## Effort estimate

~5 hours for Phases 1–4 · 1–2 Claude sessions  
~6 hours complete with alerts

## Blockers / risks

- **JSONL format variance**: Claude Code, Codex, and Aider use different schemas. Mitigation: source-specific parsers with a shared canonical schema.
- **FTS5 stemming**: SQLite FTS5 is English-only stemming by default. Mitigation: disable stemming for code; good enough for most use cases.
- **File size**: Long sessions produce large JSONL. Mitigation: chunk into 1000-message batches on ingest; skip already-ingested sessions by path hash.
