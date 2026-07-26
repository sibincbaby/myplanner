#!/usr/bin/env bash
# Checks whether langchain-ai/openwiki has changed any file this skill derives from.
#
#   bash check-upstream.sh
#
# Exit 0 = in sync (or informational drift only), 1 = a high/medium-risk coupled file
# changed and needs review, 2 = could not run.
#
# Deliberately does NOT watch releases. A release that touches none of the coupled files
# cannot invalidate this skill; a single commit to frontmatter.ts can. Hashes are the
# precise signal, release tags are noise.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/../upstream.json"

[ -f "$MANIFEST" ] || { echo "missing manifest: $MANIFEST" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }

if command -v sha256sum >/dev/null 2>&1; then HASH() { sha256sum | cut -d' ' -f1; }
elif command -v shasum   >/dev/null 2>&1; then HASH() { shasum -a 256 | cut -d' ' -f1; }
else echo "need sha256sum or shasum" >&2; exit 2; fi

REPO="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).upstream.repo' "$MANIFEST")"
REF="$(node  -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).upstream.ref'  "$MANIFEST")"
OLD_COMMIT="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).upstream.verified_at_commit' "$MANIFEST")"
OLD_VERSION="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).upstream.verified_at_version' "$MANIFEST")"

echo "# Upstream sync check"
echo
echo "- **Upstream:** \`$REPO\` @ \`$REF\`"
echo "- **Verified at:** \`${OLD_COMMIT:0:12}\` (v$OLD_VERSION)"

NEW_COMMIT="$(git ls-remote "https://github.com/$REPO" "refs/heads/$REF" 2>/dev/null | cut -f1)"
if [ -n "$NEW_COMMIT" ]; then
  echo "- **Upstream now at:** \`${NEW_COMMIT:0:12}\`"
  if [ "$NEW_COMMIT" = "$OLD_COMMIT" ]; then
    echo
    echo "## IN SYNC"
    echo
    echo "Upstream \`$REF\` has not moved since this skill was verified. Nothing to review."
    exit 0
  fi
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

NEW_VERSION="$(curl -sSL --max-time 30 "https://raw.githubusercontent.com/$REPO/$REF/package.json" 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).version||"")}catch{}})' 2>/dev/null)"
[ -n "$NEW_VERSION" ] && echo "- **Upstream version:** v$NEW_VERSION (was v$OLD_VERSION)"
echo

# Fetch each coupled file and compare against the recorded hash.
COUNT="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).coupled_files.length' "$MANIFEST")"
CHANGED=0
ACTIONABLE=0
REPORT="$TMP/report.md"
: > "$REPORT"

i=0
while [ "$i" -lt "$COUNT" ]; do
  P="$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).coupled_files[$i].path"   "$MANIFEST")"
  E="$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).coupled_files[$i].sha256" "$MANIFEST")"
  R="$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).coupled_files[$i].risk"   "$MANIFEST")"

  if ! curl -sSLf --max-time 30 "https://raw.githubusercontent.com/$REPO/$REF/$P" -o "$TMP/f" 2>/dev/null; then
    printf -- '- `%s` — **FETCH FAILED** (moved, renamed, or deleted upstream — review manually)\n' "$P" >> "$REPORT"
    CHANGED=$((CHANGED+1)); ACTIONABLE=$((ACTIONABLE+1))
    i=$((i+1)); continue
  fi

  ACTUAL="$(HASH < "$TMP/f")"
  if [ "$ACTUAL" = "$E" ]; then
    printf -- '- `%s` — unchanged\n' "$P" >> "$REPORT"
  else
    CHANGED=$((CHANGED+1))
    # Only high/medium risk makes the check fail; low risk is informational.
    if [ "$R" != "low" ]; then ACTIONABLE=$((ACTIONABLE+1)); fi
    printf -- '- `%s` — **CHANGED** (risk: %s)\n' "$P" "$R" >> "$REPORT"
    printf -- '  - new sha256: `%s`\n' "$ACTUAL" >> "$REPORT"
  fi
  i=$((i+1))
done

echo "## Coupled files"
echo
cat "$REPORT"
echo

if [ "$CHANGED" -eq 0 ]; then
  echo "## IN SYNC"
  echo
  echo "Upstream moved, but touched none of the files this skill derives from."
  echo "Update \`verified_at_commit\` to \`$NEW_COMMIT\` and move on — no review needed."
  exit 0
fi

echo "## REVIEW NEEDED"
echo
node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const changed = fs.readFileSync(process.argv[2], "utf8")
  .split("\n").filter(l => l.includes("**CHANGED**") || l.includes("**FETCH FAILED**"))
  .map(l => (l.match(/`([^`]+)`/) || [])[1]).filter(Boolean);
for (const f of m.coupled_files) {
  if (!changed.includes(f.path)) continue;
  console.log(`### \`${f.path}\` — risk: ${f.risk}`);
  console.log("");
  console.log(`Governs: ${f.governs}`);
  console.log(`Breaks if: ${f.breaks_if}`);
  console.log("");
  console.log("Re-review in this skill:");
  for (const t of f.review_in_skill) console.log(`- \`${t}\``);
  console.log("");
}
' "$MANIFEST" "$REPORT"

cat <<EOF
## How to review

1. Diff the upstream file to see what actually changed:
   https://github.com/$REPO/compare/${OLD_COMMIT:0:12}...${NEW_COMMIT:-$REF}
2. For each changed file, check only the skill files listed above.
3. Most upstream diffs are refactors that change no rule. If the rules are unchanged,
   update the hashes and \`verified_at_commit\` in \`upstream.json\` and stop.
4. If a rule did change, update the reference doc **and** \`validate.mjs\` if it encodes
   the rule — a reference doc that disagrees with the validator is worse than either
   being stale alone.

Then record the new hashes and \`verified_at_commit\` in \`upstream.json\` by hand. There is
deliberately no --write flag: auto-rehashing would stamp "verified" on a diff nobody read,
which is the exact failure this check exists to prevent.

EOF

[ "$ACTIONABLE" -gt 0 ] && exit 1
exit 0
