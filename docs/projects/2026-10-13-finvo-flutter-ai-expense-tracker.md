# Finvo — Self-Hosted AI Expense Tracker (Flutter + FastAPI + Voice)

**Source:** GitHub — https://github.com/kylesean/finvo  
**Tagline:** "Record expenses by voice or chat; AI agent categorizes and tracks them — 100% self-hosted, AGPL-3.0"  
**Discovered:** 2026-10-13

---

## Why it fits

The pattern of "take a photo of a receipt" or "tap to add" is friction-heavy for daily expense logging. Finvo targets voice-driven bookkeeping: say "spent 120 on groceries at Lidl" and the LangGraph agent pulls out amount, category, merchant, and timestamp without tapping a form. The full stack is Flutter (mobile + web frontend) + FastAPI backend + pgvector for semantic search + a local ASR server — so every byte stays on your own infrastructure. It works with cloud LLMs (DeepSeek, OpenAI) or local Ollama endpoints.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Docker Compose setup; the README's `cp .env.example` → `docker compose up` path targets exactly this use case |
| fills_gap | 1 | Existing finance tools in the toolkit are either cloud-only or lack voice entry; a self-hosted voice-first tracker is absent |
| novel | 1 | Voice-driven + LangGraph memory (Mem0) + local ASR + Flutter mobile in one self-hosted stack is uncommon |
| daily_utility | 1 | Expense logging is daily, and the friction reduction from voice entry makes it stick |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Flutter** (frontend, mobile-first; supports Android, iOS, web)
- **FastAPI + Python 3.13** (backend agent runtime)
- **LangGraph + Mem0** (AI agent + persistent memory across sessions)
- **PostgreSQL + pgvector** (storage + semantic search over transactions)
- **Local ASR server** (self-hosted speech recognition; Whisper-compatible)
- **Docker + Docker Compose** (recommended deployment)
- Cloud LLMs (DeepSeek-R2, OpenAI) or local **Ollama** endpoints

## MVP Scope

Deploy Finvo locally via Docker Compose with a cloud LLM (DeepSeek or OpenAI — no local GPU needed). Log 20 real expenses by text chat, verify categorization and monthly view. Skip voice (ASR server) and local LLM until the core flow is validated.

Not in MVP: voice entry, Ollama local LLM, multi-user, budget alerts, Flutter mobile build.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Clone repo; `cp server/.env.example server/.env`; set OPENAI/DeepSeek API key; `docker compose up` | 1 h |
| 2 | Log 20 real expenses via chat; verify amount, category, merchant extraction accuracy | 2 h |
| 3 | Review the monthly analytics view; check if auto-categorization matches your actual spending patterns | 1 h |
| 4 | Set up local ASR server (Whisper via Docker); enable voice input on mobile web | 2 h |
| 5 | Build the Flutter APK for Android or run iOS simulator; test the full voice → log → dashboard flow | 2 h |

**Total estimate:** ~8 h (1–2 Claude sessions)

## Blockers

- Docker and Docker Compose required (standard, but host needs ~4 GB RAM for all containers)
- Local ASR server adds significant setup complexity; skip for text-only MVP
- OpenAI or DeepSeek API key required for Phase 1–3; local Ollama works but needs a capable GPU
- AGPL-3.0 license — can't embed in a proprietary app without releasing modifications
- Repository maturity unknown — check commit history and open issues before relying on it for real data

## References

- GitHub: https://github.com/kylesean/finvo
- License: AGPL-3.0
- Stack: Flutter · FastAPI · LangGraph · Mem0 · pgvector · local ASR
