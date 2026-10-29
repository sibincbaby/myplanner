# Pare — Structured-Output MCP Wrappers for Dev CLIs

**Source:** Open Source Radar issue #66 (Oct 28, 2026)  
**Repo:** https://github.com/sourav-ojha/open-source-radar/issues/66 _(upstream repo TBD — see Pare's own repo when confirmed)_  
**Discovered:** 2026-10-29  
**Viability:** 4/4 (WB ✅ · FG ✅ · N ✅ · DU ✅)

## What it is

Pare is a collection of 240 MCP tool wrappers for common developer CLIs (git, npm/pnpm, cargo, docker, gh, etc.). Each wrapper returns structured JSON output rather than raw terminal text, making the results immediately usable by agents without a parsing step. The goal is to replace brittle "run shell command and hope the agent can parse stdout" patterns with typed, schema-backed tool calls.

Key details:
- 240 wrappers covering common dev CLIs
- Each wrapper returns structured JSON (schema-backed)
- Available as an MCP server — point Claude Code / any MCP client at it
- Apache 2.0 license

## Why it scores

- **Weekend-buildable:** Building a personal subset of 5-15 structured MCP wrappers for your most-used CLIs (git status/diff/log, npm list/audit, docker ps/logs, gh pr list) is a focused 1-session project. The pattern is repetitive and well-suited to a Claude-assisted build.
- **Fills gap:** Agents currently receive raw terminal output for CLI tool calls and must parse it themselves — this introduces hallucination risk and brittle prompting. Structured JSON output removes that entire class of error.
- **Novel:** While MCP servers for individual tools exist, a unified opinionated collection with consistent schema design (same conventions for all 240 wrappers) is a new primitive for agent development.
- **Daily utility:** Every coding session that uses git, npm, docker, or gh would benefit from structured tool output. No more "parse the git log yourself" prompts.

## Build angle

Build a personal `my-dev-mcp` server with structured wrappers for your 10 most-used CLI tools:

1. Define a JSON schema for each tool's output (e.g., `git_status` returns `{staged: [], unstaged: [], untracked: []}`).
2. Implement each wrapper as an MCP tool that runs the CLI command, parses stdout, and returns the schema.
3. Register the MCP server in Claude Code's `settings.json` and verify each tool with a live test.
4. Gradually expand to cover more commands.

## MVP Scope (weekend build)

- [ ] MCP server scaffold (TypeScript/Node or Python with FastMCP)
- [ ] `git_status`, `git_diff`, `git_log` tools with structured output
- [ ] `npm_list`, `npm_audit` tools
- [ ] `docker_ps`, `docker_logs` tools
- [ ] `gh_pr_list`, `gh_issue_list` tools
- [ ] Claude Code `settings.json` integration (local MCP server)
- [ ] README with schema definitions for each tool

## Phases

### Phase 1 — MCP scaffold + git tools (Day 1, ~3h)
- TypeScript MCP server using `@modelcontextprotocol/sdk`
- Implement `git_status` (staged/unstaged/untracked arrays), `git_diff` (file diffs as structured objects), `git_log` (commits as `{hash, author, date, message}[]`)
- Test in Claude Code with a real git repo

### Phase 2 — npm + docker tools (Day 1, ~2h)
- `npm_list` (dependency tree as JSON), `npm_audit` (vulnerabilities as structured list)
- `docker_ps` (containers as `{id, name, status, ports}[]`), `docker_logs` (recent log lines as `{timestamp, level, message}[]`)

### Phase 3 — GitHub CLI tools (Day 2, ~2h)
- `gh_pr_list` (PRs as `{number, title, author, status, ci_status}[]`)
- `gh_issue_list`, `gh_pr_diff` (structured diff with file change objects)

### Phase 4 — Polish + schema docs (Day 2, ~1h)
- Generate JSON Schema files for each tool output
- Add error handling (CLI not found, non-zero exit codes)
- Publish as npm package or add to Pare via PR

## Effort estimate

| Phase | Hours |
|-------|-------|
| Scaffold + git tools | 3 |
| npm + docker tools | 2 |
| GitHub CLI tools | 2 |
| Polish + schema docs | 1 |
| **Total** | **~8h** |

## Blockers / risks

- CLI output parsing is fragile — test against multiple versions of each tool and handle format variations.
- Some CLIs (npm, docker) have `--json` flags that return structured output natively — use those where available.
- MCP server as a local process in Claude Code requires the `mcpServers` config in `settings.json` and a working Node.js environment.
- Pare's 240-wrapper scope means the upstream project may already cover your needs — check its exact tool list before building from scratch.

## Reference

- Open Source Radar Oct 28: https://github.com/sourav-ojha/open-source-radar/issues/66
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- FastMCP (Python): https://github.com/jlowin/fastmcp
- Claude Code MCP config: https://docs.anthropic.com/en/docs/claude-code/mcp
