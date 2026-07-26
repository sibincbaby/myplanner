# wiki-build

Build or refresh the `openwiki/` knowledge wiki for this repository, using this session's
own inference — no LLM API key required.

## Steps

1. Read `.agents/skills/wiki-build/SKILL.md` and follow it as the authoritative
   instructions for this workflow.

2. Choose the mode it defines:
   - `openwiki/.wiki-state.json` **absent** → **init**
   - `openwiki/.wiki-state.json` **present** → **update**
   - User asked only to check or repair → **validate**

3. Run the deterministic scripts rather than doing their work by hand:

   ```bash
   bash .agents/skills/wiki-build/scripts/survey.sh > /tmp/wiki-survey.md   # init
   bash .agents/skills/wiki-build/scripts/drift.sh                          # update
   node .agents/skills/wiki-build/scripts/validate.mjs                      # always, last
   ```

4. Read the reference files the skill points to before writing:
   `references/okf-format.md`, `references/page-taxonomy.md`,
   `references/diagrams.md`, `references/update-discipline.md`,
   `references/state-file.md`.

5. Finish only when `validate.mjs` exits clean and `openwiki/.wiki-state.json` records
   every page with its backing `sources`.

## Non-negotiables

- Never document secret values, credentials, tokens, or `.env` contents.
- Ground every claim and every diagram in source you actually read.
- 8 pages maximum on an initial build.
- On update: respect the printed diff budget, and treat NO-OP as success.
