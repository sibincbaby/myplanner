# WorkflowVault

> Durable step-caching journal for personal agent workflows — wrap any expensive Claude API call or shell step in a `@step` decorator and never re-pay for completed work when a script crashes and retries

**Inspired by:** [lostinpatterns/kassette](https://github.com/lostinpatterns/kassette) (HN AI digest 2026-07-14, 73 stars)  
**Date discovered:** 2026-07-24

---

## What gap it fills

When building personal multi-step Claude Code workflows — scrape → summarize → classify → store — a crash after 40 minutes means re-running every API call from scratch. Kassette solves this pattern with S3/object-storage backends, but that's too much infrastructure for personal scripts. WorkflowVault is the same idea with a local-first default: plain JSONL files in `~/.workflowvault/`, a Python `@step` decorator, and a simple CLI to inspect, resume, or clear runs. Drop-in into any Python automation script; no server, no cloud, no setup.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Core | Python 3.11+ stdlib only | Zero dependencies for the decorator and journal |
| Storage | `~/.workflowvault/<run-id>/journal.jsonl` | Human-readable, `jq`-inspectable, append-only |
| CLI | Click | Thin wrapper: `vault list`, `vault show <run>`, `vault clear <run>` |
| Locking | `fcntl.flock` on a `.lock` file | Prevents concurrent writes corrupting the journal |
| Integration | Claude SDK + Anthropic Python SDK passthrough | Works with any function — LLM calls or shell steps |

## MVP scope (1 Claude session)

A Python package (`pip install workflowvault`) with two things:

1. **`@step(name="...")`** decorator: checks if `name` is in the run's journal, returns cached result if yes, calls the real function if no, appends result to journal
2. **`vault` CLI**: `vault list` (all runs + status), `vault show <run-id>` (step-by-step JSONL viewer), `vault resume <run-id>` (re-run script with cached steps auto-applied)

A "run" is auto-created when any `@step` decorated function is first called; identified by a deterministic hash of the script name + start timestamp.

Out of scope for MVP: branching (fork), version checking, S3 backend, web UI.

## Phases

### Phase 1 — Core journal (1 h)
- `Journal` class: append a completed step as one JSON line `{name, result, timestamp, cost_tokens?}`
- `has(name)` → bool; `get(name)` → result
- Atomic write: write to `.tmp` then rename to avoid partial writes
- File locking via `fcntl.flock` (Unix) with a graceful fallback for Windows

### Phase 2 — `@step` decorator (45 min)
- `@step(name=None, run_id=None)` wraps any sync or async function
- Auto-generates `name` from `fn.__name__` if not provided
- Auto-creates run directory `~/.workflowvault/<run-id>/` on first invocation
- Serializes return value via `json.dumps`; raises `SerializationError` if not JSON-serializable
- Preserves function signature for IDE autocomplete (`@functools.wraps`)

### Phase 3 — CLI (`vault`) (1 h)
- `vault list` — table of all runs: run-id, script, started, steps done, latest step name
- `vault show <run-id>` — print each journal line with timestamp, step name, result preview
- `vault clear <run-id>` — delete the run directory (with `--all` to clear everything)
- `vault tail <run-id>` — follow mode (`tail -f` on the journal) for live monitoring

### Phase 4 — Resume mode (45 min)
- `VAULT_RUN_ID=<run-id> python myscript.py` — instructs WorkflowVault to reload the journal from that run ID and use its cache for all `@step` lookups
- Print a banner when resuming: "Resuming run abc123 — 7 steps cached, starting at step 8 (classify)"
- Skip-and-replay semantics: if a cached step's result looks like an error dict, optionally re-run it

### Phase 5 — Cost tracking (30 min)
- Optional `cost_tokens` field on the step decorator: `@step(track_cost=True)` captures `usage` from Anthropic response
- `vault cost <run-id>` — shows per-step token spend and total
- `vault cost --all` — aggregate spend across all runs

## Effort estimate

~3.5 hours for Phases 1–3 (decorator + CLI MVP) · 1 Claude session  
~5 hours complete with resume mode and cost tracking

## Blockers / risks

- **Non-JSON-serializable results** (e.g. dataclasses, numpy arrays): the `@step` decorator will fail silently. Mitigation: accept a custom `serializer=` kwarg; default to `json.dumps` with a fallback `repr()` stored as a string marked `"_type": "repr"`.
- **Concurrent runs of the same script**: two instances writing to the same journal will corrupt it. Mitigation: each run generates a unique run-id (timestamp + PID) so they never share a file.
- **Step name collisions inside loops**: if you call `@step(name="summarize")` 100 times in a loop you get one cached entry. Mitigation: auto-suffix with call index when the same name appears multiple times in one run; document this clearly.
