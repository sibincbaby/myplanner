# VaultChron

> A self-hosted Telegram bot that turns your daily voice notes, photos, and text into a layered memory system — daily logs roll up into weekly digests, weekly into monthly, monthly into yearly — all stored in a local SQLite vault and exported as Obsidian-compatible markdown

**Inspired by:** [smixs/iva](https://github.com/smixs/iva) (GitHub trending July 28 2026)  
**Date discovered:** 2026-07-28

---

## What gap it fills

Every journal/diary project planned so far targets a different interface (Claude Journal MCP, VoxDiary Flutter, Memex, Moodiary). VaultChron is distinct in two ways: **the capture channel is Telegram** (always-on, on any device, no new app to open) and **memory is layered** — you never lose context as time passes because daily logs summarise into weekly, weekly into monthly. The resulting vault is Obsidian-compatible, so your whole life history is searchable prose, not app-locked rows.

Concrete daily loop: forward a voice note from a meeting → bot transcribes and logs it. Photo of a receipt → logged with date. End of day the bot auto-composes a day summary. End of week, it synthesises the week. You query with `/search` or `/this week`. After a month your context window is a month-summary, not 30 individual logs.

This fills a gap the other diary projects miss: **cross-device frictionless capture** + **auto-summarisation that keeps the vault compact**.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Bot framework | `node-telegram-bot-api` or `grammy` | Lightweight, modern TypeScript, webhook or polling |
| Runtime | Node.js 24 (LTS) | Built-in SQLite (`node:sqlite`), no extra DB dependencies |
| Voice transcription | OpenAI Whisper API or Groq (free tier) | Fast, cheap, handles all accents |
| Image understanding | Claude `vision` via Anthropic SDK | Describe photos, receipts, screenshots |
| Summarisation | Claude (Haiku for speed, Sonnet for quality) | Daily/weekly/monthly rollups |
| Vault export | Markdown files | Obsidian-compatible; one file per day in `YYYY/MM/DD.md` |
| Hosting | Single VPS (Ubuntu, ~$4/mo on Hetzner) | Self-hosted, data stays on your machine |

## MVP scope (1–2 Claude sessions)

A Telegram bot that:

1. Accepts text, voice, photo, and forwarded messages
2. Persists each message with timestamp in SQLite (`messages` table)
3. Transcribes voice via Whisper, describes photos via Claude vision
4. On `/summary` (or cron at midnight): generates a daily summary via Claude, stores in `summaries` table
5. Weekly cron: generates a 7-day rollup from daily summaries
6. `/search <query>` full-text search across raw logs and summaries
7. `/export` outputs today's vault entries as Obsidian markdown to a configured directory

Out of scope for MVP: monthly/yearly rollups, MCP server, personal CRM, Google Workspace integration.

## Phases

### Phase 1 — Bot scaffold + message ingestion (1.5 h)
- `grammy` bot with webhook (or long-polling for local dev)
- SQLite schema: `messages(id, ts, type, raw_text, transcription, summary, source)` + `summaries(id, period, start_ts, end_ts, content)`
- Handler for text → insert row; for voice → download → Whisper → insert transcription
- Handler for photo → download → Claude vision describe → insert description
- Handler for forwarded messages → strip and log like text
- `.env` for `TELEGRAM_TOKEN`, `ANTHROPIC_KEY`, `OPENAI_KEY` (for Whisper)

### Phase 2 — Daily summary cron (1 h)
- `node-cron` at 23:55 local time: pull today's messages, ask Claude Haiku to produce a one-page day summary, store in `summaries`
- `/summary` command forces an on-demand summary of the current day
- Reply with the summary in the chat as a nicely formatted message

### Phase 3 — Weekly rollup (45 min)
- Sunday 23:58 cron: pull 7 daily summaries, ask Claude to produce a week synthesis highlighting key decisions, tasks done, recurring themes
- Store in `summaries` with `period='week'`
- `/week` command returns the latest weekly digest

### Phase 4 — Full-text search (45 min)
- FTS5 virtual table mirroring `messages.transcription` + `summaries.content`
- `/search <query>` → top-5 ranked results with date context
- Results formatted as clickable Telegram message blocks

### Phase 5 — Obsidian vault export (30 min)
- On daily summary generation: write `vault/YYYY/MM/YYYY-MM-DD.md` with front matter `date:`, `tags:`, and body = transcriptions + summary
- `/export` triggers a manual export for the current day
- Mount the `vault/` directory as an Obsidian vault in your Obsidian settings

## Effort estimate

~4.5 hours all phases · 1–2 Claude sessions  
Phases 1–2 alone deliver a working daily logging bot in ~2.5 hours

## Blockers / risks

- **Telegram file size limits:** Voice notes > 20 MB can't be sent via Bot API. Document with workaround (compress audio or use forwarded messages under the limit).
- **Whisper API cost:** ~$0.006/min, so 1 hour of voice = ~$0.36. Fine for personal use; note in README.
- **Timezone handling:** User's tz must be set in `.env`; cron and day boundaries depend on it.
- **Distinct from VoxDiary Flutter (2026-07-21):** VoxDiary was a Flutter mobile app for structured diary prompts. VaultChron is a Telegram bot with layered rollup memory — different capture UX and storage philosophy.
- **Distinct from AgentJournal (2026-07-25):** AgentJournal focused on structured daily prompts and Claude-driven reflection. VaultChron is frictionless raw capture + automatic compression — no structured prompt required.
