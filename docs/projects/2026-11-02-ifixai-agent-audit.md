# iFixAi — AI audit tool: does your agent actually do what it claims?

**Source:** [ifixai-ai/iFixAi](https://github.com/ifixai-ai/iFixAi) (trending Nov 1–2, 2026; MIT)
**Score:** 3/4 (WB 1 · FG 1 · N 1 · DU 0)
**Shape:** build-first. The iFixAi concept — systematically testing whether an agent performs its intended function — is more valuable as a pattern you build into your own agent development loop than as an installed binary.

## Why this one

iFixAi is an AI audit tool that checks whether an agent performs its intended function. The core idea: after building an agent, run it against a structured test suite of known inputs, observe its outputs and tool calls, and verify them against a rubric.

This is different from:
- **LLM evals (RAGAS, LlamaIndex):** those measure retrieval quality or answer accuracy, not whether the agent as a whole does what it's supposed to do
- **Unit tests:** those check functions, not emergent agent behavior
- **Manual QA:** unscalable and subjective

**Why FG=1:** The current agent development workflow is: build it, run it a few times manually, ship it. There's no systematic "does this agent reliably perform its intended task?" check. iFixAi formalizes that check.

**Why N=1:** Dedicated agent-behavior auditing (not LLM evals, not unit tests) is not a well-covered space. The combination of structured test cases + tool-call trace verification + rubric-based scoring is a fresh framing.

**Why WB=1:** The core is a Python harness: run agent → capture tool trace + output → score against rubric. That's a single Claude session to build.

**Why DU=0:** Useful during agent development, not every day.

## Stack recommendation

- **Python 3.10+**
- **Anthropic SDK:** invoke the agent under test via the messages API
- **Trace capture:** intercept tool calls using a wrapper around the tool executor
- **Rubric evaluation:** a second Claude call that receives (expected behavior, actual tool trace, final output) and returns a pass/fail + explanation
- **Storage:** SQLite for test case library and audit results
- **Report:** Markdown or HTML table of test cases with pass/fail + trace

## MVP scope

Build a harness that:
1. Defines a test case: `{ input, expected_tool_calls: [...], expected_output_criteria }`
2. Runs the agent under test with the input
3. Captures all tool calls (name + args) in order
4. Runs a rubric-evaluation Claude call: "did the agent call the right tools? does the output meet the criteria?"
5. Prints a pass/fail table

Out of scope (MVP): parallel test execution, CI integration, web UI, non-Anthropic agents.

## Phases

1. **Test case schema (1h).** Define a YAML/JSON schema for test cases: input, expected tool names (ordered or unordered), output rubric string. Write 5 test cases for a real agent you already have.
2. **Agent runner + trace capture (1 session).** Wrap the agent invocation to capture tool calls. Use the `tool_runner` from the Anthropic SDK or a manual loop. Collect `[{tool_name, tool_input, tool_result}]` per run.
3. **Rubric evaluator (1 session).** Write a Claude call that receives the trace + rubric and returns `{passed: bool, score: int, explanation: str}`. Test on the 5 cases from phase 1.
4. **CLI harness (1 session).** `python audit.py --agent my_agent.py --cases test_cases/` runs all cases and prints a table. Add `--fail-fast` option.
5. **CI integration (optional, 1 session).** Add a GitHub Action that runs the audit on every PR touching the agent's code. Fail the check if fewer than N% of cases pass.

## Effort

Core harness: 1–2 sessions. CI integration: 1 more session.

## Blockers / risks

- **Rubric evaluation reliability:** Using an LLM to evaluate an LLM creates a judge-model dependency. The rubric evaluator can be wrong. Mitigate by writing very specific, binary rubrics ("did it call `search_web` before `read_file`?") rather than subjective ones.
- **Test case maintenance:** Agents evolve; test cases need updating. This is the same problem as unit test maintenance, but harder because agent behavior is less deterministic. Expect 20% of cases to need rewriting after each agent iteration.
- **Non-determinism:** Running the same test twice may give different tool traces. Add a `runs_per_case: 3` setting and aggregate pass rates rather than individual pass/fail.
- **Tool call ordering:** Some agents call tools in different orders but reach the right answer. The rubric should specify required tools (must appear) vs. ordered sequences (must appear in this order) separately.
