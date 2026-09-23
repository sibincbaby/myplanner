# What's Next — End Every Claude Code Turn With a Pickable Next-Step Card

**Source:** <https://github.com/kvitapp/kvit-plugins>
**Discovered:** 2026-09-24
**Viability:** 3/4

> The closing paragraph of an agent turn is the one piece of output you always have to act on, and it is the one piece that arrives as prose you must read, decide about, and reply to by typing. The card widget to fix that is already first-party (`AskUserQuestion`); nothing until now made it the way a working turn *ends*.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 0/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

**Weekend-buildable (1):** the whole mechanism is a `Stop` hook that exits 2 with a reason, plus a convention string injected on `UserPromptSubmit`. One Python file, one settings block, no dependencies.

**Fills a gap (0):** this is the leg that fails, and it should. The option card is native — `AskUserQuestion` already draws labelled, keyboard-selectable options with free text always available. The plugin does not add a widget, it adds a *habit*. A single line in `CLAUDE.md` ("when a turn changed something, end it by calling `AskUserQuestion` with 2–4 next steps") buys most of the benefit with zero code, and the honest first move is to install the MIT upstream rather than build anything.

**Novel (1):** seven phrasings across two prior-art rounds (`claude code stop hook next steps`, `agent suggests next actions hook`, `claude code multiple choice reply`, `agent numbered options menu cli`, `interactive menu coding agent suggestions`, `claude code plugin choices`, `claude code turn summary plugin`) returned no OSS project that enforces the convention. The closest hits are decision-*recording* plugins (`tracemem`, `forge-mentor`, `goal-claude-plugin`), which are the opposite thing.

**Daily utility (1):** every turn of every session ends. If the ending is a card, the round trip where you read a paragraph and type "yes, do that" disappears — dozens of times a day, for free.

---

## Implementation Plan

## Overview

Two moving parts and nothing else:

1. **A convention**, injected once per user prompt via a `UserPromptSubmit` hook's `additionalContext`: *if this turn changes anything, do not close with a report — call `AskUserQuestion` with a one-line status and 2–4 concrete next steps, the first one recommended.*
2. **A check**, a `Stop` hook that decides whether the turn that just ended was a *working* turn (it used a mutating tool) and whether it ended with the card. If it worked and did not offer a card, the hook exits 2 with a reason, which prevents the stop and sends Claude back to do it properly.

The convention alone gets maybe 70% compliance; the hook is what makes it reliable. Everything else in this plan is guardrails so the hook cannot trap a session in a loop.

A deliberate note on scope: **installing upstream is two commands** (`/plugin marketplace add https://github.com/kvitapp/kvit-plugins.git`, `/plugin install whats-next@kvit`) and it is MIT. Build the local version only if you want it in your own dotfiles, want different mutating-tool rules, or want it to fire on subagents too. The plan below is that variant.

## Stack Recommendation

**Python 3 standard library only** — the hook must start, read stdin, decide, and exit in well under a second, on every single turn. A dependency here is a startup cost paid dozens of times a day.

| Concern | Choice | Why |
|---|---|---|
| Language | Python 3.10 (system `python3`) | already on the box; `json` + `sys` is the entire import list |
| Hook transport | stdin JSON → exit code | the documented Stop contract; exit 2 blocks the stop, stderr becomes the reason |
| Turn inspection | `transcript_path` JSONL, read backwards | the only way to see which tools ran this turn |
| Convention injection | `UserPromptSubmit` → `hookSpecificOutput.additionalContext` | per-prompt, costs no permanent context |
| State between blocks | a file under `scratchpad_dir` keyed by `session_id` | bounds the retry count without a database |
| Config | env vars read in the hook | `GATE=off` must be one export away when it misfires |
| Tests | one `test_gate.py` with `assert` over canned transcript fixtures | the tool-scan and the loop-guard are the only non-trivial logic |

Excluded on purpose: no plugin marketplace packaging (that is upstream's job), no MCP server, no LLM call to judge the reply, no config file format.

## MVP Scope

**In:**

1. `UserPromptSubmit` hook prints `{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "<convention>"}}` and exits 0.
2. `Stop` hook reads `session_id`, `transcript_path`, `last_assistant_message`, `stop_hook_active` (or its equivalent loop flag) from stdin.
3. **Work detection:** scan the transcript backwards to the last user message; collect tool names. Mutating set defaults to `Edit`, `Write`, `NotebookEdit`, `Bash`, plus anything in `GATE_MUTATING_TOOLS`. Read-only turns are exempt — a question answered in prose stays prose.
4. **Card detection:** in the same window, did an `AskUserQuestion` call appear? If yes, exit 0.
5. **Block:** otherwise print the reason to stderr and exit 2.
6. **Loop guard:** a counter per `(session_id, prompt_id)` under `scratchpad_dir`; after `GATE_MAX_BLOCKS` (default 2) the hook gives up and exits 0 forever for that turn. A gate that can wedge a session will get deleted after the first time it does.
7. `GATE=off` short-circuits both hooks at line one.

**Out of v1:** subagent turns (`SubagentStop`), per-project convention text, any telemetry on how often the gate fires, any attempt to judge whether the *options offered* were good.

## Phases

**Phase 1 — Convention only, no enforcement (≈1 hour).**
Write the `UserPromptSubmit` hook and the convention string. Register it in `~/.claude/settings.json`. Use it for a day with no gate at all and count how often turns end with a card unprompted. This number decides whether the rest of the plan is worth building — if the convention alone lands above ~90%, stop here and keep the one-line version.

**Phase 2 — Transcript scanner, read-only (≈2 hours).**
`gate.py --dry-run <transcript.jsonl>`: given a transcript, print the last turn's tool list, whether it was a working turn, and whether it ended with a card. Run it over a handful of real transcripts from `~/.claude/projects/` and confirm the classification matches what you remember of those sessions. This is the whole risk of the project — the JSONL shape is the one thing that can silently change underneath you — so it gets its own phase and its own fixtures.

**Phase 3 — Wire the Stop hook (≈1 hour).**
Same scanner, now reading stdin and exiting 2 with a reason. Add the loop guard *before* the first live run, not after. Test the block path deliberately: make an edit, let the turn end without a card, confirm Claude comes back with one and that the second attempt is never blocked twice.

**Phase 4 — Live for a week, then tune (≈1 hour spread out).**
The mutating-tool set is the knob. `Bash` is the ambiguous one: `git status` is not work, `git commit` is. Start with `Bash` counted as mutating, and if that produces cards after trivial read-only shell turns, narrow it to a command-prefix check rather than removing it.

**Phase 5 (optional) — `SubagentStop` (≈1 hour).**
Same hook, different event, for subagent hand-backs. Only worth doing if subagent results are a place you actually make decisions.

## Effort Estimate

**One evening for a working gate** (Phases 1–3, ~4 hours), plus a week of low-attention tuning. Phase 2 is the only part that can overrun, and only if the transcript format needs reverse-engineering rather than reading.

Compare honestly against the alternatives before starting: installing upstream is **two commands**, and the convention line in `CLAUDE.md` is **one line**. Build only for a behaviour you want that neither gives you.

## Blockers and Risks

- **Transcript JSONL shape is undocumented and will drift.** It is internal to Claude Code and changes between versions. Mitigation: the Phase 2 fixtures, and a scanner that fails *open* — any parse error must exit 0, never 2. A hook that blocks on a format change is a hook that bricks every session after an update.
- **`last_assistant_message` may be enough.** The docs recommend it over reading the transcript for the final assistant text. It will not tell you which tools ran, so the scan is still needed for work detection — but check whether the tool-use record is reachable through it before writing the backwards reader.
- **Loop risk is the real danger.** Stop-hook blocking is exactly the mechanism that can pin a session in a cycle. The guard is not optional, and `GATE=off` must work without editing a file.
- **Latency is paid on every turn.** Reading a large transcript backwards is fine; reading it forwards is not. Cap the scan at the last N lines.
- **The convention competes with other instructions.** Ponytail mode already shapes turn endings ("at most three short lines"), and a next-step card is a different ending. Decide which wins before both are live, or the model will split the difference badly.
- **It may simply be annoying.** A card after a trivial one-line fix is worse than a sentence. Phase 4 exists for this, and abandoning after Phase 1 is a legitimate outcome.
