# Context Warp Drive — Deterministic, Cache-Preserving Context Folding for Claude Code

**Source:** <https://github.com/dogtorjonah/context-warp-drive>
**Discovered:** 2026-07-12
**Viability:** 4/4

> Claude/LLM tooling + dev-productivity — deterministically compresses long agent transcripts by *structural folding* instead of LLM summarization, keeping the provider prompt cache hot. Directly targets the token-cost pain the user hits daily running agent/discovery workflows.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

The core mechanism — watch a Claude Code JSONL transcript, and when measured token usage crosses a threshold, deterministically fold the oldest/foldable turns while preserving the exact cached prefix so the provider's prompt cache stays warm — is a focused, well-scoped weekend build in TypeScript (weekend_buildable=1). The user runs token-heavy discovery and agent workflows every day and already invests in context-cost management (ccplug, the paleo token-saving skill), yet those tools reduce *output* verbosity; none preserve the *input* prompt cache across a long session, so a cache-aware folder fills a real, distinct gap (fills_gap=1, daily_utility=1). Novelty is the whole point: deterministic, non-LLM, cache-hot folding is a different approach from summarization-based compaction and from output-trimming skills, and upstream is early (62★, unpublished on npm), so it's not a polished widely-used clone (novel=1). Total 4 → viable, and the highest-conviction pick in weeks.

---

## Implementation Plan

### Overview

Context Warp Drive sits between a running Claude Code session and the Anthropic API. Every Claude Code turn re-sends the full conversation; once the transcript is long, most of the cost is re-reading history that the provider *could* serve from its 5-minute prompt cache — but only if the prefix bytes are **identical** across calls. Truncation and LLM-summarization both rewrite the prefix and blow the cache. The insight upstream ships is: **fold deterministically at stable boundaries so the surviving prefix is byte-identical to a previous call**, keeping cache-read hit rate high while shrinking the tail.

For a weekend Claude-buildable MVP we reimplement the **core loop** in TypeScript: a watcher that tails the Claude Code JSONL transcript, a deterministic folder that decides *what* to fold and *how* to represent the fold, and a thin CLI (`cwd-loop`) that wires the two together and reports token/cache stats. We deliberately scope out the multi-provider abstraction (Anthropic only), the hosted/tmux variants, and any live API interception — the MVP operates on transcripts and emits a folded context artifact plus measured savings, which is enough to prove the mechanism and use it daily.

The differentiator vs. the tools the user already has (paleo, token-diet = output reduction; native `/compact` = LLM summarization that resets the cache) is that folding is **deterministic and cache-preserving**: same input → same fold → same cacheable prefix, verifiable with a golden test rather than eyeballed.

### Stack Recommendation

- **Language/runtime:** Node.js 20+ with TypeScript, single-package CLI (matches upstream's TS choice and the user's Node tooling).
- **CLI framework:** `commander` for subcommands (`watch`, `fold`, `stats`, `doctor`).
- **Transcript source:** Claude Code JSONL under `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`; each line is one event (`user`/`assistant`/`tool_use`/`tool_result`). The `csess` skill/CLI available here dumps a real transcript for fixtures.
- **Token counting:** Anthropic count-tokens endpoint is authoritative but network-bound; for the deterministic core use a local estimator (`@anthropic-ai/tokenizer` or `tiktoken` with a fixed ratio) so folding decisions are reproducible offline. Reconcile against real usage numbers in `stats`.
- **Folding units:** operate on whole transcript *events* (never split a tool_use/tool_result pair) so folds land on stable boundaries; a fold replaces a contiguous run of old events with a single compact `[folded: N events, ~T tokens, files: …]` marker plus a pointer to the archived originals.
- **Archive/restore:** folded originals written to `.cwd/archive/<session>/<foldId>.jsonl` so nothing is lost and a fold can be expanded on demand.
- **Config:** `.cwd/config.json` — token threshold to trigger a fold, how many recent turns to always keep verbatim (the "hot window"), and min prefix to preserve.
- **Stats:** print tokens-before/after, estimated cache-read hit rate (identical-prefix bytes ÷ total prefix bytes across successive folds), and cost delta vs. naive truncation.
- **Packaging:** `npm link`, `bin.cwd` → `dist/cli.js`, `type: module`. No new heavy deps beyond `commander` + a tokenizer.

### MVP Scope

In scope:
1. `cwd fold <transcript.jsonl>` — pure function: given a transcript, return the folded context + an archive of folded events, deterministically.
2. `cwd watch` — tail the active Claude Code transcript; when estimated tokens cross the threshold, emit an updated folded artifact and log the decision.
3. `cwd stats` — report tokens saved, cache-preserved prefix ratio, and cost delta vs. truncation for a session.
4. `cwd doctor` — locate the Claude projects dir, validate transcript parse, confirm the tokenizer loads.
5. A golden/determinism test proving `fold(fold_input)` is byte-stable across runs and preserves the expected cacheable prefix.

Out of scope for MVP: live API proxying/interception, the tmux loop, OpenAI/Gemini providers, automatic session resume, and any LLM-based summarization fallback.

### Implementation Phases

#### Phase 1: Transcript model + deterministic folder (the core)
**Goal:** `cwd fold fixture.jsonl` deterministically produces a smaller context plus an archive, on stable event boundaries, with a byte-identical preserved prefix.
**Files to create/modify:**
- `package.json` — deps: `commander`, a tokenizer (`@anthropic-ai/tokenizer` or `tiktoken`); `bin.cwd` → `dist/cli.js`; `type: module`.
- `tsconfig.json` — NodeNext, `outDir: dist`.
- `src/transcript.ts` — parse JSONL into typed `Event[]`; pair `tool_use`↔`tool_result`; expose `estimateTokens(events)`.
- `src/fold.ts` — `fold(events, config): { context: Event[], archived: FoldRecord[] }`. Keep the last `hotWindow` turns verbatim; fold older foldable runs into a single marker event; never split a tool pair; deterministic ordering (no timestamps/random in output).
- `src/cli.ts` — `fold` subcommand reading a path, writing folded context to stdout and archive to `.cwd/archive/`.
- `test/fold.test.ts` — determinism + prefix-preservation assertions.
**Key steps:**
1. Define `Event` and `FoldRecord` types in `src/types.ts`; the fold marker records `{ foldId, count, approxTokens, files[], firstUserMsg }` so the agent still "knows" what was folded.
2. Implement `estimateTokens` with a fixed local tokenizer so decisions are reproducible offline.
3. Implement `fold`: choose the contiguous foldable run = events older than the hot window, minus any that must stay for a valid tool pairing; replace with one marker; return archived originals.
4. Guarantee determinism: no `Date.now()`/random in emitted content; sort/emit in transcript order.
**Verify:** `cwd fold test/fixtures/long.jsonl` twice → identical bytes (`diff` empty). Assert the first `hotWindow` events are untouched and the un-folded prefix is byte-identical to the same prefix in the input. `npm test` passes the determinism + prefix tests.

#### Phase 2: Live watcher on the active session
**Goal:** `cwd watch` tails the current Claude Code transcript and folds automatically when the token threshold is crossed, logging each decision.
**Files to create/modify:**
- `src/watch.ts` — resolve the active transcript (newest JSONL under the encoded-cwd projects dir), tail with `fs.watch`/polling, re-estimate tokens on change, call `fold` when over threshold.
- `src/paths.ts` — encode cwd → Claude projects dir path; pick the active session file.
- `src/cli.ts` — add `watch` (flags: `--threshold`, `--hot-window`, `--dry-run`).
**Key steps:**
1. Implement `paths.ts` to mirror Claude Code's cwd→dir encoding; `doctor` will validate it against the real `~/.claude/projects/`.
2. Tail the file; debounce rapid writes; recompute token estimate on each settle.
3. On threshold cross, run `fold`, write the folded artifact + archive, and append a decision line to `.cwd/log.jsonl` (`{ foldId, before, after, keptPrefixBytes }`). `--dry-run` logs without writing.
4. Idempotency: fold from the last fold point, not from scratch, so re-fires don't thrash the prefix.
**Verify:** Replay a long fixture by appending lines to a temp JSONL while `cwd watch --dry-run` runs; confirm exactly one fold fires at the threshold and the logged `keptPrefixBytes` matches Phase 1's preserved prefix. Point it at a real session and confirm it detects and reports without corrupting the file (watch is read-only on the source; folds write to `.cwd/`).

#### Phase 3: Stats, cache-hit measurement, and doctor
**Goal:** `cwd stats <session>` quantifies the win — tokens saved and cache-preserved prefix ratio vs. naive truncation — and `cwd doctor` self-checks the environment.
**Files to create/modify:**
- `src/stats.ts` — from `.cwd/log.jsonl` + archives, compute tokens before/after, `cacheRatio = keptPrefixBytes / totalPrefixBytes` across successive folds, and cost delta vs. truncating to the same size.
- `src/cli.ts` — add `stats` and `doctor`.
- `README.md` — quickstart, the folding model, and how to read the stats.
**Key steps:**
1. Implement the truncation baseline (drop-oldest to hit the same target size) and diff its prefix stability against folding to produce the "cache preserved vs. truncation" number.
2. `doctor`: projects dir found, a real transcript parses, tokenizer loads, `.cwd/` writable.
3. Optional reconciliation: if an `ANTHROPIC_API_KEY` (or the local `devgate`/`gateway-endpoint` dev endpoint) is present, call count-tokens once to calibrate the local estimator's ratio; otherwise skip — the core never requires a key.
4. Write the README with a copy-paste `cwd watch` recipe and a one-paragraph explanation of why byte-identical prefixes preserve the cache.
**Verify:** `cwd stats` on the Phase-2 session prints a positive tokens-saved and a `cacheRatio` strictly higher than the truncation baseline on the same fixture. `cwd doctor` passes on this machine.

### Estimated Effort

**2 Claude Code sessions (~6–8 hours total).**
- **Session 1 — Phase 1:** the deterministic folder is the whole product; get the transcript model, tool-pair-safe folding, archive, and the determinism/prefix golden test solid. Highest-value slice — proves the mechanism offline.
- **Session 2 — Phases 2 & 3:** the live watcher, decision logging, stats with the truncation baseline, `doctor`, and README. Buffer here for the JSONL event-shape surprises and the cwd→projects-dir encoding, which only surface against real sessions.

### Potential Blockers

- **Claude Code transcript format drift:** the JSONL event shape and the `~/.claude/projects/<encoded-cwd>/` layout are undocumented and version-dependent. Build against a fresh `csess`-dumped transcript and keep `transcript.ts` tolerant of unknown event types (pass them through un-folded) rather than assuming a schema.
- **The cache is provider-side and Claude Code owns the request:** the MVP produces a folded artifact and *measures* the theoretical win, but Claude Code still sends its own full context — actually *feeding* the fold back into the live request needs either a Claude Code hook/config hook-point or an API-proxy shim. Scope the MVP to measurement + a `--dry-run`-style advisory; wiring the fold into the live request is the first follow-up and its feasibility hinges on Claude Code exposing a pre-request hook.
- **Token-estimate vs. real usage:** a local tokenizer keeps folding deterministic but won't exactly match Anthropic's count; folds triggered slightly early/late are fine, but `stats` cost numbers are estimates until reconciled via count-tokens. Label them as estimates.
- **Cache-hit claims are workload-dependent:** upstream's 92.6% / −60% are their numbers on their traffic; don't hard-code them. `stats` must compute the ratio from the user's own sessions so the reported win is real for their usage.
- **Tool-pair integrity:** folding across a `tool_use`/`tool_result` boundary produces an invalid conversation. The folder must treat pairs as atomic — this is the one correctness path that needs a test, and it's already in the Phase 1 verify.

Relevant upstream reference: https://github.com/dogtorjonah/context-warp-drive
