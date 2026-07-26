# What earns a page, and at what depth

## The budget

**Initial run: 8 pages maximum**, including `quickstart.md`. This is a real constraint,
not a suggestion. A tight wiki gets read; a sprawling one gets ignored and rots.

If the repo genuinely needs more, write the 8 that matter and note the gaps in
`log.md`. Later `update` runs can grow the wiki where evidence justifies it.

## Always write

**`quickstart.md`** — the entry point, written first. What this project is, what it does,
how to run it, how to run its tests, and the two or three things a newcomer gets wrong.
Every other page hangs off this one.

## Write when the evidence supports it

| Page | Earns a page when | Type |
|---|---|---|
| Architecture | There is more than one component/process/service and their interaction is non-obvious | `Architecture` |
| Workflows | A multi-step runtime path crosses several modules (request lifecycle, job pipeline) | `Workflow` |
| Domain concepts | The code uses vocabulary a newcomer would misread | `Domain Concept` |
| Data model | Schemas, migrations, or persisted entities exist | `Data Model` |
| Integrations | The project talks to external services/APIs | `Integration` |
| Operations | There is deploy/config/observability surface worth knowing | `Operations` |
| Extension points | The design expects you to add plugins/handlers/adapters | `Extension Point` |
| Test strategy | The test layout is unusual or non-obvious to run | `Test Strategy` |

Absence of evidence means **no page**. A stub that says "this project has no
integrations" is worse than nothing.

## Depth

Aim for the level a competent engineer needs to make a change safely:

- **Name real identifiers.** `AuthMiddleware.verify()` in `src/auth/middleware.ts`, not
  "the auth layer".
- **Explain why, not just what.** The what is readable from source. The why is what git
  history and this wiki uniquely provide.
- **Link, don't duplicate.** If existing docs cover it, synthesize and link. Never
  copy-paste a README into the wiki.
- **Prefer a diagram** when describing a flow, lifecycle, or data model — see
  [diagrams.md](diagrams.md).

## Do not write

- Per-file enumeration of the repository. Nobody reads it and it rots instantly.
- Generic "things to watch" / "future improvements" / "potential issues" sections.
- Lists of commit hashes, unless one specific decision genuinely turns on one.
- Anything you did not read the source for.
- Restatement of the language's or framework's own documentation.

## Linking and structure

- Every page reachable from `index.md` or `quickstart.md`. **No orphans.**
- Cross-domain relationships get real links, not prose gestures at another page.
- Relative links between wiki pages (`./data-model.md`). The validator checks these.
- Link to source with repo-relative paths (`src/auth/middleware.ts`) so both humans and
  agents can jump.
