# wiki-build

Build and maintain an OKF-compatible knowledge wiki for **any existing codebase**, using
your coding agent's own session. No LLM API key, no provider config, no per-token bill on
top of the subscription you already pay for.

Same output contract as [`langchain-ai/openwiki`](https://github.com/langchain-ai/openwiki)
— `openwiki/` directory, OKF v0.1 front matter, reserved `index.md`/`log.md`, grounded
Mermaid diagrams — so the real CLI can take over the same wiki later if you ever want it to.

## Why not just run the openwiki CLI?

You can. It needs a provider and an API key, and bills per token on top of your agent
subscription. Your agent is already an agent with all the tools the job needs, so the key
is redundant.

## Install into a project

```bash
bash .agents/skills/wiki-build/install.sh /path/to/target/repo
```

Or copy by hand — the skill is self-contained:

```bash
cp -r .agents/skills/wiki-build /path/to/target/repo/.agents/skills/
```

## Host support

The canonical copy lives at `.agents/skills/wiki-build/`. That path is read natively by
most hosts; the rest get a thin pointer so there is exactly one copy of the real content.

| Host | Mechanism | Needs a pointer? |
|---|---|---|
| **GitHub Copilot** (agent mode) | reads `.agents/skills`, `.claude/skills`, `.github/skills` | No |
| **Antigravity** | reads `.agents/skills`; `.agents/workflows/wiki-build.md` adds the slash command | No |
| **Claude Code** | reads `.claude/skills` | Yes — `.claude/skills/wiki-build/SKILL.md` |
| **Codex / Gemini CLI** | `AGENTS.md` + skill discovery | No |

`install.sh` lays down both the canonical copy and the Claude Code pointer.

Verify discovery by asking the agent: *"what skills do you have available?"* — or in
Antigravity, type `/wiki-build`.

## Usage

Just ask. The skill's description triggers it:

> build a wiki for this codebase
> the docs are stale, refresh them
> check the wiki for problems

Or invoke it explicitly by name (`/wiki-build` in Antigravity).

## What it does

**init** — surveys the repo deterministically, reads the source that matters, plans, then
writes `quickstart.md` plus up to 7 focused section pages. Records what it read.

**update** — diffs the recorded SHA against `HEAD`, intersects changed files with each
page's recorded sources, and edits **only** the pages that intersection justifies. Exits
without touching anything when nothing meaningful changed.

**validate** — checks front matter, links, orphans, diagrams, state-file sync, and
accidental secret leakage.

## Layout

```
.agents/skills/wiki-build/
├── SKILL.md                       # entry point; mode routing
├── README.md
├── install.sh
├── upstream.json                  # which upstream files this skill derives from
├── references/                    # loaded on demand, not up front
│   ├── okf-format.md              # OKF v0.1 front matter contract
│   ├── page-taxonomy.md           # what earns a page, and at what depth
│   ├── diagrams.md                # Mermaid selection + grounding rules
│   ├── update-discipline.md       # diff budget, anti-slop, no-op rules
│   └── state-file.md              # .wiki-state.json schema
└── scripts/                       # deterministic; no tokens, no network
    ├── survey.sh                  # repo inventory + churn hotspots
    ├── drift.sh                   # STALE / UNTRACKED / MISSING classification
    ├── drift-map.mjs              # source→page intersection (called by drift.sh)
    ├── validate.mjs               # OKF + link + orphan + secret validator
    └── check-upstream.sh          # has upstream openwiki changed under us?
```

## Staying in sync with upstream

A new openwiki release does **not** automatically mean this skill needs updating. Only
four upstream files are actually coupled to it, and most releases touch none of them:

```bash
bash .agents/skills/wiki-build/scripts/check-upstream.sh
```

Exit 0 = nothing to do. Exit 1 = a high/medium-risk file changed; the output names the
exact skill files to re-review and links the upstream diff.

`upstream.json` records the coupling: each upstream file, its hash at the commit we last
verified against, what it governs, and what breaks if it changes. Highest risk is
`src/okf/frontmatter.ts` — it defines the OKF schema, so a change there can make
`validate.mjs` pass wikis the real CLI would reject.

The scripts, the state-file format, and drift detection are **ours**. Upstream cannot
invalidate them.

Refreshing `upstream.json` is deliberately manual: auto-rehashing would stamp "verified"
on a diff nobody read, which is the failure the check exists to prevent.

Currently verified against **openwiki v0.2.3** (`2a0fe7f`, 2026-07-26).

## The design bet

Two things make this cheaper and more durable than prompting an agent to "document the
repo":

**Scripts do the deterministic work.** Repo inventory, churn ranking, diff→page mapping,
and validation are shell and Node. No tokens, reproducible, same answer every run. The
session's inference is spent only on the part that actually needs judgement: reading code
and writing prose.

**`.wiki-state.json` records what each page was built from.** That turns "which pages need
updating?" from a fuzzy re-read of the whole repo into a set intersection. It is why
update runs are cheap, and why a no-op can be *proven* rather than guessed.

## Requirements

- `git` (drift detection and churn analysis; the rest degrades gracefully without it)
- `node` ≥ 18
- `bash`

No npm install. No dependencies.

## Credit

- Wiki structure, OKF v0.1 format, and the update-discipline rules derive from
  [`langchain-ai/openwiki`](https://github.com/langchain-ai/openwiki) (MIT).
- [`kinensake/openwiki-skills`](https://github.com/kinensake/openwiki-skills) (MIT) got
  there first with the core idea — extract OpenWiki's prompts, drop the API key. Worth
  using if you want a faithful prompt port for Claude Code, Codex, or Gemini CLI. This
  skill differs by adding Copilot and Antigravity coverage, deterministic scripts instead
  of agent-driven inventory, per-page source tracking for real drift detection, and a
  validator.
