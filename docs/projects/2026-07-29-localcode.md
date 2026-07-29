# LocalCode

> A personal terminal coding agent that uses Ollama or any Claude/OpenAI-compatible endpoint, keeps your code on your machine, and costs nothing when you want to experiment without burning Anthropic credits

**Inspired by:** [Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder) (GitHub trending July 29 2026)  
**Date discovered:** 2026-07-29

---

## What gap it fills

The user has Claude Code for serious work, but every side experiment — trying a prompt, exploring a new file, testing a tool — burns API tokens. There is no free-to-run alternative in the current toolkit for low-stakes exploration with local models.

Nanocoder proves the category is real (community-driven, MIT, 800 stars) but is a full product with a governance model, multiple contributors, and stability requirements. LocalCode is a personal, stripped-down implementation: a single TypeScript CLI that wires a local Ollama model (or any OpenAI-compatible API including Anthropic) to a minimal agentic loop with file read/write and shell execution. It's faster to set up than Nanocoder, easier to customize (it's your own code), and teaches you exactly how a coding agent's tool loop works — valuable for building agents yourself.

Concrete daily value: spin up a LocalCode session against `deepseek-coder-v2` or `qwen2.5-coder` for throwaway exploration; switch to Claude when the task gets serious. Zero API cost for the first N passes.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js 22 + TypeScript | Same stack as Claude Code and Nanocoder; fast iteration |
| TUI | `ink` v5 | React-based terminal UI, same as Nanocoder |
| LLM client | `openai` SDK | Works with Ollama (OpenAI-compatible), Anthropic via `baseURL` override, OpenRouter |
| MCP | `@modelcontextprotocol/sdk` | Optional: attach external MCP servers for filesystem/GitHub tools |
| Config | `~/.localcode/config.json` | Provider, model, system prompt, tool permissions |
| Tools (built-in) | file_read, file_write, shell_exec, list_files | Core 4; MCP extends this |

## MVP scope (1 Claude session)

A working terminal coding agent with 4 built-in tools:

1. `file_read(path)` — read a file and return its content
2. `file_write(path, content)` — write or overwrite a file, show diff, ask for approval
3. `shell_exec(command)` — run a shell command in the working directory, return stdout/stderr
4. `list_files(path, pattern)` — list files matching a glob

Agent loop: system prompt → user message → LLM call → parse tool calls → execute → add tool results → loop until no tool calls → display assistant response.

Out of scope for MVP: MCP server integration, branching conversations, session persistence, multi-file context window management.

## Phases

### Phase 1 — Core agent loop (2 h)
- Config loader: `~/.localcode/config.json` with `provider`, `model`, `baseURL`, `apiKey`
- LLM client wrapper: single `chat()` function over the `openai` SDK, supports streaming
- Tool schema: define 4 built-in tools as JSON Schema for the LLM
- Agent loop: `while (hasToolCalls) { callLLM → parseToolCalls → executeTools → appendResults }`
- Test with Ollama: `ollama pull qwen2.5-coder:7b` → `localcode "write a fizzbuzz in Go"`

### Phase 2 — Ink TUI (1.5 h)
- Replace plain console output with an `ink` app
- Components: `<Header>` (model name, token count), `<Message>` (user/assistant/tool), `<ToolExecution>` (name + spinner + result), `<Input>` (user prompt)
- Approval prompt for `file_write` and `shell_exec`: show diff/command, `y/n/edit` before execution
- Stream LLM output character-by-character to the TUI

### Phase 3 — Workspace context (1 h)
- On startup: read `CLAUDE.md` or `README.md` from working directory if it exists; prepend to system prompt
- `list_files` with recursive glob up to 3 levels; file sizes shown; binary files excluded
- Auto-include files user references: if the user says "fix auth.ts", file_read it automatically if under 4k tokens
- Token budget display in header: warn when approaching model context limit

### Phase 4 — Provider switching + persistence (1 h)
- `localcode --provider anthropic --model claude-sonnet-5` to override config for one session
- `localcode --provider ollama --model deepseek-coder-v2:16b` for local session
- Session log: append each session to `~/.localcode/sessions/YYYY-MM-DD-HH.jsonl` (messages + tool calls + metadata)
- `localcode sessions` command: list past sessions with date, model, first user message

### Phase 5 — MCP server attachment (1 h)
- Config key `mcpServers`: array of `{name, command, args}` matching Claude Code's format
- On startup: spawn each MCP server as subprocess, discover tools via `tools/list`
- Merge MCP tools into the tool schema alongside built-ins
- MCP tool calls route to the correct subprocess via stdio JSON-RPC

## Effort estimate

~6.5 hours all phases · 1–2 Claude sessions  
Phase 1–2 alone deliver a working agent in ~3.5 hours — Phases 3–5 are the daily-driver improvements

## Blockers / risks

- **Overlap with existing projects:** The vault has VoiceCode, EchoCode, and CodeSherpa, each covering aspects of this space. LocalCode differentiates by: (a) local model first (Ollama), (b) no voice requirement, (c) explicit Nanocoder-class tool loop implementation. Read those plans before Phase 1 to avoid reinventing solved patterns.
- **Token budget management:** Local models (7B, 14B) have small context windows (8k–32k). Need a smart truncation strategy for the message history. Implement sliding window: keep system prompt + last N turns + current turn, evicting oldest tool call/result pairs first.
- **shell_exec safety:** Without a sandbox, `shell_exec` can delete files. Add a `denylist` config key (e.g. `["rm -rf", "DROP TABLE", "git push --force"]`) that blocks matching commands before execution. Always require explicit `y` approval for shell commands.
- **Nanocoder as reference:** Nanocoder's source is MIT — reading it is fine, but write LocalCode from scratch for learning value. The gap is a personal, forkable reference implementation, not a feature-complete clone.
