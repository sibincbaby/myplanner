# ClaudeObsidian

> A self-organizing AI second brain for Obsidian + Claude Code: drop any source (note, PDF, code file, URL) and Claude reads, links, and files it into one connected Markdown knowledge graph you own. 15 skills, local-first, MIT.

**Inspired by:** [AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian)  
**Date discovered:** 2026-07-30

---

## What gap it fills

The user's current toolkit has no personal knowledge management layer that Claude can actively maintain. Every AI note-taking option today requires trusting a cloud platform (Notion AI, Mem.ai) or stays passive (Claude can read notes but can't organize them). Claude-obsidian flips this: Claude becomes the librarian. You drop a source — a URL, PDF, voice transcript, code snippet — and a scheduled Claude Code agent reads it, extracts key ideas, creates or updates a linked Markdown note, and places it in the right vault location using whichever methodology you choose (PARA, LYT, Zettelkasten). Nothing leaves your machine; the vault is plain `.md` files you can open in any editor.

Concrete daily value: morning standup → dictate what you're working on → Claude creates a dated note, links it to your project notes, and surfaces three related past observations. Engineering diary, meeting summaries, and reading notes all in one searchable, Claude-queryable graph.

Viability score: **4/4** (weekend_buildable ✅, fills_gap ✅, novel ✅, daily_utility ✅)

---

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Host | Claude Code | Skills run natively in Claude Code; Obsidian vault is just a local directory |
| Skills | SKILL.md files | Drop 3-5 focused skills into `.claude/skills/` — Claude auto-discovers |
| Search | `ripgrep` + optional `sqlite-vec` | Fast local full-text search; sqlite-vec adds semantic without a server |
| Storage | Plain Markdown + YAML frontmatter | Obsidian-compatible, human-readable, git-friendly |
| Scheduler | Claude Code hooks (PostToolUse/Stop) | Auto-file notes after each session |
| Optional CLI | Python `typer` | `/digest` and `/link` commands for power use |

---

## MVP scope (1-2 Claude sessions)

**Session 1 — Core filing skill:**
- `SKILL.md`: `/file-note` — takes a raw source (text/URL/path), extracts title + summary + 3-5 key ideas, creates a dated Markdown note with YAML frontmatter (tags, links, source, created), places it under `Inbox/`
- `CLAUDE.md` in vault root: declares vault layout, tagging taxonomy, file naming convention
- Manual test: paste 5 different source types, verify notes created correctly

**Session 2 — Linking + search:**
- `/link-graph` skill: scans all notes, suggests backlinks using ripgrep keyword matching, writes `## Related` section
- `/search-vault` skill: semantic or keyword search returning top-5 relevant notes with excerpts
- Hook: after Claude Code session ends, auto-run `/file-note` on anything in `Inbox/`

---

## 3-Phase roadmap

### Phase 1 — Drop + file (Session 1)
Core `/file-note` skill. Any source in, structured note out. YAML frontmatter for tags/dates/source. Works on URLs (fetch + summarize), local files, and pasted text.

### Phase 2 — Link + discover (Session 2)
`/link-graph` skill surfaces related past notes as backlinks. Daily note template auto-generated each morning. `/search-vault` for Claude-native retrieval.

### Phase 3 — Maintenance agents (Session 3)
Scheduled "vault maintenance" agent: merges stub notes, updates stale links, surfaces notes not revisited in 30 days. Optional: GitHub Actions cron on the vault repo for daily upkeep.

---

## Effort estimate

| Phase | Effort | Output |
|-------|--------|--------|
| Phase 1 | 1 Claude session (~90 min) | Working `/file-note` skill + CLAUDE.md |
| Phase 2 | 1 Claude session (~90 min) | Link graph + search skill |
| Phase 3 | 1 Claude session (~60 min) | Maintenance agent + daily note hook |

Total: **3 sessions, ~4 hours elapsed**

---

## Blockers / watch-outs

- **Vault schema drift**: Define the CLAUDE.md taxonomy strictly in Phase 1; late changes require retroactive note migrations
- **URL fetch rate limits**: Wrap web fetches in a simple retry + cache layer to avoid hammering the same domain
- **Graph size**: After ~500 notes the backlink scan slows; add sqlite-vec in Phase 3 before hitting this ceiling
- **Obsidian sync conflict**: If using Obsidian Sync, pause sync during Claude writes to avoid `.conflict` files — or write to `Inbox/` only and let Obsidian Sync move notes after you review

---

## Why now

The claude-obsidian project hit v1.9.2 this week with its thinking framework and compound vault features. The ecosystem is maturing (SKILL.md format, Claude Code hooks) to the point where a 3-session personal vault is genuinely achievable. The source project is MIT-licensed and its skills can be adapted directly — building your own means customizing the taxonomy, adding personal CRM fields, and wiring it to your dev workflow rather than starting from scratch.
