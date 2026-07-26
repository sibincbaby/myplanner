#!/usr/bin/env node
// Validator for a wiki-build / OKF v0.1 wiki. Zero dependencies.
//
// Checks OKF front matter, reserved-document rules, link resolution, orphan pages,
// degraded Mermaid fences, state-file sync, and obvious secret leakage.
//
//   node validate.mjs [wiki_dir]     (default: openwiki)
//
// Exit 0 = no errors (warnings may remain), 1 = errors, 2 = could not run.

import fs from "node:fs";
import path from "node:path";

const wikiDir = process.argv[2] ?? "openwiki";
const RESERVED = new Set(["index.md", "log.md"]);
const OKF_STRINGS = ["type", "title", "description", "resource", "timestamp"];

const errors = [];
const warnings = [];
const err = (f, m) => errors.push({ f, m });
const warn = (f, m) => warnings.push({ f, m });

if (!fs.existsSync(wikiDir) || !fs.statSync(wikiDir).isDirectory()) {
  console.error(`No wiki directory at "${wikiDir}".`);
  process.exit(2);
}

// ---------------------------------------------------------------- collect pages
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith(".")) walk(p); }
    else if (e.name.endsWith(".md")) pages.push(p);
  }
})(wikiDir);

if (pages.length === 0) {
  console.error(`No markdown files under "${wikiDir}".`);
  process.exit(2);
}

// -------------------------------------------------- minimal YAML front matter
// Handles the OKF subset: scalars, inline [a, b] lists, and "- item" block lists.
function parseFrontMatter(text) {
  if (!text.startsWith("---")) return { fm: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { fm: null, body: text, unterminated: true };
  const raw = text.slice(text.indexOf("\n") + 1, end);
  const body = text.slice(text.indexOf("\n", end + 1) + 1);
  const fm = {};
  let key = null;
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && key) {
      if (!Array.isArray(fm[key])) fm[key] = [];
      fm[key].push(strip(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    let v = kv[2].replace(/\s+#.*$/, "").trim();
    if (v === "") { fm[key] = ""; continue; }
    if (v.startsWith("[")) {
      fm[key] = v.replace(/^\[|\]$/g, "").split(",").map(strip).filter(s => s !== "");
    } else {
      fm[key] = strip(v);
    }
  }
  return { fm, body };
}
const strip = (s) => s.trim().replace(/^["']|["']$/g, "").trim();

// --------------------------------------------------------------- per-page checks
const linkGraph = new Map();   // page -> Set(linked pages)
const typesSeen = new Map();   // type -> [pages]

const SECRETS = [
  [/\b(?:sk|pk)-[A-Za-z0-9_-]{16,}/, "API key literal"],
  [/\bghp_[A-Za-z0-9]{20,}/, "GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key block"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, "JWT"],
  [/(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?(?!<|\$|\{|your|xxx|\.\.\.|example|changeme|placeholder|redacted)[^\s"'<>{}]{8,}/i,
   "hardcoded credential"],
];

for (const file of pages) {
  const rel = path.relative(wikiDir, file);
  const text = fs.readFileSync(file, "utf8");
  const { fm, unterminated } = parseFrontMatter(text);

  if (unterminated) err(rel, "front matter opens with `---` but is never terminated");

  if (RESERVED.has(rel)) {
    // Reserved docs must not carry concept front matter.
    if (fm && fm.type) {
      err(rel, "reserved document must not have concept front matter (`type` present)");
    }
    if (fm && fm.okf_version && rel !== "index.md") {
      err(rel, "`okf_version` belongs only on the bundle-root index");
    }
  } else {
    if (!fm) {
      err(rel, "missing OKF front matter (`type` is required on concept pages)");
    } else {
      if (!("type" in fm)) err(rel, "front matter missing required field `type`");
      else if (typeof fm.type !== "string" || fm.type.trim() === "")
        err(rel, "`type` must be a non-empty string");
      else {
        if (!typesSeen.has(fm.type)) typesSeen.set(fm.type, []);
        typesSeen.get(fm.type).push(rel);
      }

      for (const k of OKF_STRINGS) {
        if (k in fm && k !== "type") {
          if (Array.isArray(fm[k])) err(rel, `\`${k}\` must be a string, not a list`);
          else if (String(fm[k]).trim() === "")
            err(rel, `\`${k}\` is present but empty — omit the key instead`);
        }
      }
      if ("tags" in fm) {
        if (!Array.isArray(fm.tags)) err(rel, "`tags` must be a YAML list of non-empty strings");
        else if (fm.tags.some(t => String(t).trim() === ""))
          err(rel, "`tags` contains an empty string");
      }
      if (!fm.description) warn(rel, "no `description` — agents rely on it to decide whether to open the page");
      if (fm.openwiki_generated === "true" || fm.openwiki_generated === true)
        warn(rel, "`openwiki_generated` is set — metadata is machine-inferred and unverified");
    }
  }

  // Degraded diagram fences: upstream downgrades unparseable mermaid to ```text.
  for (const m of text.matchAll(/```text\n([\s\S]*?)```/g)) {
    if (/mermaid|sequenceDiagram|stateDiagram|erDiagram|flowchart|graph\s+(TD|LR)/i.test(m[1])) {
      err(rel, "degraded diagram: a ```text fence holds Mermaid source — fix the syntax and restore the ```mermaid fence");
    }
  }
  for (const m of text.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
    const d = m[1].trim();
    if (!d) err(rel, "empty ```mermaid fence");
    else if (!/^(sequenceDiagram|stateDiagram(-v2)?|erDiagram|flowchart|graph|classDiagram|gantt|pie|journey|timeline|mindmap|quadrantChart|gitGraph|C4Context|block-beta|xychart-beta|sankey-beta)\b/m.test(d))
      warn(rel, "```mermaid fence does not begin with a recognised diagram type");
  }

  for (const [re, label] of SECRETS) {
    if (re.test(text)) err(rel, `possible ${label} in wiki text — never document secret values`);
  }

  // Relative markdown links to other wiki pages.
  const outbound = new Set();
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    let target = m[1];
    if (/^([a-z][a-z0-9+.-]*:|\/\/|#|mailto:)/i.test(target)) continue;
    target = target.split("#")[0];
    if (!target) continue;
    const resolved = path.normalize(path.join(path.dirname(file), decodeURIComponent(target)));
    if (target.endsWith(".md")) {
      if (!fs.existsSync(resolved)) err(rel, `broken wiki link → \`${target}\``);
      else outbound.add(path.relative(wikiDir, resolved));
    } else if (resolved.startsWith(wikiDir + path.sep) && !fs.existsSync(resolved)) {
      err(rel, `broken relative link → \`${target}\``);
    }
  }
  linkGraph.set(rel, outbound);
}

// --------------------------------------------------------------- orphan detection
const linkedTo = new Set();
for (const targets of linkGraph.values()) for (const t of targets) linkedTo.add(t);
const roots = new Set(["index.md", "quickstart.md", "log.md"]);
for (const rel of linkGraph.keys()) {
  if (!roots.has(rel) && !linkedTo.has(rel)) {
    warn(rel, "orphan — not linked from any other page");
  }
}
if (!fs.existsSync(path.join(wikiDir, "quickstart.md")))
  warn("(wiki)", "no `quickstart.md` — it is the expected entry point");

// ------------------------------------------------------------- type consistency
const norm = (t) => t.toLowerCase().replace(/[\s_-]+/g, "");
const byNorm = new Map();
for (const t of typesSeen.keys()) {
  const n = norm(t);
  if (!byNorm.has(n)) byNorm.set(n, []);
  byNorm.get(n).push(t);
}
for (const [, variants] of byNorm) {
  if (variants.length > 1)
    warn("(wiki)", `inconsistent \`type\` casing/spelling: ${variants.map(v => `"${v}"`).join(", ")} — pick one`);
}

// ------------------------------------------------------------------ state file
const statePath = path.join(wikiDir, ".wiki-state.json");
if (!fs.existsSync(statePath)) {
  warn("(wiki)", `no \`${statePath}\` — update mode cannot do drift detection without it`);
} else {
  let state;
  try { state = JSON.parse(fs.readFileSync(statePath, "utf8")); }
  catch (e) { err(".wiki-state.json", `invalid JSON: ${e.message}`); }
  if (state) {
    const recorded = new Set();
    if (!Array.isArray(state.pages)) {
      err(".wiki-state.json", "`pages` must be an array");
    } else {
      for (const p of state.pages) {
        if (!p || typeof p.path !== "string") {
          err(".wiki-state.json", "a `pages` entry has no `path`"); continue;
        }
        recorded.add(p.path);
        if (!fs.existsSync(path.join(wikiDir, p.path)))
          err(".wiki-state.json", `records \`${p.path}\`, which does not exist on disk`);
        if (!Array.isArray(p.sources) || p.sources.length === 0)
          err(".wiki-state.json", `\`${p.path}\` has no \`sources\` — drift cannot be detected for it`);
        else if (p.sources.length === 1)
          warn(".wiki-state.json", `\`${p.path}\` lists only one source — likely a thin page or an incomplete record`);
        if (!p.source_sha)
          warn(".wiki-state.json", `\`${p.path}\` has no \`source_sha\``);
      }
    }
    for (const rel of linkGraph.keys()) {
      if (!RESERVED.has(rel) && !recorded.has(rel))
        err(".wiki-state.json", `\`${rel}\` exists on disk but is not recorded — it will never be checked for drift`);
    }
    if (!state.last_full_build?.sha)
      warn(".wiki-state.json", "no `last_full_build.sha`");
  }
}

// ---------------------------------------------------------------------- report
const plan = path.join(wikiDir, "_plan.md");
if (fs.existsSync(plan)) err("_plan.md", "temporary plan file was left behind — delete it");

console.log(`Validated ${pages.length} page(s) in "${wikiDir}"\n`);
const show = (list, label) => {
  if (!list.length) return;
  console.log(`${label} (${list.length}):`);
  const grouped = new Map();
  for (const { f, m } of list) {
    if (!grouped.has(f)) grouped.set(f, []);
    grouped.get(f).push(m);
  }
  for (const [f, ms] of grouped) {
    console.log(`  ${f}`);
    for (const m of ms) console.log(`    - ${m}`);
  }
  console.log("");
};
show(errors, "ERRORS");
show(warnings, "WARNINGS");

if (errors.length) {
  console.log(`FAIL — ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(warnings.length ? `PASS with ${warnings.length} warning(s).` : "PASS — clean.");
