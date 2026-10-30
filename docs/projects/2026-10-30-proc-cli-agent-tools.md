# Proc-CLI — Agent-Friendly Process & Port Management Tool

**Source:** HN Digest (Oct 27, 2026) — described as an agent-friendly CLI for process and port management  
**Repo:** https://github.com/proc-cli/proc-cli  
**Discovered:** 2026-10-30  
**Viability:** 3/4 (WB ✅ · FG ✅ · N ✅ · DU ❌)

## What it is

Proc-CLI is an agent-friendly CLI tool for process and port management, built for AI agents to work with system resources. The core insight: standard tools (`lsof`, `ps`, `kill`, `fuser`) produce output that LLMs struggle to parse reliably — inconsistent formats, platform differences (macOS vs Linux), and noisy stderr. Proc-CLI wraps them with clean JSON output, structured error codes, and safe defaults (no `kill -9` without confirmation). Designed to be dropped in as an MCP server tool or called directly from agent shell scripts.

Key details:
- JSON output for all commands (no ANSI, no platform-specific headers)
- Safe kill: `proc kill <pid>` sends SIGTERM first, waits, then escalates — never SIGKILL without `--force`
- Port tools: `proc port list`, `proc port kill <port>`, `proc port wait <port> --timeout 30s`
- Process tools: `proc ps`, `proc find <name>`, `proc tree <pid>`
- MCP server mode: `proc mcp` exposes all commands as MCP tools

## Why it scores

- **Weekend-buildable:** A Node.js or Python CLI that wraps `ps`, `lsof`, and `kill` with JSON output and a tiny MCP server is achievable in a single Claude session.
- **Fills gap:** Every Claude Code session that starts a dev server, runs tests, or manages background workers hits the "what's on port 3000?" problem. The agent calling `lsof -i :3000` gets ANSI-colored, platform-specific output that varies subtly — `proc port list` returning clean JSON solves this permanently.
- **Novel:** Proc-CLI's MCP server mode is the key differentiator — exposing process management as MCP tools lets any AI agent use it without custom shell parsing.
- **Daily utility:** Not every-day for all users — daily only when actively developing with agents that need process management. Score reflects this.

## Build angle

Build a Node.js CLI with an MCP server mode:

1. A `proc` CLI (Node.js + `commander`) with subcommands: `ps`, `find`, `port list`, `port kill`, `port wait`, `kill`, `tree`.
2. All output as clean JSON by default; `--human` flag for human-readable tables.
3. Safe kill implementation: SIGTERM → 3s wait → SIGKILL (only with `--force`).
4. MCP server mode: `proc mcp` starts a stdio MCP server exposing all commands as tools.
5. Cross-platform: use `ps-list` npm package on all platforms; `node-portfinder` for port operations.

## MVP Scope (weekend build)

- [ ] `proc ps [--filter <name>]` — list processes as JSON `[{pid, name, cpu, mem, ppid}]`
- [ ] `proc find <name>` — find processes by name, return PIDs
- [ ] `proc port list [--port <n>]` — list PIDs listening on ports as JSON
- [ ] `proc port kill <port>` — kill process on port (SIGTERM + wait + SIGKILL with --force)
- [ ] `proc kill <pid>` — safe kill with confirmation prompt unless `--yes`
- [ ] `proc mcp` — stdio MCP server with all above as tools
- [ ] Cross-platform test on macOS and Linux

## Phases

### Phase 1 — Core process commands (Day 1, ~2h)
- `proc ps`, `proc find`, `proc kill` using `ps-list` npm package
- JSON output with consistent schema
- Safe kill with SIGTERM/SIGKILL escalation

### Phase 2 — Port management (Day 1, ~1.5h)
- `proc port list` using `lsof`/`netstat` parsing (or `node-net-scanner`)
- `proc port kill <port>`: find PID → safe kill
- `proc port wait <port> --timeout <s>`: poll until port is free or timeout

### Phase 3 — MCP server (Day 2, ~2h)
- `proc mcp` command starts a stdio MCP server
- One MCP tool per subcommand, with JSON schema inputs and outputs
- Test with `claude mcp add proc -- proc mcp`

### Phase 4 — Process tree (Day 2, ~1h)
- `proc tree <pid>` renders parent-child process tree as nested JSON
- Useful for agents to identify all processes spawned by a server

## Effort estimate

| Phase | Hours |
|-------|-------|
| Core process commands | 2 |
| Port management | 1.5 |
| MCP server | 2 |
| Process tree | 1 |
| **Total** | **~6.5h** |

## Blockers / risks

- `lsof` is not available on all Linux distros by default; fall back to `/proc/<pid>/net/tcp` parsing on Linux.
- The MCP `proc mcp` server mode must handle concurrent requests (agent may call multiple tools in parallel); ensure stdio MCP server doesn't block.
- Safe kill semantics: what counts as "process dead" after SIGTERM? Check `/proc/<pid>` existence on Linux, use `ps -p <pid>` on macOS.

## Reference

- HN digest mention: https://github.com/kouweizhu/agents-radar/issues/690
- `ps-list` npm package: https://github.com/sindresorhus/ps-list
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Claude Code MCP setup: https://docs.anthropic.com/en/docs/claude-code/mcp
