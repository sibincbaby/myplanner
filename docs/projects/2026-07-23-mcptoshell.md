# MCPtoShell

> Runtime CLI generator for MCP servers and OpenAPI specs — point it at any MCP manifest or OpenAPI URL and get a fully typed shell command with subcommands, flags, and tab-completion; 96-99% fewer tokens than native MCP injection

**Inspired by:** [knowsuchagency/mcp2cli](https://github.com/knowsuchagency/mcp2cli) (HN Show HN, March 2026)  
**Date discovered:** 2026-07-23

---

## What gap it fills

When you connect an MCP server to Claude Code, every tool schema gets injected into the system prompt on every turn — even for tools you'll never use in that session. For a server with 50 tools, that's 10–20k tokens of dead weight per request. MCPtoShell generates a typed `bash` CLI from the MCP schema at startup: instead of schema injection, Claude calls a tiny shell command, gets back only the relevant result, and never needs the schema at all. Works offline, works with any LLM, and the generated CLI is human-usable too.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Core | Python + Click or Node + Commander | Schema parse → argument generation is straightforward |
| MCP protocol | Python mcp SDK or direct JSON-RPC over stdio/HTTP | Fetch tools/list and call tools/call |
| OpenAPI parse | openapi-core (Python) or oas-tools (Node) | Handles both JSON and YAML, v3.0/3.1 |
| Output format | Bash script + POSIX subcommands | Universal; works in any shell, any agent |
| Tab-completion | Click's shell_completion or oclif | Auto-generates `_mcptoshell_completion` |
| Distribution | `pipx install mcptoshell` or `npx mcptoshell` | Zero dependency install |

## MVP scope (1 Claude session)

Two working modes:

1. **`mcptoshell mcp <server-command>`**: spawns the MCP server process, fetches `tools/list`, generates a bash script where each tool becomes a subcommand with positional args and `--param` flags, exits
2. **`mcptoshell openapi <url-or-file>`**: reads an OpenAPI 3.x spec, maps each `operationId` to a subcommand, generates equivalent bash wrapper that calls the API endpoint

The generated script includes:
- `#!/usr/bin/env bash` preamble with the original server invocation baked in
- One subcommand per tool with `--help` built from `description`
- JSON output mode (`--json`) for piping into Claude

Out of scope for MVP: GraphQL, streaming responses, OAuth flows, interactive prompts.

## Phases

### Phase 1 — MCP tool list fetch (1 h)
- Connect to a stdio MCP server process (spawn via command string)
- Send `initialize` + `tools/list` JSON-RPC requests
- Parse response into structured tool list: `{name, description, inputSchema}`
- Handle HTTP MCP servers too (GET `/mcp/tools`)

### Phase 2 — CLI codegen from tool schema (1.5 h)
- For each tool, map `inputSchema.properties` to Click params/Commander options
- Required properties → positional args; optional → `--flag value`
- Boolean properties → `--flag/--no-flag` switches
- Emit a single Python or Node script with all subcommands wired up
- Each subcommand body: JSON-RPC `tools/call` with collected args → print result

### Phase 3 — OpenAPI mode (1 h)
- Parse OpenAPI 3.x spec
- Map each path+method to a subcommand using `operationId` as name, `summary` as description
- Path params → positional; query params → `--flag`; request body → `--body <json>`
- Emit equivalent bash (curl-based) or Python (httpx-based) script

### Phase 4 — CLAUDE.md injection (0.5 h)
- `mcptoshell inject`: writes a `CLAUDE.md` block explaining how to use the generated CLI
- Example: "To query the database use `./mcp-db.sh query-table --table users --limit 10`"
- Claude picks up the CLI interface from CLAUDE.md, never needs the raw MCP schemas in context

### Phase 5 — Tab-completion + watch mode (0.5 h)
- `mcptoshell completion` outputs shell completion script
- `mcptoshell watch <server>`: monitors the MCP server for tool schema changes and regenerates the CLI automatically on change

## Effort estimate

~3 hours for Phases 1–2 (MCP mode MVP) · 1 Claude session  
~5 hours complete with OpenAPI mode and CLAUDE.md injection

## Blockers / risks

- **MCP stdio protocol quirks**: some servers send partial JSON or non-standard init sequences. Mitigation: use the official `mcp` Python SDK for connection handling rather than raw socket code.
- **Schema complexity**: `anyOf`/`oneOf` in JSON Schema don't map cleanly to flat CLI flags. Mitigation: flatten to `--param <json>` for complex types, with a `--help` note showing the expected shape.
- **CLI vs streaming tools**: MCP tools that stream incremental results (e.g. search with pagination) don't fit the one-shot CLI model. Mitigation: buffer full response before printing; add `--stream` flag that prints each chunk to stdout as it arrives.
