# nova-verify — PASS / FAIL / UNVERIFIED Hook Bundle for Claude Code

**Inspired by:** [NOVA CLI v1.0](https://chatgate.ai/post/nova-cli-v1-0) (Bridgeye, commercial, launched Product Hunt Oct 8–9 2026)  
**Shape:** build from scratch as an open-source Claude Code hook bundle  
**Discovered:** 2026-10-24 (cloud backup)

---

## Why it fits

NOVA CLI's core insight is simple and overlooked: an AI coding tool that doesn't run the project's tests after every change can't honestly say it's done. NOVA CLI makes this explicit with a mandatory verdict — **PASS**, **FAIL**, or **UNVERIFIED** — appended to every task result. PASS = tests ran and passed. FAIL = tests ran and failed (auto-repair loop starts). UNVERIFIED = no test command was found or the run timed out.

Claude Code's built-in hooks already expose the `PostToolUse` and stop events needed to implement exactly this. The commercial product is locked behind Bridgeye's credit system and has no public repo. The concept is entirely implementable as a local hook bundle.

No prior art in seen.json runs tests automatically after every file-changing task and hands the verdict back to the agent. The closest entries (`truth-firewall`, Oct 8 — "verify the agent's DONE independently") are post-hoc checks, not inline verdict reporters.

The user's workflow is Claude Code in bypass/auto mode. In that mode, Claude writes files, doesn't always run tests, and can report success before the test suite has spoken. A hook that stops the turn, runs `npm test` / `pytest` / `flutter test`, and injects the result gives the agent immediate feedback and surfaces regressions before they accumulate.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| Weekend-buildable | ✅ | Two Claude Code hooks (PostToolUse + stop), a test-runner script, and a config — fits in one session. |
| Fills gap | ✅ | Auto mode writes code without always verifying; UNVERIFIED is the default today. |
| Novel | ✅ | PASS/FAIL/UNVERIFIED three-state verdict not in seen.json; inline stop-hook verdict distinct from post-hoc review tools. |
| Daily utility | ✅ | Fires on every file-changing task — daily use from the first install. |

**Total: 4/4**

## Stack

- Claude Code hooks API (`PostToolUse`, stop hook)
- Bash script for test-runner dispatch (detects project type by file presence)
- `.claude/settings.json` hook registration
- Optional: a status line mod showing the last verdict

## How the hooks wire up

NOVA CLI's loop in Claude Code terms:

```
[Claude edits files]
   → PostToolUse hook fires after the Write/Edit tool
   → If task_type == "file-changing": queue a test run
[Claude's turn ends (stop hook)]
   → run-tests.sh fires
   → read exit code + output
   → inject verdict into next turn's context (via hook output / a tempfile the agent reads)
```

The key is the **stop hook** (`hookEvent: "Stop"` in settings.json), which fires after Claude's final message. It runs the test suite and writes the verdict to a temp file. A `PreToolUse` hook on the next turn injects that verdict as a system note.

## MVP scope

1. A `run-tests.sh` script that:
   - Detects project type (`package.json` → `npm test`; `pytest.ini`/`pyproject.toml` → `pytest -x`; `pubspec.yaml` → `flutter test`; `Cargo.toml` → `cargo test`; `go.mod` → `go test ./...`).
   - Returns exit 0 (PASS), exit 1 (FAIL with trimmed output), or exit 2 (UNVERIFIED — no recognized test command found or run > 60 s).
   - Writes `{ "verdict": "PASS|FAIL|UNVERIFIED", "summary": "…" }` to `~/.nova-verify/last.json`.

2. A stop hook that calls `run-tests.sh` and writes the verdict.

3. A `PreToolUse` hook that reads `last.json` and prepends the verdict to the tool input context (via the hook's `stdout` field), so Claude sees it at the start of its next turn.

4. An install script (`nova-verify install`) that writes the three hook entries to `.claude/settings.json` using `jq`.

## Phases

1. **`run-tests.sh` (1 h).** Write the project-type detector. Add a fixture test: a temp dir with a `package.json` containing `"scripts": { "test": "echo ok && exit 0" }` should produce `{"verdict":"PASS"}`. A dir with no recognized file should produce `{"verdict":"UNVERIFIED"}`.

2. **Stop hook (0.5 h).** Register the stop hook in `.claude/settings.json`. Verify it fires after a session ends by writing a canary timestamp to `last.json`. Check that the file updates after every session.

3. **PreToolUse injection (0.5 h).** Write the PreToolUse hook that reads `last.json` and, if the verdict is FAIL or UNVERIFIED, prepends a one-line note. Format: `[nova-verify] FAIL — 2 tests failed: "expected 3 but got 2" (src/calc.test.ts:14)`. If PASS, inject nothing (don't pollute context with green noise).

4. **Auto-repair loop (1 h).** If the stop hook sees FAIL, write a follow-up prompt to a queue file (`~/.nova-verify/repair-queue.json`). The PreToolUse hook on the next turn injects the failing test output as a task prompt addendum. Claude then addresses it before doing new work. This mirrors NOVA CLI's "re-check loop."

5. **(Later) Status line mod.** A Claude Code status line segment showing the last verdict in colour. Uses the `plugin-authoring` skill. Reads `~/.nova-verify/last.json`. Adds a `[✓ PASS]`, `[✗ FAIL]`, or `[? UNVERIFIED]` chip.

## Effort

~3 h for Phases 1–3 (usable in one session); Phase 4 adds ~1 h. Phase 5 is a 30-min mod.

## Blockers / risks

- **Stop hook timing:** The stop hook fires after Claude's final output, before the session restarts. If the test suite takes > 60 s, the next turn may start before the verdict is ready. Set a hard `VERIFY_TIMEOUT=60` in the script and return UNVERIFIED on timeout; the agent can re-run manually.
- **Flutter test on CI:** `flutter test` requires a connected device or a headless runner. Use `flutter test --no-pub` for unit tests only; skip widget tests unless `DISPLAY` is set.
- **Multi-project repos:** This box has 25+ projects under `~/my-works`. The detector should resolve from the repo root of the changed file, not always CWD. Read the `cwd` from the hook's `tool_input` context.
- **Commercial NOVA CLI:** If Bridgeye open-sources NOVA CLI, prefer upstream. Until then, this local build covers the core verdict loop without the credit system or 160-model gateway.
