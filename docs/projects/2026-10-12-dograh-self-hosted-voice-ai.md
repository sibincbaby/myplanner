# Dograh — Self-Hosted Open-Source Voice AI Platform

**Source:** GitHub — https://github.com/dograh-hq/dograh  
**Tagline:** "Open-source self-hosted alternative to Vapi and Retell with MCP-native voice agents"  
**Discovered:** 2026-10-12

---

## Why it fits

Voice AI tooling is dominated by closed SaaS (Vapi, Retell, ElevenLabs Conversational). Dograh is the only actively maintained FOSS alternative: BSD-2-Clause, fully self-hosted via Docker Compose, and — as of its July 2026 v1.42.0 release — ships a first-class MCP server. That MCP server means Claude Code, Cursor, or any agent runtime can create, edit, and deploy full voice agents programmatically. The practical win: build a personal voice assistant that listens on a phone number, answers questions about your calendar, and escalates to a human — all running on your own infrastructure with BYOK across STT, TTS, and LLM providers.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Docker Compose startup with a single script; cloud provider accounts optional |
| fills_gap | 1 | No self-hosted voice AI with MCP exists in the toolkit |
| novel | 1 | FOSS + BSD-2-Clause + MCP-native is a unique combination; Vapi/Retell have no FOSS equivalents |
| daily_utility | 0 | More infrastructure than daily personal tool; benefit accrues over months, not immediately |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **Dograh open-source stack** — Docker Compose, self-hosted; fork `dograh-hq/dograh`
- **Twilio** (telephony) — cheapest real phone number for testing
- **Whisper / Deepgram** (STT) — bring your own key; Dograh ships both connectors
- **Claude API (Haiku 5.5)** — low-latency LLM for voice response generation
- **ElevenLabs or Cartesia** (TTS) — BYOK via Dograh's TTS connector layer
- **Dograh MCP server** — wire into Claude Code for agent-driven voice agent deployment

## MVP Scope

Spin up Dograh locally, create one voice agent that answers three questions about the weather or a static FAQ, and place a test call via Twilio. The agent config is defined in YAML and deployed via the MCP server from within Claude Code.

Not in MVP: multi-agent handoff, production domain, calendar/contact integrations.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Clone repo; run `curl https://dograh.com/install.sh \| bash`; verify docker-compose stack is healthy | 1 h |
| 2 | Configure BYOK: add Claude Haiku API key, Whisper or Deepgram key, ElevenLabs key to `.env` | 30 min |
| 3 | Create first voice agent via web dashboard: define greeting, FAQ tools, and termination conditions | 2 h |
| 4 | Wire Twilio: buy a phone number, add Dograh webhook URL, place a live test call | 1 h |
| 5 | Use Dograh MCP server from Claude Code to redeploy agent with updated FAQ — validate MCP round-trip | 1 h |

**Total estimate:** ~5.5 h (1 Claude session)

## Blockers

- Docker required; 4+ GB RAM recommended for full stack
- API keys needed for at least one STT and one TTS provider; all have free tiers
- Twilio account required for real phone calls; test calls can be done via the dashboard without telephony
- v1.42.0 is latest stable (July 2026); check GitHub for newer releases before starting
- Self-hosting means you own the ops — no SLAs, no managed scaling

## References

- GitHub: https://github.com/dograh-hq/dograh
- Company site: https://www.dograh.com
- July 2026 newsletter (v1.42.0 release notes): https://dograh.com/newsletters/july-2026
- Open-source alternative listing: https://openalternative.co/dograh
