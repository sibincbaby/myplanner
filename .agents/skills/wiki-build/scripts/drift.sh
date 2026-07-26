#!/usr/bin/env bash
# Deterministic drift detection for the wiki-build skill.
#
# Diffs the SHA recorded in .wiki-state.json against HEAD, intersects the changed
# paths with each page's recorded `sources`, and classifies the result:
#
#   STALE     page whose backing sources changed        -> revise this page
#   UNTRACKED changed file no page claims               -> decide: fold in / new page / ignore
#   MISSING   recorded source that no longer exists     -> page describes deleted code
#
# Turns "which pages need work?" from an LLM judgement into a set intersection.
# Usage:  bash drift.sh [wiki_dir]      (default: openwiki)
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

WIKI="${1:-openwiki}"
STATE="$WIKI/.wiki-state.json"

git rev-parse --git-dir >/dev/null 2>&1 || {
  echo "Not a git repository — drift detection unavailable." >&2; exit 2; }
[ -f "$STATE" ] || {
  echo "No state file at $STATE — run init mode first (or pass the right wiki dir)." >&2; exit 2; }

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 2; }

HEAD_SHA="$(git rev-parse HEAD)"
BASE_SHA="$(node -e '
  const s=require("fs").readFileSync(process.argv[1],"utf8");
  const j=JSON.parse(s);
  process.stdout.write((j.last_update&&j.last_update.sha)||(j.last_full_build&&j.last_full_build.sha)||"");
' "$STATE" 2>/dev/null)"

echo "# Drift report"
echo
echo "- **Wiki:** \`$WIKI\`"
echo "- **Recorded SHA:** \`${BASE_SHA:-<none>}\`"
echo "- **HEAD:** \`$HEAD_SHA\`"

if [ -z "$BASE_SHA" ]; then
  echo
  echo "State file records no SHA. Treat every page as unverified."
  exit 0
fi

if ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
  echo
  echo "Recorded SHA is not in this repository (force-push, shallow clone, or rewritten"
  echo "history). Cannot diff — fall back to reviewing pages against current source."
  exit 0
fi

DIRTY="$(git status --porcelain | sed 's/^...//' | grep -v "^$WIKI/" || true)"
CHANGED="$( { git diff --name-only "$BASE_SHA" HEAD; printf '%s\n' "$DIRTY"; } \
            | grep -v '^$' | grep -v "^$WIKI/" | sort -u )"

if [ "$HEAD_SHA" = "$BASE_SHA" ] && [ -z "$DIRTY" ]; then
  echo
  echo "## NO-OP"
  echo
  echo "HEAD matches the recorded SHA and the working tree is clean outside \`$WIKI/\`."
  echo "**Change nothing.** Report the no-op and stop — unless the user explicitly asked"
  echo "for a specific page to be refreshed."
  exit 0
fi

if [ -z "$CHANGED" ]; then
  echo
  echo "## NO-OP"
  echo
  echo "All changes since the recorded SHA are inside \`$WIKI/\` itself. **Change nothing.**"
  exit 0
fi

NCHANGED="$(printf '%s\n' "$CHANGED" | grep -c . || true)"
echo "- **Changed source files:** $NCHANGED"
echo
case "$NCHANGED" in
  [1-4])   echo "- **Diff budget:** touch at most **1–2** wiki pages." ;;
  [5-9]|1[0-5]) echo "- **Diff budget:** touch at most **3–4** wiki pages." ;;
  *)       echo "- **Diff budget:** large change — re-plan before editing; a new page or a merge may be warranted." ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf '%s\n' "$CHANGED" | node "$SCRIPT_DIR/drift-map.mjs" "$STATE" "$WIKI" "$HEAD_SHA"
