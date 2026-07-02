export const meta = {
  name: 'ai-operator-ideas',
  description: 'Daily discovery of powerful-but-hard-to-use apps where an AI natural-language operator layer would unlock them',
  phases: [
    { title: 'Scout', detail: 'one agent per app domain hunts feature-rich-but-unusable apps' },
    { title: 'Synthesize', detail: 'dedup vs seen, score, rank the best AI-operator bets' },
    { title: 'Write', detail: 'write digest md, update seen, commit' },
  ],
}

const DATE = args?.date ?? 'no-date-provided'
// ponytail: repoRoot passed by caller so this works in both local and cloud environments
const REPO_ROOT = args?.repoRoot ?? '/home/sibin/my-works/myplanner'

const IDEA_SCHEMA = {
  type: 'object',
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        required: ['app', 'openSource', 'hardBecause', 'aiOperator', 'killerExample', 'integrationPath', 'buildability', 'demand'],
        properties: {
          app: { type: 'string' },
          openSource: { type: 'boolean' },
          powerfulBecause: { type: 'string' },
          hardBecause: { type: 'string' },
          aiOperator: { type: 'string' },
          killerExample: { type: 'string' },
          integrationPath: { type: 'string' },
          buildability: { type: 'integer', minimum: 1, maximum: 5 },
          demand: { type: 'integer', minimum: 1, maximum: 5 },
        },
      },
    },
  },
}

// Rotating domain pool — the daily prompt tells scouts to favor FRESH apps not in `seen`,
// so the same 8 domains keep yielding new candidates day over day.
const DOMAINS = [
  { key: 'homelab', prompt: 'Self-hosted / homelab / smart-home tools (Home Assistant, Nextcloud, Jellyfin, Paperless-ngx, Immich, pfSense, Proxmox). Power buried under complex config.' },
  { key: 'devtools', prompt: 'Developer & ops tools with steep dashboards (Grafana, Kibana, Prometheus, Airflow, Kubernetes dashboards, Jenkins, Elasticsearch DSL, Wireshark).' },
  { key: 'business', prompt: 'SMB / business software powerful but overwhelming (Odoo, ERPNext, SuiteCRM, Dolibarr, GnuCash, invoicing/accounting). SKIP personal expense/budget managers — that space is taken.' },
  { key: 'creative', prompt: 'Creative & media tools with brutal learning curves (Blender, GIMP, DaVinci Resolve, Audacity, Inkscape, FFmpeg, ImageMagick, Krita, OBS Studio).' },
  { key: 'productivity', prompt: 'Productivity / PKM / knowledge tools where features overwhelm (Obsidian + plugins, Logseq, Anki, Zotero, Joplin, Org-mode, advanced task/calendar tools).' },
  { key: 'data', prompt: 'Data, analytics & spreadsheet power-features people never learn (Metabase, Superset, Excel/LibreOffice pivots & formulas, SQL clients like DBeaver, pandas).' },
  { key: 'automation', prompt: 'Workflow-automation / no-code-but-actually-hard tools (n8n, Node-RED, HA automations, Apache NiFi, rule engines, cron/systemd).' },
  { key: 'niche', prompt: 'Niche-but-widely-needed power tools ordinary people struggle with (tax software, DAWs like Ardour, CAD like FreeCAD, GIS like QGIS, 3D-print slicers Cura/PrusaSlicer, Calibre, Strava analysis).' },
]

phase('Scout')

const seenRaw = await agent(
  `Read ${REPO_ROOT}/state/idea-seen.json and return its raw JSON content as a plain string. If missing or invalid, return "[]". Return ONLY the JSON string.`,
  { label: 'read-seen', effort: 'low' }
)

const scouted = await parallel(DOMAINS.map(d => () =>
  agent(
    `You are hunting for STARTUP/PROJECT IDEAS of one specific shape: take an app that is genuinely powerful and feature-rich, but that ordinary users bounce off of because the UI/config/learning-curve is too hard — and bolt on an AI natural-language "operator" layer. The AI is pre-loaded with skills to drive the app; the user just talks in plain language and the AI performs the actions.

Domain to mine: ${d.prompt}

Date: ${DATE}. Surface 3-4 of the STRONGEST candidates. For each: name the app, whether it's open-source/self-hostable, why it's powerful, the SPECIFIC usability wall that makes people give up, a concrete AI-operator concept, one vivid "user says X → AI does Y" example, and the realistic integration path (REST API? CLI? scriptable/headless? plugin architecture?). Score buildability (solo-dev MVP feasibility) and demand 1-5.

ALREADY-COVERED apps (do NOT repeat these — find fresh ones): ${seenRaw}

Favor candidates with a real programmatic surface to drive and pain felt by many. Be concrete — no vague "add AI to X".`,
    { label: `scout:${d.key}`, phase: 'Scout', schema: IDEA_SCHEMA, effort: 'high' }
  ).then(r => (r?.ideas || []).map(i => ({ ...i, domain: d.key })))
)).then(rs => rs.filter(Boolean).flat())

log(`Scouted ${scouted.length} raw candidates`)

phase('Synthesize')

const ranked = await agent(
  `You are ranking AI-operator app ideas (a powerful-but-hard app + an AI natural-language layer that operates it).

Raw candidates gathered today:
${JSON.stringify(scouted, null, 2)}

Do this:
1. Merge duplicates/near-duplicates.
2. Drop weak ones: vague concepts, apps with no programmatic surface, trivially-low demand, and anything that is essentially a personal expense/budget manager (taken).
3. Rank survivors best-first by demand × buildability × strength-of-fit (how naturally an NL operator beats the existing UI).
4. Keep ALL useful fields; sharpen the killerExample for the top ~8 so it's genuinely compelling.

Return the final ranked list in the same schema.`,
  { label: 'synthesize', phase: 'Synthesize', schema: IDEA_SCHEMA, effort: 'high' }
)

const ideas = ranked?.ideas ?? []

phase('Write')

if (ideas.length === 0) {
  await agent(
    `Create directory ${REPO_ROOT}/docs/ideas if it does not exist. Write to ${REPO_ROOT}/docs/ideas/${DATE}.md:\n\n# AI-Operator Idea Digest — ${DATE}\n\nNo fresh ideas surfaced today (all candidates were already covered or too weak).\n\nThen run: cd ${REPO_ROOT} && git add ${REPO_ROOT}/docs/ideas/${DATE}.md && git commit -m "chore: ai-operator ideas ${DATE} — 0 new"`,
    { label: 'write-empty', phase: 'Write', effort: 'low' }
  )
} else {
  const rows = ideas.map((i, n) =>
    `| ${n + 1} | **${i.app}** | ${i.openSource ? 'OSS' : 'closed'} | ${i.demand}/5 | ${i.buildability}/5 | ${i.domain ?? '—'} |`
  ).join('\n')

  const cards = ideas.map((i, n) => `### ${n + 1}. ${i.app} ${i.openSource ? '`open-source`' : '`closed`'}

**Why it's powerful:** ${i.powerfulBecause ?? '—'}

**Why people bounce off it:** ${i.hardBecause}

**AI operator:** ${i.aiOperator}

**Killer example:** ${i.killerExample}

**Integration path:** ${i.integrationPath}

**Demand ${i.demand}/5 · Buildability ${i.buildability}/5**
`).join('\n---\n\n')

  const digest = `# AI-Operator Idea Digest — ${DATE}

Powerful-but-hard apps where a natural-language AI operator layer would unlock them.

| # | App | Type | Demand | Buildability | Domain |
|---|-----|------|--------|--------------|--------|
${rows}

---

${cards}`

  await agent(
    `Create directory ${REPO_ROOT}/docs/ideas if it does not exist. Write this EXACT content to ${REPO_ROOT}/docs/ideas/${DATE}.md:\n\n${digest}`,
    { label: 'write-digest', phase: 'Write', effort: 'low' }
  )

  const newSeen = ideas.map(i => ({ app: i.app, date_seen: DATE }))
  await agent(
    `Read ${REPO_ROOT}/state/idea-seen.json (treat missing/invalid as []). Parse as JSON array, append these entries: ${JSON.stringify(newSeen)}. Write back as pretty-printed JSON to ${REPO_ROOT}/state/idea-seen.json.`,
    { label: 'update-seen', phase: 'Write', effort: 'low' }
  )

  await agent(
    `Run: cd ${REPO_ROOT} && git add -A && git commit -m "chore: ai-operator ideas ${DATE} — ${ideas.length} new". Report the commit hash.`,
    { label: 'git-commit', phase: 'Write', effort: 'low' }
  )
}

return { count: ideas.length, ideas }
