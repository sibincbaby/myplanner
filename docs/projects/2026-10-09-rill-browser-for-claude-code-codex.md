# Rill Browser — Browser Where Claude Code & Codex Work Beside You

**Source:** Product Hunt week of Oct 5, 2026 (weekly leaderboard #41)  
**Tagline:** "The browser where Claude Code and Codex work beside you"  
**Discovered:** 2026-10-09

---

## Why it fits

Dev workflows constantly switch between a browser (checking docs, inspecting running apps, reading error pages) and the terminal agent. Rill Browser bakes both into one window — agents can see the active URL and page content without context-switching. This is a new architectural layer that none of the existing Claude Code UI projects cover.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Electron + webview + Claude Agent SDK panel; clear MVP in 2 sessions |
| fills_gap | 1 | No project in the seen list combines a browser with an agent side-panel |
| novel | 1 | Browser-level integration is structurally different from existing terminal/Electron UIs |
| daily_utility | 1 | Web developers would open this instead of Chrome every session |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Electron** — shell for embedding Chromium + Node.js
- **Electron BrowserView / webContents** — full-power browser pane (left)
- **Claude Agent SDK** (TypeScript) — chat panel (right)
- **@playwright/test** pattern for page content extraction (optional, for page-context injection)

## MVP Scope

Electron app with a horizontal split:
- Left: embedded Chromium showing any URL the user navigates to
- Right: Claude Code / Agent SDK chat that auto-receives the current page URL and title as context

Not in MVP: screenshot injection, DOM inspection, bookmarks sync.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Electron shell with BrowserView (left) + Node renderer panel (right) | 3 h |
| 2 | Claude Agent SDK integration in the right panel | 2 h |
| 3 | Auto-share active page URL + title to agent context | 1 h |
| 4 | Screenshot button → injects image into agent chat | 2 h |
| 5 | Session persistence: last URL + conversation restored on reopen | 2 h |

**Total estimate:** ~10 h (1.5–2 Claude sessions)

## Blockers

- Electron BrowserView security policy may block some internal domains
- Claude Agent SDK auth flow inside Electron needs a secure token store
- OS-level clipboard / accessibility permissions (macOS notarization)

## References

- Product Hunt weekly Oct 5: https://www.producthunt.com/leaderboard/weekly/2026/41
- Playwright bundled in pre-installed browser environment (`/opt/pw-browsers/chromium`)
