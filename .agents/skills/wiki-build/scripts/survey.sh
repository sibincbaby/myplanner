#!/usr/bin/env bash
# Deterministic repo survey for the wiki-build skill.
# Emits a compact markdown map of an unfamiliar repository: shape, entrypoints,
# configs, dependencies, tests, schemas, existing docs, and churn hotspots.
#
# No LLM, no network. Usage:  bash survey.sh [repo_root] > survey.md
set -uo pipefail

ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 1; }

IS_GIT=0
git rev-parse --git-dir >/dev/null 2>&1 && IS_GIT=1

# Tracked files if git; else find minus common noise. This is the file universe
# for every section below, so .gitignore is respected for free in the git case.
list_files() {
  if [ "$IS_GIT" -eq 1 ]; then
    git ls-files
  else
    find . -type f \
      -not -path '*/.git/*' -not -path '*/node_modules/*' \
      -not -path '*/.venv/*' -not -path '*/venv/*' \
      -not -path '*/dist/*' -not -path '*/build/*' \
      -not -path '*/__pycache__/*' -not -path '*/target/*' \
      | sed 's|^\./||'
  fi
}

FILES="$(list_files)"
NFILES="$(printf '%s\n' "$FILES" | grep -c . || true)"

section() { printf '\n## %s\n\n' "$1"; }
# Print matching paths as a bullet list, or an explicit absence marker.
emit() {
  local out; out="$(cat)"
  if [ -n "$out" ]; then printf '%s\n' "$out" | sed 's/^/- /'; else echo "_none found_"; fi
}

printf '# Repository survey\n\n'
printf -- '- **Root:** `%s`\n' "$ROOT"
printf -- '- **Tracked files:** %s\n' "$NFILES"
if [ "$IS_GIT" -eq 1 ]; then
  printf -- '- **Branch:** `%s`\n' "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  printf -- '- **HEAD:** `%s`\n' "$(git rev-parse HEAD 2>/dev/null)"
  printf -- '- **Commits:** %s\n' "$(git rev-list --count HEAD 2>/dev/null)"
  printf -- '- **First commit:** %s\n' "$(git log --reverse --format=%as 2>/dev/null | head -1)"
  printf -- '- **Last commit:** %s\n' "$(git log -1 --format=%as 2>/dev/null)"
  printf -- '- **Contributors:** %s\n' "$(git log --format=%ae 2>/dev/null | sort -u | grep -c . || true)"
else
  printf -- '- **Not a git repository** — churn analysis and drift detection unavailable.\n'
fi

section "File types"
printf '%s\n' "$FILES" | sed -n 's/.*\.\([A-Za-z0-9]\{1,8\}\)$/\1/p' \
  | sort | uniq -c | sort -rn | head -15 \
  | awk '{printf "- `.%s` — %s\n", $2, $1}'

section "Top-level layout"
printf '%s\n' "$FILES" | awk -F/ 'NF>1{print $1"/"} NF==1{print "(root)"}' \
  | sort | uniq -c | sort -rn | head -20 \
  | awk '{printf "- `%s` — %s files\n", $2, $1}'

section "Second-level source layout"
printf '%s\n' "$FILES" | awk -F/ 'NF>2{print $1"/"$2"/"}' \
  | sort | uniq -c | sort -rn | head -25 \
  | awk '$1>1{printf "- `%s` — %s files\n", $2, $1}' \
  | { grep . || echo "_flat layout_"; }

section "Likely entrypoints"
printf '%s\n' "$FILES" | grep -Ei \
  '(^|/)(main|index|app|server|cli|__main__|entrypoint|bootstrap|program)\.[a-z]+$|(^|/)cmd/|(^|/)bin/' \
  | head -25 | emit

section "Build, run and deploy"
printf '%s\n' "$FILES" | grep -Ei \
  '(^|/)(Makefile|Justfile|Taskfile\.ya?ml|Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml|Procfile|\.dockerignore|Vagrantfile|CMakeLists\.txt|meson\.build)$' \
  | head -20 | emit

section "CI and automation"
printf '%s\n' "$FILES" | grep -Ei \
  '^\.github/workflows/|^\.gitlab-ci\.yml$|^\.circleci/|^azure-pipelines|^bitbucket-pipelines|^\.buildkite/|^Jenkinsfile' \
  | head -20 | emit

section "Dependency manifests"
printf '%s\n' "$FILES" | grep -Ei \
  '(^|/)(package\.json|pnpm-workspace\.ya?ml|requirements[^/]*\.txt|pyproject\.toml|Pipfile|setup\.py|go\.mod|Cargo\.toml|pom\.xml|build\.gradle[^/]*|Gemfile|composer\.json|mix\.exs|pubspec\.ya?ml|\.csproj)$' \
  | head -20 | emit

section "Configuration"
printf '%s\n' "$FILES" | grep -Ei \
  '(^|/)(\.env\.example|\.env\.sample|config[^/]*\.(json|ya?ml|toml|ini)|settings\.(py|json|ya?ml)|tsconfig[^/]*\.json|\.eslintrc[^/]*|ruff\.toml|\.editorconfig)$|^config/|^conf/' \
  | grep -v -i '\.env$' | head -25 | emit

section "Data models, schemas and migrations"
printf '%s\n' "$FILES" | grep -Ei \
  '(^|/)(migrations?|schemas?|models?|entities|prisma|db)/|\.(sql|prisma|graphql|gql|proto|avsc)$|(^|/)(schema|models?)\.[a-z]+$|openapi[^/]*\.(ya?ml|json)|swagger[^/]*\.(ya?ml|json)' \
  | head -30 | emit

section "Tests"
printf '%s\n' "$FILES" | grep -Ei \
  '(^|/)(tests?|spec|__tests__|e2e|integration)/|[._-](test|spec)\.[a-z]+$|(^|/)test_[^/]+\.py$|_test\.go$' \
  | head -20 | emit
printf '\nTotal test files: %s\n' \
  "$(printf '%s\n' "$FILES" | grep -Eci '(^|/)(tests?|spec|__tests__|e2e)/|[._-](test|spec)\.[a-z]+$|(^|/)test_[^/]+\.py$|_test\.go$' || true)"

section "Existing documentation"
printf '%s\n' "$FILES" | grep -Ei \
  '(^|/)(README|CONTRIBUTING|ARCHITECTURE|DESIGN|CHANGELOG|AGENTS|CLAUDE|ONBOARDING|RUNBOOK)[^/]*$|^docs?/|\.mdx?$' \
  | head -40 | emit

section "Scripts"
printf '%s\n' "$FILES" | grep -Ei '^(scripts?|tools|hack|ci)/|\.(sh|bash|ps1)$' | head -20 | emit

if [ "$IS_GIT" -eq 1 ]; then
  section "Churn hotspots (last 12 months)"
  echo "Most-changed tracked files. The best cheap proxy for where the complexity and"
  echo "the institutional knowledge live. Read these early."
  echo
  git log --since='12 months ago' --name-only --format='' 2>/dev/null \
    | grep -v '^$' | sort | uniq -c | sort -rn | head -25 \
    | while read -r n f; do
        [ -f "$f" ] && printf -- '- `%s` — %s commits\n' "$f" "$n"
      done | { grep . || echo "_no commits in window_"; }

  section "Recent commit subjects"
  git log -30 --format='- `%h` %s' 2>/dev/null | { grep . || echo "_none_"; }

  section "Active areas (last 90 days)"
  git log --since='90 days ago' --name-only --format='' 2>/dev/null \
    | grep -v '^$' | awk -F/ 'NF>1{print $1"/"$2} NF==1{print $1}' \
    | sort | uniq -c | sort -rn | head -15 \
    | awk '{printf "- `%s` — %s changes\n", $2, $1}' \
    | { grep . || echo "_no recent activity_"; }
fi

section "Next steps"
cat <<'EOF'
1. Read the entrypoints and the top churn hotspots first.
2. Then the schema/migration files — they define the domain vocabulary.
3. Then existing docs, to synthesize rather than duplicate.
4. Write `openwiki/_plan.md` before authoring any page.
EOF
