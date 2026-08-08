# domo-calendar — Textable Personal Calendar Agent via Claude

**Source:** [Domo on Product Hunt](https://www.producthunt.com/products/domo-a-claude-agent-for-your-calendar) · Product Hunt Aug 6 2026 (84 votes)  
**Language:** Node.js (inspiration); Plan: Node.js or Python  
**Date discovered:** 2026-08-08

## What it is

Domo is a personal calendar agent with its own phone number. You iMessage or text it natural language ("add dentist Thursday at 3", "what do I have Friday?", "reschedule my 2pm to 4pm") and it reads and writes your real calendar. The original is built on Claude with no per-token bill (uses Claude Max subscription). It also runs a wall dashboard that keeps the family calendar current.

**Why it matters:** Calendar apps require you to open them. A textable agent meets you where you already are — in iMessage or Telegram. The "use your own Claude subscription" angle means zero ongoing cost for the conversational layer. The feature set is narrow and the integrations (one chat platform + one calendar) are both well-documented.

## Why it fits

- Core interest: **Claude/LLM tooling** — Claude as the NL calendar interpreter; own subscription, no API bill
- Core interest: **agent UIs** — the chat thread is the UI; no frontend to maintain
- Core interest: **dev productivity** — calendar and scheduling are daily; text beats app-switching
- `daily_utility = 1`: every day starts and ends with calendar checks and event creation
- `weekend_buildable = 1`: Google Calendar API + Telegram bot + Claude tool-use is a textbook one-session build

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Google Calendar API + Telegram bot + Claude tool-use = canonical 1-session project |
| fills_gap | 1 | No calendar agent in the backlog; calendar is more daily-critical than finance |
| novel | 1 | Building on own Claude subscription (no per-token cost) is the differentiating angle |
| daily_utility | 1 | Calendar is used multiple times every day; text beats opening an app |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Entrypoint:     Telegram Bot (node-telegram-bot-api) — iMessage requires Mac hardware; Telegram works everywhere
Calendar:       Google Calendar API v3 (googleapis Node.js client) — OAuth2, service-account-free
AI:             @anthropic-ai/sdk — Claude tool_use with calendar functions
Runtime:        Node.js 22 on a small VPS (Railway / Fly.io free tier — always-on needed for Telegram webhook)
State:          Single SQLite file (better-sqlite3) — calendar ID cache, timezone pref, recurring patterns
Config:         .env — TELEGRAM_BOT_TOKEN, GOOGLE_CREDENTIALS_JSON, ANTHROPIC_API_KEY (or use Claude Max via claude.ai workaround)
```

**iMessage path (optional):** macOS + BlueBubbles server + Telegram bridge gives iMessage-alike; Telegram is simpler for MVP.

## MVP Scope (1 Claude session)

1. Telegram bot receives a message → forward to Claude with a system prompt and a tool list
2. Claude tools: `list_events(date_range)`, `create_event(title, start, end, description)`, `update_event(id, changes)`, `delete_event(id)`, `find_free_slot(duration, on_date)`
3. Each tool maps to Google Calendar API v3 calls
4. Claude responds in natural language; bot sends reply back to the user
5. Natural language date parsing: Claude handles "next Thursday at 3pm" and returns ISO 8601 to the tool

## Phases

### Phase 1: Telegram Bot + Google Calendar Auth (1-2h)
- Create Telegram bot via BotFather, get token
- Google Cloud project → Calendar API enabled → OAuth 2.0 credentials → local auth flow (`google-auth-library`)
- Store `tokens.json` after first auth; refresh automatically
- `bot.on('message')` → `console.log(msg.text)` → reply "received"
- Verify: send "hello" to the bot, confirm it echoes back; confirm Google Calendar API returns today's events

### Phase 2: Claude Tool-Use Integration (2-3h)
- Define 5 tools as Claude `input_schema` JSON objects
- System prompt: "You are a calendar assistant. Use the provided tools to manage the user's Google Calendar. Parse relative dates using the current date and the user's timezone."
- `handleToolCall(name, input)` dispatcher: routes to Google Calendar API functions
- Agentic loop: call Claude → if `stop_reason === 'tool_use'` → execute tool → append result → call Claude again → until `stop_reason === 'end_turn'`
- Verify: send "what do I have tomorrow?", confirm Claude calls `list_events` and replies with real data

### Phase 3: Natural Language CRUD (2h)
- Test and tune 10 representative commands: add, list, reschedule, cancel, find free time, recurring, all-day, multi-attendee, timezone handling
- Edge cases: "move my 2pm to 4pm" (Claude must first call `list_events` to resolve the ambiguous 2pm), "cancel everything Friday"
- Error handling: ambiguous event → Claude asks for clarification; past date → Claude warns; conflict → Claude flags and offers alternatives
- Verify: run all 10 command types against a test calendar, confirm correct API calls each time

### Phase 4: Daily Briefing Push (1h)
- Cron: every morning at 7am (node-cron), fetch today's events, summarise with Claude, send proactively to the Telegram chat
- Config command: `/morning 7:30` — user sets their preferred briefing time
- Weekly summary on Sunday evening
- Verify: set morning time to 1 minute from now, confirm briefing arrives with correct events

### Phase 5: Web Dashboard (2h, optional)
- Single `index.html` served by Express — reads Google Calendar API for the next 7 days
- No auth UI (just a private URL with a UUID token in the path)
- Auto-refreshes every 5 minutes via `setInterval`
- Display: day columns, event blocks, current time indicator
- Verify: open on a phone browser, confirm it looks clean and updates without reload

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Telegram Bot + Calendar Auth | 1-2h |
| Claude Tool-Use Integration | 2-3h |
| Natural Language CRUD | 2h |
| Daily Briefing Push | 1h |
| Web Dashboard (optional) | 2h |
| **Total** | **6-8h (one weekend)** |

Phases 1-3 deliver a fully functional textable calendar agent in **5-7h (one session)**.

## Blockers / Risks

- Google Calendar OAuth requires a redirect URI — use `localhost:3000/callback` for local setup and store the refresh token permanently; production deployment needs a public URL for the callback (Fly.io free instance works)
- Telegram webhook requires HTTPS — use `@fastify/websocket` + `ngrok` in dev, or the Fly.io subdomain in production; long-polling (`getUpdates`) is the no-HTTPS fallback for local testing
- Claude Max users cannot use the API directly with a subscription key — need to either use an API key (pay per token) or scope this to anthropic API key use; note in the README that a $5/month API budget covers heavy daily calendar use (calendar commands are short-context)
- "Move my 2pm" requires Claude to first fetch today's events to resolve the ambiguity — the agentic loop handles this naturally but adds one extra API round-trip; test that latency is acceptable on Telegram (< 3s total)
- Recurring event editing (change "all future", "just this one") uses the Google Calendar `recurringEventId` and `eventId` pattern — scope the MVP to single-event edits only, add recurring support in Phase 3
