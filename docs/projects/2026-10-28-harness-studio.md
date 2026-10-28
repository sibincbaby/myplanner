# Harness Studio — macOS/Linux Coding Agent with UI Element Picking

**Source:** GitHub Trending (AI agents tracker)  
**Repo:** https://github.com/vigneshv1cky/harness-studio  
**Discovered:** 2026-10-28  
**Viability:** 3/4 (FG ✅ · N ✅ · DU ✅)

## What it is

Desktop coding agent for macOS and Linux built on DeepSeek Harness. Key differentiator: **UI-aware element picking** — click any DOM element in your running dev server and the agent receives the source file path, line number, and computed styles automatically. Also ships: local SenseVoice STT, Chrome MCP integration, MCP connector sidebar, browser control pane, and zero telemetry.

Stack: Electron-like desktop app (Node.js 24 + Next.js 16), Python + Node bundled, pnpm. MIT license.

## Why it scores

- **Fills gap:** Element-picking → source mapping is genuinely absent in Claude Code, Codex, Amp. No existing agent does click-to-context.
- **Novel:** The "click a rendered element, agent knows the file and line" loop is a new interaction primitive for coding agents.
- **Daily utility:** Any developer doing UI work with an AI coding agent benefits from this every session.
- **Not weekend-buildable:** The Electron packaging + Node.js/Python bundling + Chrome DevTools MCP wiring is a multi-week project from scratch. Worth adapting the concept rather than rebuilding.

## Build angle

Rather than forking the full desktop app, the clickable-element → source-file bridge is extractable as a **Claude Code MCP server**:

1. Serve a JS snippet injected into the dev server (via Vite plugin or script tag) that sends `{file, line, styles}` on element click to a local SSE endpoint.
2. MCP server exposes a `selected_element` tool that Claude Code can call to get the last-clicked element's context.
3. Claude Code can then navigate to that file and make the targeted edit.

This gives the core value (click → agent context) as a weekend-sized side project.

## MVP Scope (weekend build)

- [ ] Vite plugin that injects the click-listener overlay into the dev server HTML
- [ ] Node.js MCP server (`mcp-ui-pick`) with one tool: `get_selected_element → {file, line, selector, computedStyles}`
- [ ] Click overlay: highlight hovered element, on click POST `{file, line}` to local server via source maps
- [ ] README with Claude Code MCP config snippet

## Phases

### Phase 1 — Click-to-source bridge (Day 1, ~4h)
- Vite plugin that injects overlay script
- Source-map resolution: `element → {file, line}` via browser source maps or Vite's dev-server transform API
- Local HTTP server (POST /element → stores last selection)

### Phase 2 — MCP server (Day 1, ~2h)
- `@modelcontextprotocol/sdk` server with `get_selected_element` tool
- Returns last stored `{file, line, selector, computedStyles}`
- `.claude/mcp.json` config snippet for the README

### Phase 3 — Polish (Day 2, ~2h)
- Visual overlay: highlight ring on hover, checkmark on click
- Support React DevTools-style component name resolution (optional)
- Publish to npm as `mcp-ui-pick`

## Effort estimate

| Phase | Hours |
|-------|-------|
| Click-to-source bridge | 4 |
| MCP server | 2 |
| Polish + npm publish | 2 |
| **Total** | **~8h** |

## Blockers / risks

- Source map resolution in the browser can be finicky for transpiled code — may need Vite's transform API for reliable file/line mapping.
- Chrome only initially (Firefox lacks some DevTools extension APIs used for source mapping).
- The full Harness Studio desktop app has Python bundled for STT; the MCP approach skips that complexity entirely.

## Reference

- Harness Studio README: https://github.com/vigneshv1cky/harness-studio
- Vite plugin API: https://vitejs.dev/guide/api-plugin.html
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
