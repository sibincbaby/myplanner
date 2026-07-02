#!/usr/bin/env bash
set -euo pipefail

cd /home/sibin/my-works/myplanner

git pull git@github-personal:sibincbaby/myplanner.git master 2>&1

DATE=$(date +%Y-%m-%d)

# Skip if today's idea digest already exists
if [ -f "docs/ideas/$DATE.md" ]; then
  echo "[$DATE] Idea digest already exists, skipping"
  exit 0
fi

# ponytail: inline the pipeline as a headless -p prompt (same pattern as run-discovery.sh).
# A background Workflow() inside `claude -p` gets killed when the process exits, so we drive
# the pipeline directly. The canonical Workflow lives at .claude/workflows/ai-operator-ideas.js
# for cloud/manual runs.
/home/sibin/.local/bin/claude --dangerously-skip-permissions -p "
You are the daily AI-operator idea discovery agent. Today's date is $DATE. Repo is at /home/sibin/my-works/myplanner.

GOAL: find STARTUP/PROJECT IDEAS of one shape — take an app that is genuinely powerful and feature-rich but that ordinary users bounce off of because the UI/config/learning-curve is too hard, and bolt on an AI natural-language 'operator' layer (AI is pre-loaded with skills to drive the app; the user just talks in plain language and the AI performs the actions).

Step 1 — Read state/idea-seen.json (a JSON array of {app, date_seen}; treat missing/invalid as []). Extract all app names as a do-not-repeat list.

Step 2 — Scout across these domains (spawn parallel Task subagents, one per domain, for speed):
- Self-hosted/homelab/smart-home (Home Assistant, Nextcloud, Jellyfin, Paperless-ngx, Immich, Proxmox)
- Developer/ops dashboards (Grafana, Kibana, Prometheus, Airflow, Kubernetes, Jenkins, Wireshark)
- SMB/business software (Odoo, ERPNext, SuiteCRM, Dolibarr, GnuCash, invoicing) — SKIP personal expense/budget managers, that space is taken
- Creative/media (Blender, GIMP, DaVinci Resolve, Audacity, Inkscape, FFmpeg, OBS)
- Productivity/PKM (Obsidian+plugins, Logseq, Anki, Zotero, Joplin, Org-mode)
- Data/analytics/spreadsheet power-features (Metabase, Superset, Excel pivots/formulas, DBeaver, pandas)
- Workflow automation (n8n, Node-RED, HA automations, NiFi, rule engines)
- Niche power tools (tax software, DAWs, FreeCAD, QGIS, Cura/PrusaSlicer, Calibre, Strava analysis)

For each candidate capture: app, open-source?, why powerful, the SPECIFIC usability wall, a concrete AI-operator concept, one vivid 'user says X → AI does Y' example, integration path (REST API / CLI / scriptable / plugin), buildability 1-5, demand 1-5. Skip any app already in idea-seen.json. Favor apps with a real programmatic surface and pain felt by many.

Step 3 — Synthesize: dedup, drop weak/vague ones and any personal expense/budget manager, rank best-first by demand × buildability × strength-of-fit. Keep the top ~10-12.

Step 4 — Write files:
- docs/ideas/$DATE.md: a summary table (rank, app, OSS/closed, demand, buildability, domain) followed by one detail card per idea (why powerful, why people bounce off, AI operator, killer example, integration path, scores).
- Append {app, date_seen: '$DATE'} for every idea to state/idea-seen.json (create as [] if missing).

Step 5 — Commit:
cd /home/sibin/my-works/myplanner && git add -A && git commit -m 'chore: ai-operator ideas $DATE — N new'
" 2>&1

git push git@github-personal:sibincbaby/myplanner.git master 2>&1
echo "[$DATE] Done"
