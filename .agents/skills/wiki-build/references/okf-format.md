# OKF v0.1 front matter contract

Every **concept page** starts with YAML front matter. Verified against
`langchain-ai/openwiki` (`src/okf/frontmatter.ts`).

```yaml
---
type: <Type name>                  # REQUIRED
title: <Optional display name>
description: <Optional one to two sentence summary>
resource: <Optional canonical URI>
tags: [<tag>, <tag>]               # Optional
timestamp: <Optional ISO 8601 datetime>
---
```

## Rules

- `type` is the **only** required field. Non-empty string.
- `title`, `description`, `resource`, `timestamp` — optional, but must be **non-empty
  strings when present**. An empty value is a validation error, not a shrug. Omit the
  key instead.
- `tags` — optional; must be a YAML list of non-empty strings.
- Recommended, in priority order: `title`, `description`, `resource`, `tags`. Prefer
  `description` on every page — it is what an agent reads when deciding whether to open
  the file.
- Unknown keys are tolerated (producer extensions). Do not invent keys without reason.

## `type` values

Not a closed set. Pick a short noun phrase in Title Case that names *what kind of thing*
the page describes. Upstream examples: `API Endpoint`, `Metric`, `Playbook`,
`Reference`, `BigQuery Table`, `BigQuery Dataset`.

Useful types for a codebase wiki: `Reference`, `Architecture`, `Workflow`, `Domain
Concept`, `Data Model`, `Integration`, `Operations`, `Extension Point`, `Test Strategy`.

**Be consistent within a wiki.** Reuse a type rather than coining a synonym — `Workflow`
and `Process` as separate types in one wiki is a defect.

## Reserved documents

`index.md` and `log.md` are reserved OKF documents.

- **Never** give them concept front matter.
- Only the bundle-root index may carry `okf_version: "0.1"`.
- Directory indexes are generated deterministically — content goes in concept pages, not
  indexes.

## `openwiki_generated`

Boolean the upstream tool sets to flag code-derived metadata awaiting human/agent
review. Do not set it by hand. If you see it on a page you are editing, that metadata
was machine-inferred — verify it against source before trusting it.
