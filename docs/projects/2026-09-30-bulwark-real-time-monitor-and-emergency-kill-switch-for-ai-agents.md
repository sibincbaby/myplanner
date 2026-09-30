# Bulwark – Real-Time Monitor and Emergency Kill Switch for AI Agents

**Source:** <https://pypi.org/project/bulwark-ai/>
**Discovered:** 2026-09-30
**Viability:** 3/4

> The user's Claude Code and agent harness projects (openclaw, claw-desk) all run autonomous commands. Bulwark installs as a Python dependency and wraps the execution loop — adds an observable, stoppable safety net without needing to fork the agent. Complements OpenRig and Paperclip setups directly.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

weekend_buildable: The core concept — action interception middleware, threshold config, alert hooks, and a kill switch — is well-scoped Python library work. A useful MVP (wrapping a callback chain around agent tool calls, configurable rule set, and a hard-stop mechanism) is achievable in one focused Claude Code session. Score 1.

fills_gap: The user actively builds agent UIs (openclaw, claw-desk, gravity-claw variants) and Claude/LLM tooling. A real-time safety layer that can halt a runaway agent is clearly missing from that profile — none of their described projects address agent guardrails or monitoring. Score 1.

novel: LangSmith and OpenTelemetry-based tracing tools exist, but they focus on post-hoc logging and observability. A lightweight library whose primary value proposition is pre-execution action interception with a hard kill switch occupies a meaningfully different niche — it's about control, not observability. Score 1.

daily_utility: This is safety infrastructure, not a daily-open tool. The user would wire it in once per agent project and it runs silently; they would not reach for it every day. It solves an occasional "agent went rogue" scenario rather than a constant friction point. Score 0.

Total: 3 — viable.

---

## Implementation Plan

## Overview

Bulwark is a Python library that wraps AI agent execution loops with pre-execution action interception, configurable rule evaluation, alert dispatch, and a hard kill switch. The core design is framework-agnostic middleware: agent actions pass through a pipeline of evaluators before they execute; any evaluator can fire an alert or raise a `BulwarkHalt` exception that terminates the agent. The library ships with adapters for Claude tool-call loops (the primary target given the user's profile) and a generic callback-based API for anything else.

---

## Stack Recommendation

- **Python 3.11+** — match the user's existing agent tooling
- **`pydantic` v2** — rule and config schema validation
- **`httpx`** — async webhook alert delivery
- **`structlog`** — structured audit log of every intercepted action
- **`pytest` + `pytest-asyncio`** — test suite
- **`hatchling`** — build backend (pyproject.toml)
- No external AI dependency in the library itself; adapters import optionally

---

## MVP Scope

A working `pip install bulwark-ai` that lets a user do:

```python
from bulwark import Bulwark, Rule, AlertChannel

bw = Bulwark(
    rules=[Rule.regex("tool_input", r"rm -rf", action="halt")],
    alerts=[AlertChannel.log()],
)

# wrap a Claude tool-call dispatch function
safe_dispatch = bw.wrap(my_dispatch_fn)
```

MVP includes: action interception via decorator/wrapper, regex and keyword rule types, log and webhook alert channels, `BulwarkHalt` hard stop, and a CLI command `bulwark audit <logfile>` to replay and inspect captured actions.

---

## Implementation Phases

### Phase 1: Project Scaffold and Core Data Model

**Goal:** A passing test suite confirms the package installs cleanly and the core `Action`, `RuleResult`, and `BulwarkHalt` types are importable and serializable.

**Files to create/modify:**
- `pyproject.toml` — package metadata, dependencies (`pydantic>=2`, `structlog`, `httpx`), entry points
- `bulwark/__init__.py` — public re-exports (`Bulwark`, `Rule`, `AlertChannel`, `BulwarkHalt`)
- `bulwark/models.py` — `Action`, `RuleResult`, `HaltDecision` pydantic models
- `bulwark/exceptions.py` — `BulwarkHalt(Exception)` carrying `action` and `rule` fields
- `tests/__init__.py` — empty
- `tests/test_models.py` — round-trip serialization tests for each model

**Key steps:**
1. Create `pyproject.toml` with `[project]` table: name `bulwark-ai`, version `0.1.0`, `requires-python = ">=3.11"`, dependencies list. Add `[project.scripts]` entry `bulwark = "bulwark.cli:main"`.
2. Define `Action` in `bulwark/models.py`: fields `id: str` (uuid4 default), `timestamp: datetime`, `tool_name: str`, `tool_input: dict[str, Any]`, `metadata: dict[str, Any]` (agent id, session, etc.).
3. Define `RuleResult`: fields `rule_id: str`, `matched: bool`, `action: Literal["allow", "alert", "halt"]`, `detail: str`.
4. Define `BulwarkHalt` in `bulwark/exceptions.py` with `action: Action` and `rule_result: RuleResult` on the instance.
5. Write three tests: instantiate `Action` with minimal fields, assert `model_dump()` round-trips, instantiate `BulwarkHalt` and assert `raise`/`except` cycle works.
6. Run `pip install -e ".[dev]"` (add `[project.optional-dependencies] dev = ["pytest","pytest-asyncio"]`).

**Verify:**
```bash
pip install -e ".[dev]" && pytest tests/test_models.py -v
```

---

### Phase 2: Rule Engine

**Goal:** A `RuleSet` evaluates an `Action` and returns a list of `RuleResult` objects, with regex, keyword, and rate-limit rule types all tested.

**Files to create/modify:**
- `bulwark/rules.py` — `Rule` base class, `RegexRule`, `KeywordRule`, `RateLimitRule`, `RuleSet`
- `tests/test_rules.py` — one test per rule type, plus `RuleSet` aggregation

**Key steps:**
1. Define abstract `Rule(ABC)` in `bulwark/rules.py` with `rule_id: str`, `target_field: str`, `action: Literal["allow","alert","halt"]`, and abstract method `evaluate(action: Action) -> RuleResult`.
2. Implement `RegexRule(Rule)`: compile pattern at init, `re.search` against `str(action.tool_input.get(self.target_field, ""))`, return `RuleResult(matched=bool(match), ...)`.
3. Implement `KeywordRule(Rule)`: accepts `keywords: list[str]`, case-insensitive substring scan of target field.
4. Implement `RateLimitRule(Rule)`: accepts `max_calls: int`, `window_seconds: int`; maintains an internal `deque` of timestamps; matched when deque length exceeds `max_calls` within window.
5. Implement `RuleSet` as a plain list wrapper with `evaluate_all(action) -> list[RuleResult]` and a `worst_action` property returning the most severe result (`halt > alert > allow`).
6. Add factory classmethod `Rule.from_dict(d)` that dispatches on `d["type"]` to the correct subclass — needed later for YAML/JSON config loading.
7. Write `tests/test_rules.py`: test regex match/no-match, keyword case insensitivity, rate limit triggering on 4th call within 1s, `RuleSet.worst_action`.

**Verify:**
```bash
pytest tests/test_rules.py -v
```

---

### Phase 3: Interceptor Core and Kill Switch

**Goal:** `Bulwark.wrap(fn)` returns a callable that, when called, intercepts the action, evaluates rules, fires alerts synchronously, and raises `BulwarkHalt` on a halt decision — verified by integration tests using a mock agent function.

**Files to create/modify:**
- `bulwark/alerts.py` — `AlertChannel` ABC, `LogAlertChannel`, `WebhookAlertChannel`, `CallbackAlertChannel`
- `bulwark/interceptor.py` — `Bulwark` class with `wrap`, `awrap` (async variant), and internal `_intercept` pipeline
- `bulwark/__init__.py` — add `Interceptor` alias, re-export `AlertChannel`
- `tests/test_interceptor.py` — sync and async wrap tests, halt raises, alert fires

**Key steps:**
1. In `bulwark/alerts.py`, define `AlertChannel(ABC)` with abstract `send(action: Action, result: RuleResult) -> None`. Add `LogAlertChannel` (uses `structlog.get_logger().warning`), `WebhookAlertChannel` (POST JSON via `httpx.post`, swallows connection errors with a log), and `CallbackAlertChannel(fn: Callable)`.
2. Add classmethods `AlertChannel.log()`, `AlertChannel.webhook(url)`, `AlertChannel.callback(fn)` for the ergonomic API.
3. In `bulwark/interceptor.py`, define `Bulwark(rules: list[Rule], alerts: list[AlertChannel], extract_action: Callable | None)`. The optional `extract_action` maps the wrapped function's args/kwargs to an `Action`; default implementation inspects the first argument if it looks like a dict with `tool_name`.
4. Implement `_intercept(action: Action)`: call `RuleSet(self.rules).evaluate_all(action)`, get `worst`, fire all alerts for any `matched=True` result, raise `BulwarkHalt` if `worst.action == "halt"`.
5. Implement `wrap(fn)`: `@functools.wraps(fn)` wrapper that builds an `Action` from args, calls `_intercept`, then calls `fn` if no halt.
6. Implement `awrap(fn)`: async version using `await asyncio.get_event_loop().run_in_executor(None, self._intercept, action)` then `await fn(...)`.
7. Write `tests/test_interceptor.py`: test that a halt rule prevents the wrapped function from being called (mock confirms `call_count == 0`), an alert rule calls the alert callback, and an allow rule passes through cleanly.

**Verify:**
```bash
pytest tests/test_interceptor.py -v
```

---

### Phase 4: Claude Tool-Call Adapter and Config Loading

**Goal:** A working `ClaudeAdapter` wraps Anthropic SDK `client.messages.create` calls, auto-extracting tool-use blocks as `Action` objects, plus YAML config file loading so rules can be declared without writing Python.

**Files to create/modify:**
- `bulwark/adapters/__init__.py` — empty
- `bulwark/adapters/claude.py` — `ClaudeAdapter` class
- `bulwark/config.py` — `load_config(path: str | Path) -> Bulwark` reads YAML
- `bulwark/cli.py` — `bulwark audit <logfile>` CLI command (uses `structlog` JSONL output)
- `tests/test_adapter.py` — adapter with mock anthropic response containing tool_use block
- `tests/test_config.py` — load a fixture YAML, assert rules parse correctly
- `tests/fixtures/sample_config.yaml` — example rule config

**Key steps:**
1. In `bulwark/adapters/claude.py`, define `ClaudeAdapter(bw: Bulwark)`. Implement `wrap_client(client)` that monkey-patches `client.messages.create` with a wrapper: after the response arrives, extract all `tool_use` content blocks, build one `Action` per block (`tool_name`, `input` dict), call `bw._intercept(action)` for each.
2. Also provide `wrap_dispatch(dispatch_fn)` for users who manage their own tool dispatch loop (matches the user's openclaw/claw-desk pattern): pre-execution intercept before the tool function is called.
3. In `bulwark/config.py`, define a `BulwarkConfig` pydantic model with `rules: list[dict]` and `alerts: list[dict]`. Implement `load_config(path)`: read YAML with `tomllib` fallback to `yaml.safe_load`, validate via `BulwarkConfig`, call `Rule.from_dict` on each rule entry, construct `Bulwark`.
4. Write `tests/fixtures/sample_config.yaml`:
   ```yaml
   rules:
     - type: regex
       rule_id: no-rm-rf
       target_field: command
       pattern: "rm\\s+-rf"
       action: halt
   alerts:
     - type: log
   ```
5. Write `bulwark/cli.py`: `argparse`-based CLI. `bulwark audit <logfile>` reads JSONL structlog output and prints a summary table (rule hits, halt events, action counts). `bulwark check --config bulwark.yaml --action '{"tool_name":"bash","tool_input":{"command":"ls"}}'` runs a single action through the rule set and prints the result.
6. Write tests for the adapter using a `MagicMock` anthropic response with a `tool_use` block, and config loading from the fixture YAML.

**Verify:**
```bash
pytest tests/test_adapter.py tests/test_config.py -v
echo '{"tool_name":"bash","tool_input":{"command":"rm -rf /"}}' | python -m bulwark.cli check --config tests/fixtures/sample_config.yaml --stdin
```

---

### Phase 5: Packaging, README, and PyPI Prep

**Goal:** `pip install bulwark-ai` from TestPyPI installs cleanly, the README shows a working 5-line quickstart, and `bulwark --help` works in a fresh virtualenv.

**Files to create/modify:**
- `README.md` — quickstart, rule types table, adapter docs, CLI reference
- `pyproject.toml` — finalize classifiers, `[project.urls]`, long description from README
- `CHANGELOG.md` — `0.1.0` entry
- `.github/workflows/publish.yml` — optional: build + twine upload to TestPyPI on tag push
- `Makefile` — `make test`, `make build`, `make publish-test` targets

**Key steps:**
1. Add to `pyproject.toml`: `[tool.hatch.build.targets.wheel] packages = ["bulwark"]`, `readme = "README.md"`, `license = {text = "MIT"}`, classifiers for `Development Status :: 3 - Alpha`, `Intended Audience :: Developers`, `Topic :: Scientific/Engineering :: Artificial Intelligence`.
2. Write `README.md` with install instruction, the 5-line quickstart snippet, a table of rule types (regex, keyword, rate_limit) with fields and example YAML, a section on the Claude adapter, and the CLI reference.
3. Write `Makefile` with targets: `test` calls `pytest -v`, `build` calls `python -m build`, `publish-test` calls `twine upload --repository testpypi dist/*`.
4. Run `python -m build` and inspect `dist/` for `.whl` and `.tar.gz`.
5. Create a temp virtualenv: `python -m venv /tmp/bw-test && /tmp/bw-test/bin/pip install dist/bulwark_ai-0.1.0-py3-none-any.whl && /tmp/bw-test/bin/bulwark --help`.

**Verify:**
```bash
make build && python -m venv /tmp/bw-test && /tmp/bw-test/bin/pip install dist/bulwark_ai-0.1.0-py3-none-any.whl && /tmp/bw-test/bin/bulwark --help
```

---

## Estimated Effort

**2 Claude Code sessions**

- **Session 1** (Phases 1–3): Scaffold, models, rule engine, interceptor core, and kill switch. All unit tests passing. The library is usable in pure Python by end of session.
- **Session 2** (Phases 4–5): Claude adapter, YAML config loading, CLI tool, packaging, README, TestPyPI upload. Library is distributable and documented.

---

## Potential Blockers

1. **Anthropic SDK response shape** — The `tool_use` block structure in `client.messages.create` responses is version-sensitive. The adapter must be written against the SDK version in the user's existing agent projects (`anthropic>=0.25` uses `ContentBlock` typed objects, not raw dicts). Run `pip show anthropic` in openclaw/claw-desk before writing the adapter to pin the exact model.

2. **Async intercept ordering** — If the wrapped async agent loop dispatches tool calls concurrently (e.g. `asyncio.gather` over multiple tool uses), `RateLimitRule`'s internal deque is not thread-safe. The MVP can document this as single-threaded only; fixing it requires an `asyncio.Lock` around deque mutation.

3. **`structlog` output format for CLI audit** — The `bulwark audit` command assumes JSONL structlog output. If the user configures structlog differently in a host project (e.g. console renderer), the JSONL parser will fail silently. Mitigation: the CLI should detect non-JSON lines and skip them with a warning count.

4. **PyPI name collision** — `bulwark-ai` may already be registered on PyPI (the project URL references it). Before Phase 5, check `pip index versions bulwark-ai`; if taken, the package name needs to change (e.g. `bulwark-guard` or a scoped name like `sibinc-bulwark`).

5. **`httpx` in sync context** — `WebhookAlertChannel.send` is called from a sync `_intercept` pipeline. If the agent is async, wrapping `httpx.post` in `asyncio.run` from inside an already-running event loop will raise `RuntimeError`. Use `httpx.Client` (sync) unconditionally in the alert channel, or provide an async `asend` variant and call it from `awrap`.
