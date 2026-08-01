# EcoFilter

> A Claude Code hook that intercepts verbose bash output before it reaches the context window and compresses it losslessly-enough — stripping duplicate progress lines, collapsing npm/pip install noise, and summarizing long test logs — targeting the –80% bash token reduction demonstrated by ClawCodex's `/eco` mode.

**Inspired by:** [agentforce314/clawcodex](https://github.com/agentforce314/clawcodex)  
**Date discovered:** 2026-08-01

---

## What gap it fills

ClawCodex's v1.3.0 (July 29 2026) reports –80% bash output token savings in `/eco` mode. Claude Code has no equivalent: every `npm install`, `cargo build`, or `pytest -v` dumps its full raw output into the context window. A 2MB pip install log costs thousands of tokens of context and adds no signal the agent doesn't already have. ClawCodex is a full 270K-LoC rebuild — far beyond a weekend. But the compression idea itself is a hook: intercept `PostToolUse` for bash calls, compress the output, inject the compressed version back. That's a two-file Claude Code hook.

Viability score: **4/4** (weekend_buildable ✅, fills_gap ✅, novel ✅, daily_utility ✅)

---

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Hook type | `PostToolUse` (Claude Code hooks API) | Fires after bash tool returns, before output enters context |
| Runtime | Python 3.10+ stdlib only | No deps to install; hook must be fast |
| Compression | Regex + line-dedup + heuristic rules | Deterministic, zero latency, no model calls needed |
| Config | `~/.ecofilter.toml` | Per-pattern rules, per-command budgets |
| CLI | Single `ecofilter install` command | Writes the hook entry into `.claude/settings.json` |
| Metrics | Optional `~/.ecofilter/stats.jsonl` | Logs before/after token counts per session for reporting |

---

## MVP scope (1-2 Claude sessions)

**Session 1 — Core compressor + hook:**
- `compressor.py`: takes raw bash output string, applies rules in order:
  1. **Progress-line collapse**: detect lines like `[=====>   ] 47%` and keep only the last one
  2. **Duplicate-line dedup**: collapse N consecutive identical lines to `(line) × N`
  3. **npm/pip install noise**: detect patterns like `added 847 packages`, keep summary + any warnings/errors
  4. **Line budget**: if output exceeds `max_lines` (default 200), keep first 30 + last 50 + `... (N lines omitted) ...` middle
  5. **Error preservation**: never compress lines containing `error`, `warning`, `fail`, `exception`, `traceback`
- `hook.py`: reads hook stdin JSON (`{"tool": "bash", "output": "..."}`) → calls `compressor.py` → writes compressed JSON to stdout
- `ecofilter install`: appends to `.claude/settings.json` PostToolUse hook entry; prints before/after token count for a sample log
- Test: run `npm install` in a Claude Code session; confirm the 2000-line output becomes ~30 lines in the context

**Session 2 — Config + stats + smart rules:**
- `~/.ecofilter.toml`: per-command overrides (e.g., `[commands.pytest]` `max_lines = 100`; `[commands.cargo]` `keep_errors_only = false`)
- `ecofilter stats`: reads `~/.ecofilter/stats.jsonl`, prints per-session and cumulative token savings
- Smart rules: detect test runners (pytest, jest, cargo test) and apply test-specific compression: keep only failed test names + full tracebacks; collapse passing tests to `N tests passed`
- `ecofilter disable` / `ecofilter enable`: toggle without editing settings.json manually

---

## 3-Phase roadmap

### Phase 1 — Core hook + compressor (Session 1)
Regex compressor with 5 rules. PostToolUse hook. `ecofilter install` CLI. Test-runner error preservation. Demonstrated –60%+ compression on npm install output.

### Phase 2 — Config + stats (Session 2)
TOML per-command config. Token savings log. `ecofilter stats` report. `disable`/`enable` toggle.

### Phase 3 — Smart summaries (optional LLM pass)
Optional: if compressed output is still > 100 lines, offer a second-pass where a small model (local Llama/Gemini Flash via API) writes a one-paragraph prose summary of what happened, appended as a comment block. User explicitly opts in; Phase 1 and 2 are fully LLM-free.

---

## Effort estimate

| Phase | Effort | Output |
|-------|--------|--------|
| Phase 1 | 1 Claude session (~50 min) | Working hook; measurable token savings |
| Phase 2 | 1 Claude session (~60 min) | Full config + stats; production-ready |
| Phase 3 | 1 Claude session (~45 min) | Optional LLM summary pass |

Total: **3 sessions, ~2.5 hours elapsed**

---

## Blockers / watch-outs

- **Hook output format**: Claude Code's `PostToolUse` hook stdout replaces the tool output that enters the context. Confirm the exact JSON envelope in the hooks documentation; the field names matter.
- **Error preservation is non-negotiable**: Any compression that silently removes an error line makes Claude worse, not better. The error-preservation rule must run last and override all budget limits. Include test cases for this.
- **Idempotency**: `ecofilter install` should detect if the hook is already registered and not add a duplicate entry. Parse `.claude/settings.json` carefully; it may have existing hooks.
- **Hook latency**: The compressor must add < 50ms per bash call. Benchmark with a 10,000-line input; if Python startup time is an issue, use a long-running daemon mode that the hook script connects to via socket rather than spawning a new Python process per call.
- **Binary output**: Some bash commands produce binary or non-UTF-8 output. Wrap the compressor in a try/except and pass binary output through unchanged.

---

## Why now

ClawCodex's Terminal-Bench 2.1 result (80.9%) is enabled in part by token efficiency — the agent gets more clean signal in the same context window. Claude Code's context window is large but not infinite, and long-lived coding sessions accumulate noise fast. EcoFilter is the simplest possible implementation of the insight: a two-file Python hook that you can install and uninstall in 10 seconds, requiring no rebuild of Claude Code itself. The potential compounding value is large: every bash call saved is bandwidth for more tool turns, deeper reasoning, or a longer history window.
