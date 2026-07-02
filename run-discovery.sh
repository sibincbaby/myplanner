#!/usr/bin/env bash
set -euo pipefail

cd /home/sibin/my-works/myplanner

git pull git@github-personal:sibincbaby/myplanner.git master 2>&1

DATE=$(date +%Y-%m-%d)

# Skip if today's digest already exists
if [ -f "docs/daily/$DATE.md" ]; then
  echo "[$DATE] Digest already exists, skipping"
  exit 0
fi

/home/sibin/.local/bin/claude --dangerously-skip-permissions -p "
You are the daily AI project discovery agent. Today's date is $DATE. Repo is at /home/sibin/my-works/myplanner.

Your job: run the full discovery pipeline and commit results.

Step 1 — Read state/seen.json. It's a JSON array of {url, title, date_seen}. Extract all URLs as a dedup list.

Step 2 — Discovery. Search broadly for NEW AI/agent/automation projects from the last 24-48 hours using WebSearch and WebFetch. Cover:
- GitHub trending (AI/LLM/agent/MCP topics)
- Hacker News (Show HN, new AI tools)
- Reddit (r/LocalLLaMA, r/ClaudeAI, r/SideProject)
- Product Hunt (AI category)
- X/Twitter AI builder communities

User interest profile:
- Claude/LLM tooling: CLI tools, extensions, wrappers
- Agent UIs: custom agent interfaces
- Dev productivity: coding assistants, voice tools, diary/logging
- Personal finance AI: expense tracking, budget analysis
- Flutter/web AI apps: mobile-first AI-powered tools

Score interest_score 0-4 (one point per interest area). Collect 8-10 candidates with interest_score >= 2. Skip URLs already in seen.json.

Step 3 — Viability. Score each candidate on 4 criteria (0 or 1 each):
1. weekend_buildable: Clear MVP in 1-2 Claude sessions
2. fills_gap: Fills a real gap in user's toolkit
3. novel: Not a polished widely-used OSS clone
4. daily_utility: User would use it every day
Viable = total >= 3. Be strict — most should score 2.

Step 4 — Planning (viable only). For each viable project write a Claude-executable implementation plan: stack, MVP scope, 3-5 phases, effort estimate, blockers.

Step 5 — Write files:
- docs/daily/$DATE.md with candidates table and viable project links
- docs/projects/$DATE-<slug>.md for each viable project
- Update state/seen.json: append {url, title, date_seen: '$DATE'} for ALL candidates
- Update docs/.vitepress/config.ts sidebar (list docs/daily/ and docs/projects/ newest first)

Step 6 — Commit:
git add -A
git commit -m 'chore: daily discovery $DATE — N viable project(s)'
" 2>&1

git push git@github-personal:sibincbaby/myplanner.git master 2>&1
echo "[$DATE] Done"
