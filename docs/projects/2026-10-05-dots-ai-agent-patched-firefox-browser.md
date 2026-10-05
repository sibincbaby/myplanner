# dots — AI Web Agent with Stealth Browser

**Source:** <https://github.com/feder-cr/dots>
**Discovered:** 2026-10-05
**Viability:** 4/4

> A Python CLI that pairs any OpenRouter model with a patched Firefox (C++ level) that removes every anti-bot signal — no WebDriver flag, no DevTools protocol, trusted pointer/key events, consistent fingerprint per seed. One `uvx` command opens a local chat at `localhost:8765` beside the live page.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

The C++ Firefox patches are months of work and not replicable in a weekend. The personal build uses **Playwright-extra + playwright-stealth**, which covers ~90 % of real-world anti-bot sites, and wires Claude as the reasoning model instead of OpenRouter. The result is a personal research agent CLI with session persistence, a tiny FastAPI chat endpoint, and tool calls for navigation, extraction, and form fill. No polished OSS alternative does this end-to-end with Claude specifically and persisted sessions.

---

## Implementation Plan

**2 Claude Code sessions** to a working research agent CLI with stealth browser, session persistence, and a local chat interface.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.12 | dots is Python; playwright-extra is Python-native |
| Browser | playwright-extra + playwright-stealth | Stealth plugin removes WebDriver + CDP fingerprint; ~90% coverage |
| Model | Anthropic Claude (Haiku/Sonnet) | Direct SDK, no OpenRouter needed |
| Chat UI | FastAPI + minimal HTML | Serves localhost:8765 same as dots |
| Session persistence | Playwright `--user-data-dir` | Preserves cookies/logins between runs |
| Task DSL | Plain Python dataclass | `Task(url, goal, steps[])` |

---

## MVP Scope

- `research <query>` command: opens stealth browser, searches DuckDuckGo or a target site, extracts text, passes to Claude, returns structured answer.
- `browse <url> <goal>` command: loads URL, lets Claude navigate (click, fill, extract) via tool calls until goal satisfied or max steps reached.
- Session persistence: `--profile <name>` flag reuses a named browser profile (cookies, localStorage intact).
- Local chat: `chat` command starts FastAPI at `localhost:8765`, rendering a minimal HTML page with the live browser screenshot on the right and a chat input on the left.
- Tool set: `navigate(url)`, `click(selector)`, `type(selector, text)`, `extract(selector)`, `screenshot()`, `done(result)`.

Out of scope for MVP: the C++ Firefox patches, proxy rotation, CAPTCHA solving, multi-tab orchestration.

---

## Implementation Phases

### Phase 1: Stealth browser + Claude tool-call loop

**Goal:** A Python script that launches a stealth browser, receives a goal, and uses Claude tool calls to navigate to completion.

**Files:**
- `src/browser.py` — `launch(profile=None)` → `BrowserContext`; wraps `playwright_stealth.stealth_async`
- `src/tools.py` — defines the 6 tool schemas for Claude + handler functions
- `src/agent.py` — `run(goal, start_url, context)`: messages loop with `client.messages.create(tools=[...])` until `done` tool called or step limit

**Key steps:**
1. `pip install playwright-extra playwright-stealth anthropic fastapi uvicorn pillow`
2. `playwright_stealth.stealth_async(page)` immediately after `context.new_page()`.
3. Tool loop: pass tool results back in the next `messages` call until `stop_reason == "tool_use"` for the `done` tool.
4. `screenshot()` tool captures `page.screenshot(type="png")` and returns base64; include in Claude vision call.

**Verify:** `python -m dots research "current price of BTC"` on a public site. Confirm stealth by checking the DevTools Protocol is absent from page JS (`window.chrome.runtime` undefined).

---

### Phase 2: Session persistence + CLI

**Goal:** Named browser profiles; `browse`, `research`, and `chat` commands exposed via Click CLI.

**Files:**
- `src/cli.py` — Click group with `research`, `browse`, `chat` commands
- `src/profiles.py` — `get_profile_path(name)` → `~/.dots/profiles/<name>/`

**Key steps:**
1. `BrowserType.launch_persistent_context(user_data_dir=profile_path, headless=False)` — preserves cookies.
2. CLI: `dots research "flight prices SFO→LHR next week"` and `dots browse https://example.com "find the contact email"`.
3. Add `--headless` flag (default False so user can intervene on CAPTCHAs).

**Verify:** Log into a site that requires auth (e.g., GitHub), persist profile, then re-run a `browse` task on it without re-logging-in.

---

### Phase 3: Local chat interface

**Goal:** `dots chat` starts a FastAPI server at `localhost:8765` with a browser live-view on the right and a chat input on the left.

**Files:**
- `src/server.py` — FastAPI app with WebSocket for chat and a `/screenshot` endpoint
- `static/index.html` — Vanilla JS; WebSocket to server, `<img>` refreshed on screenshot events

**Key steps:**
1. FastAPI `WebSocket` endpoint receives chat messages, runs `agent.run(goal)`, streams Claude token-by-token via `anthropic.stream()`.
2. Screenshot endpoint returns the current page PNG; JS polls every 2 s or on `screenshot` tool event.
3. Keep it single-page; no framework dependency.

**Verify:** `dots chat` → open `http://localhost:8765` → type "search for the cheapest MacBook Air on eBay" → confirm browser moves and returns a price.

---

## Estimated Effort

About 2 Claude Code sessions.
- **Session 1 (≈ 2.5 h):** Phases 1 + 2. Stealth browser setup, tool definitions, Claude loop, CLI.
- **Session 2 (≈ 1.5 h):** Phase 3. FastAPI server, WebSocket streaming, HTML chat UI.

## Potential Blockers

- **Playwright-stealth coverage gaps:** Some sites (Cloudflare Turnstile, hCaptcha v2) will still block. For those, run with `--headless false` and solve manually once to prime the session.
- **Anti-bot evolution:** playwright-stealth is community-maintained; a major CF update may break it. Fallback: use the actual dots Firefox binary (pre-built releases available).
- **Screenshot size:** Claude vision has a 5 MB image limit; resize to 1280×800 before sending.
- **Tool loop safety:** Set `MAX_STEPS = 20` and always provide an escape tool (`abort(reason)`) to prevent infinite loops on confused pages.
- **macOS Gatekeeper:** playwright-extra launches Chromium; first run may require `security allow` for the browser binary.
