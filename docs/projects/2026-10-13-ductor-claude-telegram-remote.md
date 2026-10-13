# ductor — Run Claude Code from Telegram/Matrix/Slack

**Source:** PyPI / GitHub — https://github.com/PleasePrompto/ductor  
**Tagline:** "Control Claude Code, Codex CLI, and Gemini CLI from your phone via Telegram or Matrix"  
**Discovered:** 2026-10-13

---

## Why it fits

There's a clear gap between "I want Claude Code to work on something overnight" and "I need to be at my desk to start or steer it." ductor bridges that: it runs the CLI as a subprocess, streams output in real time to Telegram, and lets you type commands back from your phone. Sub-agents are completely independent bots — each with its own chat, workspace, and CLI auth — so you can delegate a sub-task to Codex and get the result back into Claude's session. State is stored in plain JSON and Markdown under `~/.ductor/`, no cloud accounts required beyond a Telegram bot token.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | `pipx install ductor` + Telegram bot token + onboarding wizard; first session running in under 1 h |
| fills_gap | 1 | No current tool in the toolkit enables remote control and monitoring of Claude Code sessions from a phone |
| novel | 1 | CLI-subprocess-over-Telegram with multi-agent delegation is not a common pattern (~427 stars, not yet mainstream) |
| daily_utility | 1 | Starting a Claude Code session from a phone on the commute, or monitoring an overnight run, is a daily use case |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **ductor** — `pipx install ductor` or `uv tool install ductor` (Python 3.11+)
- **Telegram Bot API** — free bot token from @BotFather; no server required
- **Claude Code 2.1+** — uses existing subscription, runs as a subprocess
- Optional: **Matrix** or **Slack** instead of Telegram (newer versions support both)
- All state in `~/.ductor/` — JSON + Markdown, no database

## MVP Scope

Install ductor, create one Telegram bot, run the onboarding wizard. Test: start a Claude Code session from Telegram, send a prompt, receive streamed output, close the session. Do this for one real task to confirm the latency and UX are acceptable.

Not in MVP: sub-agent delegation to Codex, Matrix/Slack transport, cron jobs, webhooks.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | `pipx install ductor`; create a Telegram bot via @BotFather; run `ductor init` onboarding wizard | 30 min |
| 2 | Start a Claude Code session from Telegram; issue a real prompt; watch streamed output in chat | 1 h |
| 3 | Test a blocking prompt (e.g., Claude asks a clarifying question) — confirm you can respond from phone | 30 min |
| 4 | Try a sub-agent: Claude delegates a task to a Codex sub-agent, result returned to main session | 1 h |
| 5 | Set up a cron job: trigger a daily lint run at 8 AM; verify Telegram notification on completion | 1 h |

**Total estimate:** ~4 h (1 Claude session)

## Blockers

- Python 3.11+ required; `pipx` or `uv` recommended for clean isolation
- Telegram bot token required (free, 2-minute setup via @BotFather)
- The CLI is executed as a subprocess — ductor depends on the CLI's own auth state (must already be logged in)
- Star count is low (~427); the project may have rough edges or sparse documentation
- Matrix/Slack support appears in newer README text; verify current version actually ships it

## References

- GitHub: https://github.com/PleasePrompto/ductor
- PyPI: https://pypi.org/project/ductor/
- README (CDN): https://cdn.jsdelivr.net/gh/pleaseprompto/ductor@main/README.md
- SourcePulse listing: https://www.sourcepulse.org/projects/27732243
