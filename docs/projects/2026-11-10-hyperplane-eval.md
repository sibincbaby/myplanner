# Hyperplane Eval — Property-Based Testing for AI Agents

**Source:** [hyperplane.dev/eval](https://hyperplane.dev/eval) (discovered via HN threads, June 2026)
**Score:** 3/4 (WB 1 · FG 1 · N 1 · DU 0)
**Shape:** build-the-local-version. Hyperplane Eval is a hosted tool for testing AI agents against user-defined properties. Build a lightweight local equivalent that integrates with Claude Code and runs in CI.

## Why this one

As agent-based workflows replace manual steps, testing becomes critical. A Claude Code agent that generates code, commits, and opens PRs needs testable invariants: "never commits secrets", "always runs tests before pushing", "produces valid JSON". Property-based testing — where you define invariants and auto-generate test cases — is the right model, but no lightweight open-source tool applies it to AI agents.

**Why FG=1:** The user runs several Claude agents (discovery, expense tracking, code review). None has automated regression tests. A single bad session could corrupt state/seen.json, push broken commits, or miss a critical discovery. A lightweight eval harness would catch these regressions.

**Why N=1:** Most agent testing tools are either hosted (LangSmith, Hyperplane), require LangChain, or test single LLM outputs rather than multi-step agent behavior. A pytest-compatible, local, harness-agnostic eval runner is genuinely new.

**Why WB=1:** The core is a Python test runner: define a property (a function that takes agent output and returns bool), generate test cases (via Claude or fixtures), run the agent, check the property. This is a focused 1-session build.

**Why DU=0:** This is a development-time tool, not a daily-use app. Run it in CI or before major deployments. Worth building, but not a daily touchpoint.

## Stack recommendation

- **Python + pytest** — property tests are pytest fixtures; `assert` on agent output
- **Claude claude-haiku-5-5** — generate diverse test inputs from a schema
- **`hypothesis`** (optional) — property-based test case generation for structured inputs
- **subprocess** — invoke Claude Code agents under test as subprocesses
- **SQLite** — store test run history and property violation records

## MVP scope

A pytest plugin that tests a Claude Code agent against user-defined properties:

1. **Property definition:** a decorator `@agent_property("never_commits_secrets")` that wraps a function `def check(agent_output: dict) -> bool`. Properties are collected by the pytest plugin.

2. **Test case generation:** call Claude claude-haiku-5-5 with a property description and ask it to generate 5 diverse inputs that *should* satisfy the property. Store inputs as fixtures.

3. **Agent runner:** invoke the agent (subprocess call to `claude --print`) with each input. Capture stdout/stderr and tool call logs.

4. **Property checker:** for each (input, output) pair, run the property function. Report violations as pytest failures with a diff of expected vs. actual behavior.

Out of scope (MVP): visual dashboard, CI integration, mutation testing, multi-agent scenarios.

## Phases

1. **Property DSL (1 session).** Define the `@agent_property` decorator and a `PropertyResult(passed, reason, actual_output)` return type. Write three properties for the daily discovery agent: `no_duplicate_urls_in_seen_json`, `viable_count_matches_project_files`, `commit_message_includes_date`. Verify that the decorator collects them correctly.

2. **Agent runner (1 session).** Write a subprocess wrapper that invokes `claude --print -p "<input>"` with a given prompt, captures the JSON output, and parses it. Handle timeouts (60s max). Write a fixture that runs the discovery agent with a mock web search.

3. **Test case generation (30 min).** For each property, call Claude claude-haiku-5-5 with the property docstring and ask for 5 diverse test prompts. Store as YAML fixtures. Add a `--generate` CLI flag to regenerate them.

4. **Pytest plugin (1 session).** Package phases 1–3 as a pytest plugin (`conftest.py` hooks + `pytest_collect_file`). `pytest evals/` runs all property tests. Each property × test case is one test node. Failures show the property name, the input, and the actual vs. expected output.

5. **CI integration (30 min, optional).** Add a GitHub Actions workflow that runs `pytest evals/` on every push to `master`. Gate merges on no property violations. Run with `--timeout=120` to avoid runaway agents in CI.

## Effort

Phases 1–2: 1.5 sessions. Full implementation: 3 sessions.

## Blockers / risks

- **Agent non-determinism:** Claude agents don't return the same output twice. Properties must tolerate variation (e.g., "the commit message contains the date" not "the commit message is exactly X"). Frame properties as invariants, not expected outputs.
- **Subprocess cost:** each test case invokes a Claude session, which costs API tokens. Limit the agent runner to 2K token budgets per test, and use claude-haiku-5-5 for test-time invocations.
- **Mock vs. live web search:** running the discovery agent in tests requires either live web search (non-deterministic) or a mock (may not cover real failure modes). Start with a mock that returns a fixed set of search results; add a `--live` flag for integration tests.
- **Interaction with CI token limits:** the discovery agent's daily run costs ~50K tokens. Running it in CI on every push is expensive. Gate the full eval suite on a manual trigger or a nightly schedule, not every push.
