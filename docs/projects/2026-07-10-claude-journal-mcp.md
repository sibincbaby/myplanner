# claude-journal-mcp — A Work Journal That Writes Itself

**Source:** <https://github.com/chrismbryant/claude-journal-mcp>
**Discovered:** 2026-07-10
**Viability:** 3/4

> Claude/LLM tooling + dev productivity (diary/logging) — a lightweight journal plugin for Claude Code with *zero ML dependencies*. Slash commands to write/search entries, proactive skills, and auto-capture hooks that log what you worked on as you go. Plain-text storage, tag/date/keyword search.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

weekend_buildable: No ML, no vector DB — entries are markdown files, search is grep-plus-metadata. A plugin of slash commands + a `Stop` hook that appends a session summary is squarely a single-session build. Score 1.

fills_gap: The toolkit's memory tools (afair, crystalline, agentmemory, claude-code-live-memory) all serve the *agent's* recall. None is a *human-facing* daily work journal — a searchable log of what you did, for you to read. That's a distinct, missing tool. Score 1.

novel: Journal/memory plugins for Claude Code are a crowded lane (Recall, agentmemory, live-memory). The zero-ML, hook-driven auto-capture angle is a nice simplification but not a new category. Score 0.

daily_utility: A journal is inherently daily, and auto-capture hooks make it accrue passively — plus a `/journal search` to answer "what did I do last Tuesday?" at standup. Opens or fills every working day. Score 1.

---

## Overview

claude-journal-mcp turns your coding sessions into a searchable personal log without you having to remember to write it. It's deliberately dumb — no embeddings, no model calls for storage — just markdown entries with structured frontmatter and fast filtered search.

**Three surfaces:**
- **Slash commands** — `/journal add`, `/journal search`, `/journal stats` for manual entries and retrieval (tags, exact phrases, date ranges, keywords, ID lookup).
- **Proactive skill** — Claude offers to journal notable moments (a fix shipped, a decision made) mid-session.
- **Auto-capture hooks** — a session-stop hook writes a short "what happened" entry automatically, so the log fills even when you forget.

## Stack Recommendation

For a personal build:

- **Packaging:** a Claude Code plugin — `.claude/` with `skills/`, `commands/`, and `hooks/`. No server needed unless you want cross-client access, in which case wrap the same store in a tiny MCP.
- **Storage:** one markdown file per entry (or per day) under `~/journal/`, YAML frontmatter (`date`, `tags`, `project`, `id`). Human-readable, git-friendly, greppable.
- **Search:** ripgrep + frontmatter filtering in a small script — no index to maintain.
- **Auto-capture:** a `Stop` hook that asks the model for a 2–3 line session summary and appends it.

## MVP Scope

**In scope:**
- `/journal add "<text>" --tags a,b` — append an entry with frontmatter + generated ID.
- `/journal search <query> [--tag t] [--from d --to d]` — filtered search over entries.
- `/journal stats` — entry counts by project/date range.
- Auto-capture `Stop` hook: summarize the session, append as an entry tagged with the project.

**Out of scope for MVP:** semantic/vector search, cross-device sync, a web UI, editing past entries through the plugin (edit the markdown directly).

## Implementation Phases

### Phase 1: Storage + manual commands
**Goal:** `/journal add` writes a file; `/journal search` finds it.

- Entry format: `~/journal/YYYY-MM-DD-<id>.md` with `date`, `tags`, `project`, `id` frontmatter + body.
- `commands/journal-add`, `commands/journal-search`: thin wrappers over an `add.sh` / `search.sh` using ripgrep + a frontmatter parse.

**Verify:** add three entries with tags, search by tag and by date range, confirm correct hits.

### Phase 2: Auto-capture hook
**Goal:** finishing a session leaves a journal entry with no manual step.

- `hooks/` `Stop` hook: prompt for a concise summary of the session's work; append as an entry, `project` inferred from cwd.
- Debounce: skip trivially short sessions so the log isn't noise.

### Phase 3: Stats + proactive skill + polish
**Goal:** the journal is queryable at standup and offers itself when useful.

- `/journal stats`: entries per project, per week, tag frequency.
- Proactive skill: after a notable event (test green, bug fixed), offer "log this?" — one keystroke to accept.
- Export: `/journal export --from --to` to a single markdown digest for weekly reviews.

## Estimated Effort

**1 Claude Code session.** Phase 1 + 2 is the whole daily-driver; Phase 3 is a short second pass. Zero external dependencies keeps it fast.

## Potential Blockers

- **Auto-capture noise:** a hook that fires on every session produces low-value entries fast. Gate on session length/edit count and keep summaries to 2–3 lines.
- **Hook summary cost/latency:** the `Stop` hook makes a model call on every session end — keep the prompt tiny and make it non-blocking (fire-and-forget) so it never slows quitting.
- **Search scaling:** ripgrep over thousands of files is fine, but frontmatter parsing in shell gets fiddly — if it gets heavy, precompute a small `index.jsonl` on write rather than adding a real DB.
- **Privacy:** the journal captures work context in plaintext under `~`. Keep it out of any synced/committed directory by default and document the location.
