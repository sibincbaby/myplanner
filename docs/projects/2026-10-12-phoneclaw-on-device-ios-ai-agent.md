# PhoneClaw — On-Device iOS AI Agent Powered by Gemma 4

**Source:** GitHub — https://github.com/kellyvv/PhoneClaw  
**Tagline:** "Open-source iOS app that runs Gemma 4 locally and acts on calendar, contacts, health and camera"  
**Discovered:** 2026-10-12

---

## Why it fits

Every mainstream AI mobile tool phones home: on-device privacy is a product claim, not a technical guarantee. PhoneClaw is the opposite: inference runs on-device via LiteRT-LM (Google's mobile inference format for Gemma), zero network calls for the model itself. The MCP skill system — each capability is a single SKILL.md Markdown file — means extending the agent is weekend-scale work, and Claude Code can write new skills. The Apple ecosystem data access (Calendar, Contacts, Reminders, Health, Clipboard, Camera) makes it genuinely useful rather than a tech demo. For a developer interested in mobile-first AI apps, this is the most interesting reference architecture available.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 0 | Requires Xcode + iOS dev provisioning; TestFlight distribution adds friction |
| fills_gap | 1 | No current on-device iOS AI agent with SKILL.md-style extensibility in the toolkit |
| novel | 1 | LiteRT-LM + MCP skill architecture on-device is genuinely novel; no comparable open-source iOS agent |
| daily_utility | 1 | Daily phone use; calendar/reminders/health access makes it an always-on assistant |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **Swift + SwiftUI** — native iOS, required; no Flutter equivalent exists for this use case
- **LiteRT-LM** (Google) — on-device inference runtime for Gemma 4
- **Gemma 4 (2B or 4B)** — open weights, MIT-licensed; 2B fits comfortably on iPhone 15+
- **SKILL.md format** — Markdown capability definitions loaded by the agent at runtime
- **Ollama bridge** (optional) — pair with a Mac on the same network for larger models
- **Claude Code** — for authoring new SKILL.md files; no model running locally required

## MVP Scope

Install PhoneClaw via TestFlight on an iPhone 15 or later, run the default Gemma 4 (2B) model, test the Calendar and Reminders skills, and write one custom SKILL.md that queries the user's notes app or a local JSON file.

Not in MVP: Ollama bridge, custom model selection, Shortcuts integration, App Store distribution.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Clone repo, open in Xcode, add an Apple Developer account, build to a physical iPhone 15+ via TestFlight | 2 h |
| 2 | Test default skills: ask about today's calendar, add a reminder, query clipboard — verify on-device inference | 1 h |
| 3 | Read existing SKILL.md files to understand the format; write one new skill (e.g., "what tasks are due this week?") | 2 h |
| 4 | Test the Ollama bridge: pair with a Mac running Ollama + Claude-3.5-Sonnet for heavier queries | 1 h |
| 5 | Profile battery and latency on Gemma 4 (2B) vs (4B) models; document findings as AGENTS.md | 1 h |

**Total estimate:** ~7 h (1–2 sessions, heavy on Xcode setup)

## Blockers

- **macOS + Xcode required** — no cross-platform build; Linux users cannot build this
- **Apple Developer account** — free tier works for personal TestFlight sideloading
- **iPhone 15+ recommended** — older devices may run 2B but will be slow; 4B model requires 15 Pro or later
- **LiteRT-LM model download** — ~2 GB for Gemma 4 2B; needs device storage headroom
- **Xcode provisioning complexity** — first-time iOS devs may spend 1–2 h on certificates alone
- **1.2k stars** — community is still small; bugs are likely; plan to debug at the Swift layer

## References

- GitHub: https://github.com/kellyvv/PhoneClaw
- GitTrend listing: https://gittrend.io/repo/kellyvv/PhoneClaw
- LiteRT-LM: Google's on-device inference format for Gemma models
- Gemma 4 model weights: https://huggingface.co/google/gemma-4
