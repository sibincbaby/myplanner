# open-ai-agents-hub — Self-Hosted Agent Platform

**Source:** [github.com/Anil-matcha/open-ai-agents-hub](https://github.com/Anil-matcha/open-ai-agents-hub)  
**Language:** TypeScript (Next.js) + Python (FastAPI) · **Platform:** Self-hosted, Docker  
**Date discovered:** 2026-08-05

## What it is

An open-source, self-hosted platform for building, hosting, and chatting with AI agents — LLM chat agents and image/video generation agents — from a single interface. You bring your own API keys; the platform is a proxy backend and chat UI that runs entirely on your own infrastructure.

Think of it as a private, self-contained alternative to managed platforms like Claude.ai or ChatGPT — but where you control the data, the agents, and the API routing. Agents can be registered from templates or defined as custom endpoints; each gets its own persistent chat history.

## Why it fits

- Core interest: **agent UIs** — exactly the "custom agent interface" use case
- Core interest: **Claude/LLM tooling** — brings your Claude API key into a unified multi-agent hub
- `weekend_buildable = 1`: Docker Compose setup is the bulk of the work; first custom agent is another hour
- Daily utility: a single place to manage all your custom agents (finance bot, code reviewer, diary assistant) instead of separate tabs/scripts

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Docker Compose + customise one agent definition = a weekend |
| fills_gap | 1 | No good self-hosted equivalent for managing multiple personal Claude agents with chat history |
| novel | 0 | Functionally similar to Open WebUI (which is widely deployed); differentiation is agent hosting model |
| daily_utility | 1 | Single hub for all personal agents used every day |
| **Total** | **3/4** | **VIABLE** |

## Stack Recommendation

```
Next.js 14+             — frontend (app router, SSE streaming)
FastAPI + Python        — API proxy, agent registry
SQLite / PostgreSQL     — chat history, agent definitions
Docker Compose          — one-command deploy
Claude API (Sonnet)     — primary LLM for your agents
Tailwind CSS            — UI styling
```

Deploy on a home server, a Raspberry Pi 5, or a cheap VPS — the stack is lightweight.

## MVP Scope (1 Claude session)

1. `docker compose up` and verify the UI loads at `localhost:3000`
2. Register your Claude API key in the settings
3. Define one custom agent: name "Finance Bot", system prompt, Claude Sonnet model
4. Start a chat with Finance Bot, ask "What's a good monthly budget split?"
5. Confirm streaming response works and chat history persists after a page refresh

## Phases

### Phase 1: Deploy + First Agent (2-3h)
- Clone the repo, configure `.env` with your Claude API key
- `docker compose up -d` and access the UI
- Register a personal "Finance Bot" agent with a custom system prompt
- Verify streaming chat works, history saves to SQLite
- Set up automatic restart: `docker compose restart unless-stopped`

### Phase 2: Multi-Agent Setup (2h)
- Register 3-5 agents for your daily use cases:
  - **Finance Bot** — expense tracking, budget advice
  - **Code Reviewer** — review code snippets with a strict reviewer persona
  - **Diary Assistant** — daily journaling prompts and reflection
  - **Research Bot** — summarise URLs or documents you paste in
- Assign each a distinct system prompt and optionally a different model/temperature
- Test switching between agents — verify context isolation (Finance Bot doesn't see Diary history)

### Phase 3: Image/Video Agent (2h)
- Enable the image generation agent template (Stable Diffusion or DALL-E 3)
- Configure your API key for image generation
- Test: "Generate a minimalist desk setup illustration" — verify image appears in chat
- Add a "Design Concepts" agent preset for quick visual mockup generation

### Phase 4: Auth + Mobile Access (2-3h)
- Enable basic auth (username/password) so you can expose the hub on your local network
- Access from phone browser — verify the chat UI is usable on mobile (responsive check)
- Optional: set up Tailscale so you can reach your hub from anywhere without opening ports
- Add a custom domain via Caddy reverse proxy with automatic HTTPS

### Phase 5: Agent Templates & Sharing (2h)
- Export your best agent definitions as JSON templates
- Create a `my-agents/` directory in the repo to track customisations in git
- Document your system prompts in a `prompts.md` file (personal knowledge base for prompt engineering)
- Optional: submit your Finance Bot template upstream as a contributed preset

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Deploy + First Agent | 2-3h |
| Multi-Agent Setup | 2h |
| Image/Video Agent | 2h |
| Auth + Mobile Access | 2-3h |
| Agent Templates | 2h |
| **Total** | **10-12h (~2 weekends)** |

Phase 1-2 (all daily agents running): **4-5h (1 weekend session)**.

## Blockers / Risks

- Docker on Linux is straightforward; macOS Docker Desktop can have volume-permission quirks — use bind mounts with explicit UID if `/data` won't persist
- Streaming SSE can be blocked by some corporate proxies / reverse proxies — configure `X-Accel-Buffering: no` in Nginx/Caddy if responses appear chunked
- SQLite works fine for personal use but becomes a bottleneck above ~5 concurrent users — switch to PostgreSQL if you share the hub with your team
- The agent registry API is not yet versioned; upstream breaking changes to agent schemas will require a migration script after `git pull`
- Exposing on the internet (even with auth) is a risk if your API key is stored in plaintext SQLite — use environment secrets and consider restricting to Tailscale network only
