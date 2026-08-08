# sessionport — Cross-Agent Session Transplant CLI

**Source:** [hetpatel-11/agent-hop](https://github.com/hetpatel-11/agent-hop) · HN Show HN Aug 8 2026, 1★, 17 commits, TypeScript
**Language:** TypeScript (Node 22) — plan mirrors upstream stack
**License:** upstream MIT · plan is a personal build
**Date discovered:** 2026-08-09

## What it is

agent-hop indexes local session stores from Claude Code, Codex, OpenCode, Pi and Grok Build, then does the thing nobody else does: it *normalizes* a session into a neutral conversation structure and *writes it back* in a different agent's native format, then launches that agent resumed at the same point. Search is a two-layer BM25 + local-embedding pass; handoff is a format translator.

**Why it matters here:** every other session tool in this backlog reads sessions. This one moves them. The concrete daily trigger is the Claude usage limit — the `ccauto-resume` skill exists precisely because that wall gets hit, and today the only options are to wait for the reset or to re-explain the whole task to another agent by hand. Session transplant makes the wall a two-second `sessionport hand-off --to codex` instead of a lost afternoon.

## Why it fits

- Core interest: **Claude/LLM tooling** — reads and writes Claude Code's own `~/.claude/projects/` JSONL
- Core interest: **dev productivity** — recovers a blocked session instead of restarting it
- `novel = 1`: sessionvault, claude-session-nexus, agentsession, deja-vu and wallfacer all *index* sessions; none *translate* between agent formats
- `fills_gap = 1`: `csess` reads Claude sessions only, and only within one agent — there is no path out of a rate-limited session today
- `daily_utility = 1`: fires on every limit hit and every deliberate model switch

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Both formats are line-delimited JSON on disk; the translator is a pure function |
| fills_gap | 1 | No existing tool or backlog plan moves a live session to another agent |
| novel | 1 | Session *transplant* is a different problem from session *indexing* |
| daily_utility | 1 | Triggered by usage limits, which are a daily constraint |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Runtime:    Node 22 + TypeScript, single bin (`sessionport`)
CLI:        commander (arg parsing) + @clack/prompts (interactive picker)
Storage:    node:sqlite (built into Node 22) — session index + FTS5 for search
Parsing:    node:readline over JSONL, streamed — sessions run to tens of MB
Launch:     child_process.spawn with stdio: 'inherit'
```

No embeddings in the MVP. FTS5 ships inside Node 22's SQLite and covers keyword search; a local embedding pass is a phase-5 upgrade only if FTS5 measurably misses.

## MVP Scope (1 Claude session)

1. `sessionport list` — scan `~/.claude/projects/**/*.jsonl`, print `{id, project, startedAt, messages, lastModel}` newest-first
2. `sessionport search <query>` — FTS5 over message text, print matching sessions with the hit line
3. `sessionport show <id>` — dump the normalized conversation as readable markdown
4. `sessionport port <id> --to codex` — write the normalized conversation into Codex's session directory and print the resume command
5. `sessionport port <id> --to codex --launch` — spawn the target agent already resumed

## Phases

### Phase 1: Index + Normalize (2-3h)
- Discover session files: `~/.claude/projects/**/*.jsonl`, plus `--path` for other roots
- Stream-parse each file with `node:readline`; map every line to `{role, text, toolCalls[], model, ts}`
- Define the neutral shape once (`NormalizedSession`) and keep every adapter pointed at it — this is the whole design
- Persist to SQLite: `sessions(id, path, project, started_at, message_count, model, mtime)` + an FTS5 `messages` table
- Re-index incrementally on `mtime` change; never rewrite unchanged files
- Verify: `sessionport list` message counts match `wc -l` on the source JSONL for three real sessions

### Phase 2: Search + Show (1-2h)
- `search` runs FTS5 `MATCH`, ranks by bm25(), prints session + matching excerpt with the query highlighted
- `--project`, `--since`, `--model` filters compose as SQL predicates
- `show <id>` renders the normalized session as markdown: user/assistant turns, tool calls collapsed to `Tool(name) → N lines`
- `--json` on every command for scripting and for Claude itself to call
- Verify: search a phrase you know appears in one old session, confirm exactly that session ranks first

### Phase 3: The Codex Adapter (2-3h)
- Read Codex's session directory layout and write a `toCodex(NormalizedSession)` serializer
- Tool calls have no cross-agent equivalent — flatten each into a plain-text turn (`[ran Edit on src/app.ts]`) rather than inventing a fake tool-call record. Losing structure beats corrupting the target's format
- `port <id> --to codex` writes a new session file and prints the resume command; `--launch` spawns it
- `--dry-run` prints the translated conversation to stdout without writing anything — the safety net for a format that may drift
- Verify: port a real 40-turn Claude session, resume it in Codex, ask "what were we doing?" and confirm the answer is right

### Phase 4: Round-Trip + Truncation (2h)
- `toClaudeCode(NormalizedSession)` for the return leg, so work done under the limit comes home
- Target context is smaller than the source often enough to matter: `--max-tokens` keeps the last N turns plus the first user message, and marks the seam with an explicit `[earlier turns omitted]` line so the receiving agent knows it is missing history
- Verify: port out, work three turns in Codex, port back, confirm those three turns are present in the resumed Claude session

### Phase 5: Picker + Polish (1h)
- Bare `sessionport` opens an interactive picker: recent sessions, arrow keys, enter to show, `p` to port
- Shell completion for session IDs
- Verify: pick and port a session end to end without typing an ID

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Index + Normalize | 2-3h |
| Search + Show | 1-2h |
| Codex Adapter | 2-3h |
| Round-Trip + Truncation | 2h |
| Picker + Polish | 1h |
| **Total** | **8-11h (~1-2 weekends)** |

Phases 1-3 deliver the actual value — a one-way escape hatch out of a rate-limited session — in **5-8h**.

## Blockers / Risks

- **Both session formats are internal and undocumented.** They will drift. Parse defensively, ignore unknown fields, and treat `--dry-run` as a first-class debugging path rather than a nicety
- **Tool-call fidelity is the real limit.** A ported session carries the conversation, not the agent's tool state, open file handles or permission grants. Be explicit in the README that this transplants *context*, not *execution state* — a user who expects the target to resume mid-edit will be surprised
- Writing into another agent's session directory is a write into someone else's private store: back up the target directory before the first write, and never modify the *source* session
- One adapter pair (Claude Code ↔ Codex) is the whole MVP. Adding OpenCode, Pi and Grok multiplies test surface without adding daily value — only add the agent actually reached for when Claude is capped
- Upstream agent-hop already does this and is MIT. Read its normalizer before writing one; if it holds up, the honest move is to use it and build only the Claude-limit-triggered automation on top
