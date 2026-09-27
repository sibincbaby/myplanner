# jev-pilot — Per-Prompt Effort, Model, and Skill Routing for Claude Code

**Source:** <https://github.com/Akramovic1/jev-pilot>
**Discovered:** 2026-09-27
**Viability:** 4/4

> Every Claude Code turn runs at the same reasoning effort and uses the same model — whether the prompt is "rename this variable" or "design a distributed caching layer". That mismatch costs money on the cheap tasks and loses quality on the expensive ones. jev-pilot fires a lightweight Jev decision call before each turn to set the right effort level, the right subagent model, and a skill suggestion. The 13% cost reduction figure is independently measurable.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

**Weekend-buildable (1):** A Claude Code plugin is a directory with a `CLAUDE.md` skill file and optionally some slash commands or hooks. The decision call is a single API call to the Jev endpoint. An MVP — one pre-turn hook, five effort levels, three model tiers, a decision log — is 200 lines of TypeScript.

**Fills a gap (1):** Token spend on Claude Code sessions is not uniform: a code search or a docstring edit is 20× cheaper to run at `haiku/low` than at `sonnet/max`. The upstream project measures 13% cost reduction across eight tasks; the real gain on a session dominated by cheap tasks is much higher. `/skill-doctor` (now first-party) reports context costs but does not route tasks — it is a complementary diagnostic, not a substitute.

**Novel (1):** Prior-art searches (`claude code prompt router`, `claude code reasoning effort per task`, `llm effort routing plugin`) returned nothing in this lane. The Jev decision model is TypeSafe's product; its application inside Claude Code as a per-turn pre-hook is the original work.

**Daily utility (1):** The routing runs silently on every turn. There is nothing to invoke: effort and model are set before the turn starts, and the decision ledger accumulates in the background.

---

## Implementation Plan

### Overview

jev-pilot works as a Claude Code plugin with two moving parts:

1. A **pre-turn hook** (`PreToolUse` or a `UserPromptSubmit` hook) that fires on every turn, sends the prompt to the Jev API, and writes the decision (effort level, subagent model, skill suggestion) back to the session context.
2. A **decision ledger** (`state/jev-ledger.jsonl`) that records every turn's decision, outcome, and token count. The `/jev-pilot:report` command reads the ledger and prints tuning suggestions.

The upstream plugin installs from the marketplace. A from-scratch build skips the animated pet UI and multi-model OpenRouter routing (Phase 4), but ships the core routing loop in a single session.

### Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (Node ≥22) | Claude Code plugin conventions; upstream is TS |
| Jev API | TypeSafe Jev via `@typesafe/jev` SDK | the decision model; requires an OpenRouter key or a TypeSafe account |
| Hook type | `UserPromptSubmit` hook | fires before the main turn; can inject `effort` and `model` into the session |
| Ledger | `state/jev-ledger.jsonl` | append-only; survives crashes; one JSON object per line |
| Report | `/jev-pilot:report` slash command | reads ledger, prints per-effort-tier token averages and raise counts |
| Config | `~/.claude/plugins/jev-pilot/config.json` | API key, default effort ceiling (`xhigh`), subagent model map |

### MVP Scope

**In:**

1. `hooks/user-prompt-submit.ts`: on every turn, POST the prompt text (first 400 chars) to the Jev API, get back `{ effort, model, skill }`, write them to a session-scoped JSON temp file that the harness reads as `effort` and `subagentModel` for this turn.
2. `state/jev-ledger.jsonl`: one record per turn — `{ ts, prompt_preview, effort_set, effort_raised, model_set, tokens_in, tokens_out, tool_call_count }`. Populated by a `PostToolUse`/stop hook.
3. `/jev-pilot:report` slash command: reads the ledger, groups by effort tier, prints median tokens, raise rate, and (after ≥20 turns) one tuning suggestion.
4. `setup.ts`: interactive credential setup; writes config; verifies Jev endpoint reachability.

**Out of v1:** animated pet UI, OpenRouter custom model routing (use the three built-in tiers), mid-turn effort escalation on tool failures (Phase 3), skill suggestion injection (Phase 2).

### Phases

**Phase 1 — Decision call + effort injection (2 h).** `user-prompt-submit.ts` fires, calls Jev, and sets `effort` on the turn. Verify by running three prompts ("rename this var", "design a cache layer", "write tests for X") and confirming the effort levels differ.

**Phase 2 — Skill suggestion (1 h).** Jev's response includes a `skill` field. If it is non-null and the named skill is installed, prepend a one-line suggestion to the turn context ("Jev suggests `/skill-name`"). Does not force-invoke; the user decides.

**Phase 3 — Mid-turn escalation (1.5 h).** A `PostToolUse` hook fires after each tool call. If `failure_count >= 2`, read the current effort level from the session and raise it by one tier. Write the raise to the ledger. This mirrors the upstream's "after failed tool calls in a row, effort goes up at least one level" behaviour.

**Phase 4 — Subagent model routing (1 h).** The `subagentModel` session var sets the model used for Agent tool calls. Map Jev's model recommendation (`cheap`, `balanced`, `expensive`) to actual model IDs via the config file. Verify by running a task that spawns a subagent and checking which model it used.

**Phase 5 — Ledger report and tuning loop (1 h).** Build the `/jev-pilot:report` command. After the first 20 turns, the report should print at least one concrete suggestion (e.g. "cheap tasks keep raising to medium — try setting `defaultEffort: medium`").

**Total effort:** 6–7 hours, comfortably one long session. Phase 1 alone (2 h) gives the core routing loop and is already independently valuable.

### Blockers and Known Ceilings

- **Jev API key and billing.** The Jev decision model is a TypeSafe product; it requires an API key and charges per decision call. At one call per Claude Code turn, a heavy session (200 turns/day) costs a few cents — cheaper than the tokens it saves — but it is an additional dependency. Phase 1 should include a `--dry-run` mode that skips the API call and always returns `effort: medium, model: sonnet` so the plugin can be tested without a key.
- **`UserPromptSubmit` hook timing.** The hook fires synchronously before the turn. If the Jev API call takes >500 ms (cold start, slow network), the user will notice a pause before every response. The hook should time out after 1 s and fall back to the configured default effort rather than blocking.
- **Effort injection API stability.** Setting `effort` on a session from a hook is documented in the Claude Code harness but the exact mechanism (env var injection, session context mutation, or a harness-specific hook return field) may change across harness versions. Pin the harness version in `package.json` and add a compatibility note in the README.
- **The 13% figure is an aggregate.** Over sessions dominated by complex tasks the saving is smaller; over sessions of mostly cheap tasks it is larger. Users should run their own baseline before tuning config values.
