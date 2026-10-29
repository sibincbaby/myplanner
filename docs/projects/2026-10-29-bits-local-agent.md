# Bits — Local-First Open-Source Personal AI Agent

**Source:** Product Hunt (launched ~Oct 22, 2026)  
**Product Hunt:** https://www.producthunt.com/products/bits-4  
**Discovered:** 2026-10-29  
**Viability:** 3/4 (WB ❌ · FG ✅ · N ✅ · DU ✅)

## What it is

Bits is a local-first, open-source personal AI agent that runs as a background service on macOS (with Windows and Linux on the roadmap). Unlike cloud-first agents, Bits keeps all data on-device and supports local LLM models. Its standout design feature is the **Sentinel** reviewer: a second agent that gates any risky action (sending email, modifying files, running shell commands) and must approve before Bits proceeds. This prevents runaway agent actions while still supporting a broad range of automation tasks.

Key details:
- Local-first: all data on-device, no mandatory cloud
- Supports local LLMs (Ollama-compatible) and cloud providers
- **Sentinel** safety reviewer for risky actions (email, file modification, shell)
- Open source, macOS-first, background service architecture

## Why it scores

- **Weekend-buildable:** ❌ Building a full local-first personal agent with a safety reviewer from scratch is not a 1-2 session project — the architecture is complex (background service, LLM routing, Sentinel approval flow). Score reflects "adopt and extend" rather than "build from scratch."
- **Fills gap:** No current local-first personal agent in the user's toolkit combines open-source, local LLMs, and a safety-gated Sentinel reviewer. Cloud agents (Claude, ChatGPT) don't run locally; local agents (jan, Msty) are chat interfaces, not task executors.
- **Novel:** The Sentinel reviewer pattern — a second agent that inspects and approves risky actions before execution — is a meaningful safety primitive not found in other open-source personal agents.
- **Daily utility:** A personal agent that handles daily tasks (email triage, file management, reminders, research) while blocking unsafe actions is a genuine daily-use tool.

## Build angle

Rather than rebuilding Bits, the best angle is to **contribute a Sentinel reviewer to an existing agent setup** or build the Sentinel pattern as a standalone Claude Code hook:

1. A `PreToolUse` hook in Claude Code that intercepts file-write, shell, and git-push tool calls.
2. The hook presents a summary of the proposed action and prompts a local LLM (via Ollama) to rate risk: safe / review / block.
3. For "review" actions, the hook pauses and asks the user for approval via terminal or desktop notification.
4. For "block" actions, the hook returns a structured error with a reason.

This extracts Bits' key innovation (the Sentinel) as a reusable Claude Code safety layer.

## MVP Scope (weekend build — Sentinel hook only)

- [ ] `PreToolUse` hook: intercepts `Bash`, `Write`, `Edit` tool calls
- [ ] Risk classifier: sends action summary to local Ollama model (`llama3.2` or similar), returns `{risk: safe|review|block, reason}`
- [ ] "Review" flow: terminal prompt asking user to approve/deny with reason
- [ ] "Block" flow: returns hook error with Sentinel's reason
- [ ] Config file: list of always-safe patterns (read-only commands) and always-block patterns (rm -rf, etc.)

## Phases

### Phase 1 — Hook scaffold + interceptor (Day 1, ~2h)
- Python `PreToolUse` hook script
- Capture `tool_name`, `tool_input`, `cwd` from hook environment
- Classify tool as "monitored" vs. "safe" based on tool name and input pattern

### Phase 2 — Ollama risk classifier (Day 1, ~3h)
- Call local Ollama API with a structured prompt: "Rate the risk of this action: {action_summary}"
- Parse JSON response `{risk, reason}`
- Fallback: if Ollama unavailable, default to "review" for all monitored tools

### Phase 3 — Approval flow (Day 2, ~2h)
- For "review" actions: print summary + risk reason, prompt `[A]pprove / [D]eny / [E]xplain`
- For "block" actions: return error immediately
- Log all decisions to `~/.claude/sentinel_log.jsonl`

### Phase 4 — Config + README (Day 2, ~1h)
- `~/.claude/sentinel.yaml`: safe_patterns, block_patterns, monitored_tools
- README with setup instructions and example config
- Test with a real Claude Code session

## Effort estimate

| Phase | Hours |
|-------|-------|
| Hook scaffold + interceptor | 2 |
| Ollama risk classifier | 3 |
| Approval flow | 2 |
| Config + README | 1 |
| **Total** | **~8h** |

## Blockers / risks

- `PreToolUse` hook must complete quickly or Claude Code will time out waiting — Ollama inference latency (~1-3s) may be acceptable but should be measured.
- The hook receives tool input as JSON; parsing `Bash` command strings to assess risk requires careful handling of shell escapes and piped commands.
- Ollama must be running locally; the hook should degrade gracefully (default to "review") if Ollama is unavailable or slow.
- Users may find the approval prompts disruptive for routine operations — the config allowlist is critical for usability.

## Reference

- Bits on Product Hunt: https://www.producthunt.com/products/bits-4
- Claude Code PreToolUse hook: https://docs.anthropic.com/en/docs/claude-code/hooks
- Ollama API: https://github.com/ollama/ollama/blob/main/docs/api.md
- llama3.2 model (Ollama): https://ollama.com/library/llama3.2
