#!/usr/bin/env bash
# Install the wiki-build skill into a target repository.
#
#   bash install.sh /path/to/target/repo
#
# Lays down the canonical copy at .agents/skills/wiki-build/ (read natively by Copilot,
# Antigravity, Codex and Gemini CLI), a pointer at .claude/skills/ for Claude Code, and
# the Antigravity workflow. Existing files are backed up, never silently overwritten.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo "usage: bash install.sh /path/to/target/repo" >&2
  exit 1
fi
[ -d "$TARGET" ] || { echo "not a directory: $TARGET" >&2; exit 1; }
TARGET="$(cd "$TARGET" && pwd)"

if [ "$TARGET" = "$(cd "$SRC/../../.." && pwd)" ]; then
  echo "Target is the skill's own repository — nothing to do." >&2
  exit 0
fi

STAMP="$(date +%Y%m%d%H%M%S)"
backup() { [ -e "$1" ] && { mv "$1" "$1.bak.$STAMP"; echo "  backed up existing → $(basename "$1").bak.$STAMP"; }; return 0; }

echo "Installing wiki-build → $TARGET"

# 1. Canonical copy.
mkdir -p "$TARGET/.agents/skills"
backup "$TARGET/.agents/skills/wiki-build"
cp -R "$SRC" "$TARGET/.agents/skills/wiki-build"
rm -f "$TARGET/.agents/skills/wiki-build/install.sh"
chmod +x "$TARGET/.agents/skills/wiki-build/scripts/"*.sh \
         "$TARGET/.agents/skills/wiki-build/scripts/"*.mjs 2>/dev/null || true
echo "  .agents/skills/wiki-build/            (canonical)"

# 2. Claude Code pointer — the one host that does not read .agents/skills.
mkdir -p "$TARGET/.claude/skills/wiki-build"
backup "$TARGET/.claude/skills/wiki-build/SKILL.md"
POINTER_SRC="$(cd "$SRC/../../.." && pwd)/.claude/skills/wiki-build/SKILL.md"
if [ -f "$POINTER_SRC" ]; then
  cp "$POINTER_SRC" "$TARGET/.claude/skills/wiki-build/SKILL.md"
else
  # Regenerate the pointer if this copy of the skill was installed without it.
  {
    sed -n '1,/^---$/p' "$SRC/SKILL.md" | sed -n '1,/^---$/p'
    cat <<'EOF'

# wiki-build (pointer)

The canonical skill lives at `.agents/skills/wiki-build/`.

**Read `.agents/skills/wiki-build/SKILL.md` now and follow it.** Its relative links to
`references/` and `scripts/` resolve from that directory.

Do not duplicate guidance here — this file is a pointer only.
EOF
  } > "$TARGET/.claude/skills/wiki-build/SKILL.md"
fi
echo "  .claude/skills/wiki-build/SKILL.md    (Claude Code pointer)"

# 3. Antigravity workflow / slash command.
mkdir -p "$TARGET/.agents/workflows"
WF_SRC="$(cd "$SRC/../../.." && pwd)/.agents/workflows/wiki-build.md"
if [ -f "$WF_SRC" ]; then
  backup "$TARGET/.agents/workflows/wiki-build.md"
  cp "$WF_SRC" "$TARGET/.agents/workflows/wiki-build.md"
  echo "  .agents/workflows/wiki-build.md       (Antigravity /wiki-build)"
fi

echo
echo "Done. Verify with: ask your agent \"what skills do you have available?\""
echo "Then run it:       \"build a wiki for this codebase\""
