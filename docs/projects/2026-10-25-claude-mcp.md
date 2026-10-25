# claude-mcp — Browser Extension: MCP Support in claude.ai Web UI

**Source:** [dnakov/claude-mcp](https://github.com/dnakov/claude-mcp) (MIT, browser extension)  
**Tagline:** "Use MCP servers from claude.ai in your browser — no CLI, no terminal, just the web UI."  
**Discovered:** 2026-10-25 (cloud backup)

---

## Why it fits

Claude Code has excellent MCP support. Claude.ai (the web UI) does not — it is a closed environment with no native MCP client. This browser extension bridges the gap: it adds an MCP client to the claude.ai page, so any MCP server you can run locally (or over a remote tunnel) becomes available as a tool in your browser chat sessions.

The user interest profile calls out **Claude/LLM tooling: CLI tools, extensions, wrappers around Claude**. This is exactly that — it extends the Claude web UI to support the full MCP ecosystem without requiring you to open a terminal.

Daily utility is high: if you use claude.ai for quick one-off chats, you currently lose access to all your MCP tools (filesystem, calendar, Drive, etc.). This extension restores that access.

Nothing in seen.json covers a browser-extension MCP client for claude.ai. The closest is `steipete/claude-code-mcp` (a one-shot MCP server for Claude Code, now archived) — a different direction entirely.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| Weekend-buildable | ✅ | A browser extension with an MCP stdio bridge (via a native host) is a well-understood architecture. |
| Fills gap | ✅ | No browser-extension MCP client for claude.ai in seen.json. |
| Novel | ✅ | Brings full MCP ecosystem to the web UI without a CLI session. |
| Daily utility | ✅ | Every claude.ai session gets access to your local tools. |

**Total: 4/4**

## Shape

Option A — **install upstream claude-mcp.** MIT, Chrome/Firefox. Load the extension, configure your MCP servers in the extension popup, done. The extension communicates with a local native host (a small Node.js or Rust binary) that speaks MCP stdio.

Option B — **build a minimal local equivalent.** A Chrome extension that injects a sidebar into claude.ai and proxies MCP calls through a WebSocket-to-stdio bridge is a 1-day project.

The plan below covers Option B as a fallback; if upstream installs cleanly, skip to Phase 4.

## Stack

- Chrome extension (Manifest V3)
- `chrome.runtime.connectNative` → native messaging host (Node.js, reads `~/.claude/mcp_servers.json`)
- WebSocket bridge (for MCP servers that speak HTTP instead of stdio)
- Same `mcp_servers.json` format as Claude Code so config is shared

## MVP scope

1. Extension popup lists MCP servers from `~/.claude/mcp_servers.json`.
2. On clicking an MCP server, the extension spawns it (via native host) and negotiates the MCP handshake.
3. Extension injects a `<tool>` block into the claude.ai chat input: `[tool: filesystem_read]`.
4. Claude's response triggers a tool-call event; the extension intercepts it, calls the MCP server, and injects the result back as a user message.
5. MVP is fully manual — no automatic tool-call interception yet; the user types the tool name.

## Phases

1. **Extension scaffold (0.5 h).** Manifest V3 extension with a popup. Lists hardcoded MCP server names.
2. **Native host (1 h).** Node.js native messaging host (`claude-mcp-host`). Reads `~/.claude/mcp_servers.json`, spawns selected server as a child process, speaks MCP stdio.
3. **MCP handshake (1 h).** Extension → native host → MCP server: `initialize` → `tools/list`. Display available tools in the popup.
4. **Tool injection (1.5 h).** Inject a toolbar into the claude.ai page (via content script) with one button per MCP tool. Clicking a tool appends a formatted tool-call request to the chat input.
5. **Response capture (1.5 h).** Monitor the claude.ai response stream for tool-call JSON. Parse it, call the MCP server, inject the result as a follow-up user message. (Fully automatic tool-call loop.)
6. **(Later) Shared config.** Add a config UI to set custom MCP server entries without editing JSON by hand.

## Effort

About 4 h total for Phases 1–4 (manual tool injection). Phase 5 (automatic response capture) is another 1.5 h. Option A (upstream) is under 10 min if the extension loads and the native host installs.

## Blockers / risks

- **Native messaging setup:** Chrome native messaging requires a manifest JSON registered in the OS and the native host binary in a specific path. Follow Chrome's own docs precisely.
- **claude.ai DOM stability:** The content script targets claude.ai's DOM. Any UI update from Anthropic can break the injection point. Pin to a selector you can update quickly, and watch for page reloads.
- **Tool-call format:** claude.ai's internal tool-call format (how it requests a tool result from the user) is not documented. Reverse-engineer it from the network tab before Phase 5.
- **MCP server lifecycle:** The native host must kill spawned MCP servers when the extension unloads or the tab closes. Handle cleanup carefully to avoid orphan processes.
