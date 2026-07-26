# `openwiki/.wiki-state.json`

The file that makes update mode cheap. Without it, every update run re-derives which
pages matter by re-reading the repo — which is the expensive thing this skill exists to
avoid.

## Shape

```json
{
  "schema": 1,
  "generated_by": "wiki-build skill",
  "wiki_dir": "openwiki",
  "last_full_build": { "sha": "a1b2c3d4e5f6...", "date": "2026-07-26T09:12:00Z" },
  "last_update":     { "sha": "a1b2c3d4e5f6...", "date": "2026-07-26T09:12:00Z" },
  "pages": [
    {
      "path": "quickstart.md",
      "type": "Reference",
      "sources": ["package.json", "src/index.ts", "README.md"],
      "source_sha": "a1b2c3d4e5f6..."
    },
    {
      "path": "data-model.md",
      "type": "Data Model",
      "sources": ["prisma/schema.prisma", "src/db/"],
      "source_sha": "a1b2c3d4e5f6..."
    }
  ]
}
```

## Fields

- `last_full_build` — SHA/date of the last `init`. Never overwritten by updates.
- `last_update` — SHA/date of the last run that changed the wiki. No-op runs do **not**
  bump it; if they did, drift would be silently lost.
- `pages[].path` — relative to the wiki dir.
- `pages[].type` — mirrors the page's OKF `type`.
- `pages[].sources` — **the important field.** Repo-relative paths this page's claims rest
  on. Directory entries must end with `/` and match by prefix.
- `pages[].source_sha` — SHA at which this page was last verified against its sources.
  Per-page, so one page's revision does not mark the others fresh.

## Writing good `sources`

This list is the entire basis of drift detection. Get it right and updates are a set
intersection; get it wrong and the wiki lies without warning.

- List what you **actually read** to write the page — not everything topically related.
- Prefer a directory (`src/db/`) when the page describes the whole area; prefer specific
  files when it describes specific behavior.
- Include config and manifest files when the page documents setup or dependencies.
- 3–10 entries per page is typical. One entry usually means the page is thin. Thirty means
  the page is unfocused, or you listed things you did not read.
- Include the schema/migration files for a data-model page. They are the highest-signal
  drift trigger in most repos.

## Maintenance

- Add an entry when you create a page; remove it when you delete one.
- Update `sources` when a revision draws on files not previously listed.
- Bump `source_sha` **only** for pages you actually revised and re-verified.
- Keep `pages` in sync with what is on disk — `validate.mjs` reports both directions
  (recorded-but-missing, and on-disk-but-unrecorded).
