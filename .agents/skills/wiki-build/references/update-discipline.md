# Update discipline

The failure mode of an auto-maintained wiki is not going stale — it is being slowly
rewritten into slop by an agent that felt obliged to change something on every run.
These rules exist to prevent that. They come from upstream OpenWiki's update prompt and
they are the most valuable part of the design.

## No-op is a correct, successful outcome

If nothing meaningful changed, **change nothing and say so.** Do not touch files to look
productive. Conditions that mean stop:

- `HEAD` equals the recorded `last_update.sha` (or `last_full_build.sha`) and the working
  tree is clean.
- Every changed path is inside the wiki directory itself.
- Changed files are all in `.gitignore`d or generated paths.

An explicit user instruction overrides the no-op check — if they say "refresh the data
model page", do it regardless.

## Soft diff budget

Scale the edit to the change. This is a budget, not a quota — under-spending is fine.

| Source files changed | Wiki pages you should touch |
|---|---|
| 1–4 | **At most 1–2** |
| 5–15 | At most 3–4 |
| 16+ | Re-plan; a refactor this size may need a new page or a merge |

Exceeding the budget requires a reason you can state in one sentence. If you cannot state
it, you are over-editing.

## Never edit for these reasons

- **Formatting only.** Rewrapping, reordering sections, changing bullet style, "improving"
  wording that was already correct. Hard rule.
- **Tone preference.** If the existing sentence is accurate, leave it.
- Adding a generic "recent changes" / "things to watch" section.
- Appending commit hashes.
- Re-running the whole init flow because it felt easier than a targeted edit.

## Do edit when a section is

- **Stale** — describes behavior that no longer exists.
- **Incomplete** — a new capability in its scope is undocumented.
- **Misleading** — technically still true but now implies something false.
- **Contradicted** by a diagram whose subject changed.

## Leave `quickstart.md` alone

Unless core behavior, setup, or the run/test commands actually changed. It is the most
linked page and the most damaged by churn.

## Order of work

1. `drift.sh` → the STALE / UNTRACKED / MISSING sets.
2. **Read the affected pages before editing.** You cannot make a surgical edit to text
   you have not read.
3. Read only the changed source, not the whole module.
4. Write a one-line justification per intended edit: *source change → page → what's now
   wrong → the edit*. Drop any edit you cannot justify this way.
5. Make the edits.
6. Update `sources` and `source_sha` for touched pages; bump `last_update`.
7. Append to `log.md` — one dated line per substantive change. Skip if no-op.
8. Validate.

## Deletions

When source is deleted, the page documenting it is wrong, not merely stale. Either revise
it to reflect the new reality or remove it — and if you remove it, fix inbound links and
drop the entry from the state file. A dangling link is a defect the validator will catch.
