#!/usr/bin/env node
// Maps changed source files onto wiki pages via each page's recorded `sources`.
// Invoked by drift.sh; reads the changed-file list on stdin, one path per line.
//
//   git diff --name-only BASE HEAD | node drift-map.mjs <state.json> <wiki_dir> <head_sha>

import fs from "node:fs";

const [statePath, wikiDir, headSha = ""] = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const changed = fs.readFileSync(0, "utf8").split("\n").map(s => s.trim()).filter(Boolean);
const pages = Array.isArray(state.pages) ? state.pages : [];

// A source entry ending in "/" is a directory prefix; anything else is an exact path.
const hits = (src, f) => (src.endsWith("/") ? f.startsWith(src) : f === src);

const stale = [];
const claimed = new Set();
for (const p of pages) {
  const srcs = Array.isArray(p.sources) ? p.sources : [];
  const why = [];
  for (const f of changed) {
    for (const s of srcs) {
      if (hits(s, f)) { why.push(f); claimed.add(f); break; }
    }
  }
  if (why.length) stale.push({ page: p.path, type: p.type, why });
}

const untracked = changed.filter(f => !claimed.has(f));

const missing = [];
for (const p of pages) {
  for (const s of p.sources ?? []) {
    const probe = s.endsWith("/") ? s.slice(0, -1) : s;
    if (!fs.existsSync(probe)) missing.push({ page: p.path, source: s });
  }
}

const out = [];

out.push("", "## STALE — revise these pages", "");
if (stale.length) {
  for (const s of stale) {
    out.push(`### \`${wikiDir}/${s.page}\`${s.type ? ` — _${s.type}_` : ""}`, "", "Changed sources:");
    for (const f of s.why.slice(0, 12)) out.push(`- \`${f}\``);
    if (s.why.length > 12) out.push(`- …and ${s.why.length - 12} more`);
    out.push("");
  }
  out.push("Read each page **before** editing it. Re-read only the changed sources above,");
  out.push("not the whole module. Refresh any diagram whose subject changed.");
} else {
  out.push("_No page claims any changed file._ Every edit landed outside documented");
  out.push("territory — see UNTRACKED below.");
}

out.push("", "## UNTRACKED — changed, but no page claims them", "");
if (untracked.length) {
  for (const f of untracked.slice(0, 40)) out.push(`- \`${f}\``);
  if (untracked.length > 40) out.push(`- …and ${untracked.length - 40} more`);
  out.push("");
  out.push("For each: fold into an existing page, justify a new page, or decide it is not");
  out.push("worth documenting. Config, lockfile and generated churn is usually the last one.");
  out.push("If you fold one in, add it to that page's `sources` list.");
} else {
  out.push("_None._ Every changed file is claimed by a page.");
}

out.push("", "## MISSING — recorded sources that no longer exist", "");
if (missing.length) {
  for (const m of missing) out.push(`- \`${wikiDir}/${m.page}\` → \`${m.source}\``);
  out.push("");
  out.push("These pages describe deleted code. Revise or remove them; if you remove a page,");
  out.push("fix inbound links and drop its entry from the state file.");
} else {
  out.push("_None._");
}

out.push("", "## After editing", "");
out.push("1. Bump `source_sha` **only** on pages you actually revised.");
out.push("2. Update `sources` where a revision drew on newly-read files.");
out.push(`3. Set \`last_update.sha\` to \`${headSha}\` — only if the wiki actually changed.`);
out.push("4. Append one dated line per substantive change to `log.md`.");
out.push("5. Run `validate.mjs`.");

process.stdout.write(out.join("\n") + "\n");
