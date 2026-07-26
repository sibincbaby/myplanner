---
name: wiki-build
description: Build and maintain an OKF-compatible knowledge wiki for an existing codebase using the agent's own session — no LLM API key, no external service. Use when the user asks to document a project, build a wiki or knowledge base for a repo, onboard onto an unfamiliar codebase, create agent-readable docs (AGENTS.md/CLAUDE.md context), refresh docs that have gone stale, or mentions openwiki / OKF / "second brain for this repo".
---

# wiki-build

Generates a structured, evidence-backed wiki for an existing project, then keeps it
current as the code moves. Reproduces the OpenWiki (`langchain-ai/openwiki`) output
contract — OKF v0.1 front matter, `index.md`/`log.md` reserved docs, grounded Mermaid
diagrams — but runs on **your own session's inference** instead of a separately-billed
API key.

Deterministic work (inventory, churn analysis, drift detection, validation) is done by
scripts in `scripts/`. Never do by hand what a script does: it is faster, cheaper, and
reproducible.

## Which mode

| Situation | Mode | Go to |
|---|---|---|
| No wiki exists yet (`openwiki/` absent or empty) | **init** | [Init](#init) |
| `openwiki/.wiki-state.json` exists | **update** | [Update](#update) |
| User asks to check/repair, not to write | **validate** | [Validate](#validate) |

Output directory is `openwiki/` by default. It is deliberately the same directory and
format the real `openwiki` CLI uses, so the two are interchangeable later. Override with
a different path if the user asks.

## Init

### 1. Survey (deterministic — do not skip, do not hand-roll)

```bash
bash .agents/skills/wiki-build/scripts/survey.sh > /tmp/wiki-survey.md
```

Read that file. It gives you the tree shape, entrypoints, configs, dependency manifests,
test layout, schema/migration files, existing docs, and — most valuable — the **churn
hotspots** (most-changed files). Churn is the best cheap proxy for "what matters here".

### 2. Discovery

Now read source, guided by the survey. Budget your reading: entrypoints and churn
hotspots first, then whatever the survey flagged as a domain boundary. You are looking
for evidence, not coverage.

Every claim you will write must trace to something you actually read. If you did not
read it, you do not know it.

### 3. Plan

Write `openwiki/_plan.md` before any page: intended pages, the type of each, the source
files backing each, evidence-backed relationships between them, and open questions.
Target **8 pages maximum** on a first run. Fewer good pages beat more thin ones.

Show the plan to the user if the repo is large or the scope is ambiguous. Otherwise
proceed.

### 4. Write

`quickstart.md` first — how to get the thing running and what it is. Then the linked
section pages.

Follow [references/page-taxonomy.md](references/page-taxonomy.md) for what earns a page
and at what depth, [references/okf-format.md](references/okf-format.md) for the front
matter contract, and [references/diagrams.md](references/diagrams.md) before writing any
Mermaid.

### 5. Audit, record, clean up

1. Every internal link resolves; no orphan pages; cross-domain relationships linked.
2. Write `openwiki/.wiki-state.json` — see [references/state-file.md](references/state-file.md).
   **This is what makes update mode cheap. Skipping it makes the wiki unmaintainable.**
3. Append a dated entry to `openwiki/log.md`.
4. Delete `openwiki/_plan.md`.
5. Run the validator (below) and fix what it reports.
6. Offer to add an agent-instructions pointer — see [Agent handoff](#agent-handoff).

## Update

**Read [references/update-discipline.md](references/update-discipline.md) first.** The
failure mode here is not staleness — it is an agent rewriting a good wiki into slop
because it felt obliged to change something. Those rules prevent it.

Do **not** re-read the repo. Ask the scripts what changed.

```bash
bash .agents/skills/wiki-build/scripts/drift.sh
```

This diffs the recorded build SHA against `HEAD`, intersects changed files with each
page's recorded `sources`, and prints:

- **STALE** — pages whose backing sources changed. Re-read only those sources, revise
  only those pages.
- **UNTRACKED** — changed files no page claims. Decide: fold into an existing page, new
  page, or genuinely not worth documenting.
- **MISSING** — recorded sources that no longer exist. The page describes something
  deleted; revise or remove it.

If it reports **NO-OP**, change nothing and say so. That is a successful outcome.

Otherwise: revise, refresh any diagram whose subject changed (a stale diagram is a stale
claim), update `sources` and `source_sha` for touched pages in the state file, bump
`last_update`, append to `log.md`, and validate.

Respect the diff budget `drift.sh` prints. Leave clean pages alone — untouched pages are
a feature, not an omission.

## Validate

```bash
node .agents/skills/wiki-build/scripts/validate.mjs
```

Checks OKF front matter, reserved-document rules, link resolution, orphans, and
degraded diagram fences. Non-zero exit means real errors. Fix them; re-run.

## Agent handoff

The point of the wiki is that agents read it. Offer to add to the project's `AGENTS.md`
(and `CLAUDE.md` if the project uses one):

```markdown
## Project knowledge base

`openwiki/` holds the maintained wiki for this codebase. Start at `openwiki/index.md`
or `openwiki/quickstart.md` before exploring source. If you learn something that
contradicts it, update the page and its `sources` in `openwiki/.wiki-state.json`.
```

Never rewrite an existing `AGENTS.md`/`CLAUDE.md` wholesale — append this section.
These files are the project's, not the wiki's.

## Hard rules

- **Never document secrets.** No credential values, private keys, tokens, or `.env`
  contents. Name that a variable exists; never its value.
- **Ground everything.** No invented participants, states, entities, endpoints, or
  relationships. Uncertain? Say so explicitly or leave it out.
- **No filler.** No generic "things to watch", no commit-hash lists, no per-file
  enumeration of the repo.
- Do not document every file. Document architecture, workflows, domains, data models,
  integrations, and extension points.
- `index.md` and `log.md` are reserved — never give them concept front matter.
