# retry-guard — a Claude Code hook that remembers failed fixes and blocks repeats

**Source:** <https://github.com/anlor1002-alt/regressionledger>
**Discovered:** 2026-07-18
**Viability:** 4/4

> Seeded by *regressionledger* (a Show HN hook that stops Claude Code from re-trying fixes that already failed). The build target is a small, local Claude Code hook that fingerprints each attempted "fix", records whether it actually resolved the failure, and — before the agent applies a fix it has already tried and lost to — blocks the edit and surfaces "you did this before, it failed with X." It closes the loop the user's own workflow keeps hitting: agents silently re-running steps that already no-op'd or looping on the same broken fix.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

A pair of Claude Code hooks (`PostToolUse` to record, `PreToolUse` to guard) plus a per-project JSON ledger is a 1–2 session build against a documented, stable hook protocol — weekend_buildable=1. It fills a concrete gap in *this* toolkit: the user runs Claude Code constantly and (per their own project notes) steps can silently no-op and get re-run; nothing they own remembers "this exact fix was tried and failed" across a session, so the agent burns turns re-applying it — fills_gap=1. daily_utility=1 because it is a passive always-on hook: every session it can fire is a session it helps, at zero interaction cost. novel=1 by the strict definition — a failed-fix *memory* used as a pre-edit guardrail is not a polished, widely-used OSS pattern; the adjacent tools (brain0's prompt/drift audit, statewright's state-machine guardrails) solve different problems. Total 4, viable.

---

## Implementation Plan

## Overview

A local Claude Code hook that gives the agent a short memory of what it has already tried and lost to. After a "fix" (an `Edit`/`Write`/`Bash` attempt aimed at making something pass) it records a fingerprint of that fix plus the outcome of the next verification. Before the agent applies a fix, a guard hook checks the ledger: if that fingerprint is already recorded as *failed*, it blocks the tool call and returns a message telling the agent it tried this before and what went wrong — forcing a different approach instead of a loop.

The MVP is the closed loop: **fingerprint attempt → observe outcome → record → match-and-block on repeat**. Everything is local: two hook scripts and one JSON ledger per project. No server, no model, no dependency beyond the Claude Code hook runtime and Node (or a shell + `jq`).

This is deliberately **not** a full "AI code auditor" (brain0) or a workflow state machine (statewright). It does one thing: stop the agent from re-doing a fix that already failed.

## Stack Recommendation

- **Runtime: Claude Code hooks (`PreToolUse` + `PostToolUse`), scripts in Node 20 (or POSIX sh + `jq`).** Node keeps diff-hashing and JSON handling in one file with zero deps (`node:crypto`, `node:fs`); hooks read the tool payload on stdin and reply with JSON on stdout — no extra libraries.
- **Ledger: one JSON file per project**, e.g. `.claude/retry-guard/ledger.json`, an array of `{ fingerprint, tool, target, summary, outcome, first_seen, last_seen, count }`. Plain file, git-ignored by default. SQLite only if a project's ledger ever gets large (it won't for MVP).
- **Config: `.claude/retry-guard/config.json`** — match strictness, outcome-signal patterns, TTL, and an on/off switch.
- **No DB, no daemon, no network.** State is the JSON file; the hooks are stateless processes invoked by Claude Code.

## MVP Scope

In:
- `PostToolUse` hook that fingerprints `Edit`/`Write`/`Bash` fix attempts and appends/updates the ledger.
- Outcome capture — mark the most recent attempt `failed` when the following verification (test/build/lint run) still fails; `passed` when it succeeds.
- `PreToolUse` hook that computes the incoming fingerprint and, on a `failed` match, blocks the call (hook `deny` decision) with a reason string quoting the prior failure.
- Per-project `ledger.json` + `config.json`; a strictness knob (exact vs. normalized-diff match) and an off switch.

Out (later): cross-project global memory, fuzzy/semantic fix matching, a TUI to browse the ledger, auto-expiry beyond a simple TTL, sharing ledgers between machines, non-Claude-Code agents.

## Implementation Phases

### Phase 1: Hook scaffold + record attempts
**Goal:** Every fix attempt lands in `ledger.json` with a stable fingerprint.
**Files to create/modify:**
- `hooks/record.mjs` — `PostToolUse` handler: read tool payload on stdin, build the fingerprint, upsert the ledger row.
- `lib/fingerprint.mjs` — normalize + hash a fix: for `Edit`/`Write` use `{path + normalized new_string}`; for `Bash` use the normalized command.
- `lib/ledger.mjs` — load/save `.claude/retry-guard/ledger.json` (create dir on first write).
- `.claude/settings.json` (project) — register the `PostToolUse` hook for `Edit|Write|Bash`.
- `README.md` — the hook-registration snippet and where the ledger lives.
**Key steps:**
1. Parse the `PostToolUse` stdin JSON; extract tool name and inputs.
2. Fingerprint deterministically (trim whitespace, collapse blank lines, hash with `sha256`).
3. Upsert by fingerprint: bump `count`, set `last_seen`, default `outcome: "unknown"`.
**Verify:** Make Claude Code edit a file twice with the same content; confirm one ledger row with `count: 2`, and that a different edit creates a second row.

### Phase 2: Outcome detection
**Goal:** The ledger knows whether each attempt actually fixed anything.
**Files to create/modify:**
- `hooks/record.mjs` — when the recorded tool is a verification `Bash` (test/build/lint), read its exit status / output and stamp the *preceding* attempt `passed`/`failed`.
- `lib/outcome.mjs` — classify a command as a verification run and parse pass/fail from exit code + `config` patterns (e.g. `FAIL`, `Error:`, non-zero exit).
- `config.json` — `verifyPatterns` (commands that count as checks) and `failPatterns`.
**Key steps:**
1. Track the last fix fingerprint per session (small state in the ledger or a sidecar).
2. On a verification run, map its result back onto that fingerprint.
3. Handle "no verification followed" → leave `unknown` (never block on unknown).
**Verify:** Have the agent apply a fix, then run a failing test; confirm the fix row flips to `failed`. Apply a working fix, run a passing test; confirm `passed`.

### Phase 3: Pre-edit guard
**Goal:** The agent is stopped before repeating a known-failed fix.
**Files to create/modify:**
- `hooks/guard.mjs` — `PreToolUse` handler: fingerprint the incoming call; if it matches a `failed` row, emit a `deny` decision with a reason.
- `.claude/settings.json` — register the `PreToolUse` hook for `Edit|Write|Bash`.
- `lib/decision.mjs` — build the hook JSON response (`permissionDecision`, `reason`).
**Key steps:**
1. Reuse `lib/fingerprint.mjs` so record and guard hash identically (the one place a silent mismatch hides).
2. On a `failed` match, deny and return "You already tried this fix (seen N×); it failed with: <summary>. Try a different approach."
3. On `passed`/`unknown`/no match, allow silently.
**Verify:** Reproduce a fix the ledger has marked `failed`; confirm the `PreToolUse` hook blocks it and the reason reaches the agent. Confirm a brand-new fix is allowed and a previously-`passed` fix is allowed.

### Phase 4: Config, TTL, hardening
**Goal:** Safe for daily always-on use — no false blocks, no unbounded growth.
**Files to create/modify:**
- `config.json` — `enabled`, `matchMode` (`exact` | `normalized`), `ttlHours`, `maxRows`.
- `lib/ledger.mjs` — drop rows older than `ttlHours`; cap at `maxRows` (evict oldest).
- `hooks/guard.mjs` — respect `enabled: false` (allow-all) and never block on `unknown`.
- `README.md` — config reference, how to clear the ledger, how to disable per-project.
**Key steps:**
1. Add an escape hatch: `enabled:false` and a `retry-guard clear` one-liner (delete the JSON).
2. Expire stale rows so an old failure doesn't block a now-valid fix forever.
3. Fail open: any hook error → allow the tool call (a guard that crashes must never wedge the agent).
**Verify:** Set `enabled:false` and confirm nothing is blocked. Age a row past `ttlHours` and confirm it stops blocking. Corrupt the ledger JSON and confirm the hook allows the call (fails open) instead of erroring.

## Estimated Effort

**1–2 Claude Code sessions.**
- **Session 1:** Phases 1–2 — recording attempts and detecting outcomes (the fingerprint + outcome-mapping logic).
- **Session 2:** Phases 3–4 — the pre-edit guard, config, TTL, and fail-open hardening (the correctness-sensitive work: identical fingerprinting on both sides, and never false-blocking).

## Potential Blockers

- **Fingerprint drift.** Record and guard must hash a fix identically or the guard silently never matches — the exact failure this tool exists to remove. Keep fingerprinting in one shared module with a self-check (`node --test`) asserting record-side and guard-side hashes agree for the same edit.
- **Detecting "failed" reliably.** There is no clean signal that a fix worked; you infer it from the next verification run. Wrong inference → false blocks. Only mark `failed` on a clear signal (non-zero exit or configured `failPatterns`); default to `unknown` and never block on `unknown`.
- **False positives are worse than misses.** Blocking a legitimate retry is more damaging than letting one slip. Bias toward `exact` matching in MVP; make `normalized`/fuzzy opt-in.
- **Hook must fail open.** A `PreToolUse` hook that throws can stall the agent. Wrap every handler so any error → allow. Never let the guard become the outage.
- **Session vs. cross-session scope.** MVP maps outcomes within a session; across sessions the "last attempt" link is fuzzier. Persist enough (fingerprint + outcome) that cross-session *blocking* still works even if precise outcome attribution is session-local.
- **Overlap creep.** If it grows toward auditing all agent decisions it becomes brain0; toward gating workflow steps it becomes statewright. Keep it to one job: remember failed fixes, block their repeat.
