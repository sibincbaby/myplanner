# Chrome DevTools MCP — Browser Debugging for Coding Agents

**Source:** GitHub (ChromeDevTools/chrome-devtools-mcp)  
**URL:** https://github.com/ChromeDevTools/chrome-devtools-mcp  
**Tagline:** "Chrome DevTools for coding agents — gives your AI coding assistant access to Chrome DevTools for automation, debugging, and performance analysis"  
**Discovered:** 2026-10-09

---

## Why it fits

Web app development with Claude Code today means constant copy-pasting of console errors, network responses, and DOM states. Chrome DevTools MCP is an official Chrome team project that exposes the full Chrome DevTools Protocol (CDP) as MCP tools — giving Claude direct access to the browser inspector. Last updated Oct 7, 2026.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Existing open-source project — setup + integration in 0.5 sessions |
| fills_gap | 1 | No browser debugging MCP in seen.json; this is official Chrome team work |
| novel | 1 | Official CDP-as-MCP from the Chrome DevTools team itself is a first |
| daily_utility | 1 | Web developers would use this on every front-end debugging session |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

This is an existing project — the build task is **integration and workflow creation**, not building from scratch.

- **Clone:** `git clone https://github.com/ChromeDevTools/chrome-devtools-mcp`
- **Register** in Claude Code MCP config
- **Build a skill** for the most common debug workflows (console errors → fix, network waterfall inspection, DOM query)

## MVP Scope (Integration Plan)

1. Install Chrome DevTools MCP and register as a Claude Code MCP server
2. Launch Chrome with `--remote-debugging-port=9222`
3. Validate Claude can query the DOM, read console errors, and inspect network requests
4. Write a Claude Code skill (`/debug-browser`) that automates common debug flows

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Clone, install, configure MCP server in `~/.claude/settings.json` | 1 h |
| 2 | Smoke test: console log read, DOM query, screenshot via Claude Code | 1 h |
| 3 | Write a `/debug-browser` skill (capture console errors → suggest fix) | 2 h |
| 4 | Network tab integration: Claude reads failing requests and proposes fixes | 2 h |
| 5 | Performance audit workflow: Lighthouse score → Claude proposes optimizations | 2 h |

**Total estimate:** ~8 h (0.5–1 Claude session for setup; remainder for skill writing)

## Blockers

- Chrome must be launched with `--remote-debugging-port` (security warning; don't leave open)
- macOS/Windows Chrome may require `--no-sandbox` for CDP access in some environments
- Large DOM trees will hit MCP message size limits — need selective DOM querying

## References

- GitHub: https://github.com/ChromeDevTools/chrome-devtools-mcp
- Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/
