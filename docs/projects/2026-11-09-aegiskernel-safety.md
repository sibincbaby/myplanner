# AegisKernel — Deterministic Tool-Call Safety Gateway

**Source:** [Show HN: AegisKernel – Zero-trust POSIX runtime for AI agents](https://zeli.app/story/50394991) (Hacker News Nov 8–9, 2026; PyPI: `aegis-kernel`, built by a 16-year-old solo developer, 13 HN points)
**Score:** 3/4 (WB 1 · FG 1 · N 1 · DU 0)
**Shape:** build-your-own. AegisKernel's core insight (deterministic capability checks before every tool call) is sound and the PyPI package exists, but the GitHub repo wasn't confirmed. Build your own YAML-configured tool-call interception layer for Claude Code and LangChain in a weekend.

## Why this one

Probabilistic LLM guardrails (system prompt instructions like "never delete files") can be bypassed by prompt injection, adversarial tool descriptions, or just model uncertainty. AegisKernel's approach is different: **check tool calls against an allowlist before they execute**, deterministically, at <1ms latency. This makes agent safety enforcement mechanical rather than probabilistic.

The HN post and an independent news article both describe the same mechanism: a capability manifest in YAML specifies which tools an agent may call with which argument patterns. Every tool call is checked against the manifest; if it doesn't match, the call is rejected before it reaches the actual tool.

**Why FG=1:** Agent safety is an unsolved daily problem. The options today are: trust the system prompt (probabilistic), sandbox the agent in a Docker container (heavy), or use `--allowedTools` in Claude Code (blunt; can't do argument-level filtering). A per-project YAML capability manifest with argument-pattern enforcement is a missing middle layer.

**Why N=1:** `--allowedTools` and permission prompts exist but can't do argument-level checks (e.g., "allow `Bash` only for `git` commands, not `rm`"). The deterministic capability manifest at the tool-call level is a novel approach. `mitkox/aegis` exists on GitHub but is a different project (a package broker).

**Why WB=1:** The core logic is an interceptor function that checks a tool call against a YAML manifest. That's one file, testable in isolation, and implementable in an afternoon. The PyPI package already exists as a reference.

**Why DU=0:** You set up the manifest once per project, not daily. It's infrastructure that runs in the background; you notice it only when it blocks something unexpected.

## Stack recommendation

- **Python 3.11+** — integrates with LangChain and the Anthropic SDK tool-calling loop
- **YAML** (via PyYAML) — the capability manifest format
- **`re` module** — argument-pattern matching (regex against tool input JSON)
- **FastAPI** (optional) — if you want to expose the gateway as a sidecar HTTP proxy
- **MCP SDK** (TypeScript, optional) — to wrap the gateway as an MCP server usable from Claude Code

## MVP scope

A Python class `CapabilityGateway` that:
1. Loads a YAML manifest from `~/.claude/capabilities.yaml`
2. Provides a `check(tool_name, tool_input) → bool` method that returns `True` if the call is allowed
3. Wraps a LangChain `BaseTool` or Anthropic tool call loop, calling `check` before `tool.run()`
4. On rejection, returns a structured error message: `"Blocked by capability manifest: {tool_name} with input {excerpt} does not match allowed patterns"`
5. Logs every check (tool name, matched/rejected, latency) to a local file

Example `capabilities.yaml`:
```yaml
version: 1
default_policy: deny
agents:
  claude-code:
    tools:
      Bash:
        allowed_patterns:
          - "^git "
          - "^npm "
          - "^python "
        deny_patterns:
          - "rm -rf"
          - "sudo"
      Read:
        allow_all: true
      Write:
        allowed_paths:
          - "src/**"
          - "tests/**"
        deny_paths:
          - ".env*"
          - "**/*.key"
```

Out of scope (MVP): POSIX runtime isolation, <1ms latency benchmarking, multi-agent manifests, GUI for editing the manifest.

## Phases

1. **Core gateway class (1 session).** Build `CapabilityGateway` with `load_manifest()` and `check()`. Write 20 unit tests covering allow/deny cases, regex matching, path wildcards, and the default deny policy. Test against real Claude Code tool calls captured from a previous session log.
2. **LangChain integration (30 min).** Wrap `BaseTool.__call__` to call `check()` first. Test with a LangChain agent that tries to `rm -rf` something.
3. **Anthropic SDK integration (1 session).** Intercept the tool_calls list in the Anthropic API response before dispatching. Write a minimal test harness that runs a Claude Haiku 5.5 agent and checks that blocked calls return structured errors rather than executing.
4. **MCP server wrapper (1 session, optional).** Expose the gateway as an MCP server: a `check_capability(tool_name, tool_input)` tool and a `list_capabilities()` tool. Configure Claude Code to query it before tool calls via a CLAUDE.md hook.
5. **Audit log and dashboard (30 min, optional).** Write a `GET /audit` FastAPI endpoint showing the last 100 checks with tool name, matched rule, and timestamp. Useful for understanding what an agent actually tries to do.

## Effort

Phases 1–2: 1 session. Phase 3: 1 session. Phases 4–5: 1 more session.

## Blockers / risks

- **Tool input parsing:** tool inputs are JSON blobs with varying shapes. Regex on the full serialized JSON works but can produce false negatives. Mitigate by normalizing the input (e.g., flatten nested commands) before matching.
- **LangChain API changes:** LangChain updates frequently; the interception point may move between versions. Pin to a specific LangChain version for the initial build.
- **False positives:** overly strict manifests block legitimate tool calls. Start with a permissive manifest and add deny rules only after observing what calls the agent actually makes in a real session.
- **Performance:** the gateway adds one Python function call per tool invocation. At <1ms per check (pure in-process), this is negligible. Don't add a network hop (e.g., HTTP sidecar) in the MVP.
