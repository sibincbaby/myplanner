export const meta = {
  name: 'ai-operator-ideas',
  description: 'Daily discovery of powerful-but-hard-to-use apps where an AI natural-language operator layer would unlock them',
  phases: [
    { title: 'Scout', detail: 'one agent per app domain hunts feature-rich-but-unusable apps' },
    { title: 'Synthesize', detail: 'dedup vs seen, score, rank the best AI-operator bets' },
    { title: 'Write', detail: 'write digest md, update seen, commit' },
  ],
}

// ponytail: workflow scripts can't call Date.now(); when the caller omits the date, derive it
// from the shell so filenames/commits are never the placeholder 'no-date-provided'.
const DATE = args?.date ?? (await agent(
  `Run the command \`date +%F\` and return ONLY its output (a YYYY-MM-DD date), nothing else.`,
  { label: 'today', effort: 'low' }
)).trim()
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
          domain: { type: 'string' },
        },
      },
    },
  },
}

// Rotating domain pool — the daily prompt tells scouts to favor FRESH apps not in `seen`,
// so the same 8 domains keep yielding new candidates day over day.
// Biased toward mainstream/universal software with huge install bases (everyone/every
// business already has it) over niche self-hosted/OSS power-user tools.
const DOMAINS = [
  { key: 'office', prompt: 'Mainstream office & productivity suites nearly everyone has but few master (Excel/Google Sheets advanced formulas, pivot tables, macros/VBA/Office Scripts; Word/Docs mail-merge & styles; PowerPoint/Slides; Outlook/Gmail rules & filters).' },
  { key: 'crm-sales', prompt: 'CRM & sales platforms with massive install bases but brutal admin/config UIs (Salesforce, HubSpot, Zoho CRM, Pipedrive, Dynamics 365).' },
  { key: 'creative-pro', prompt: 'Industry-standard creative tools nearly every studio/freelancer uses but few master fully (Adobe Photoshop, Premiere Pro, After Effects, Illustrator; Figma advanced features; Canva Pro).' },
  { key: 'finance-erp', prompt: 'Widely-used accounting/finance/ERP software (QuickBooks, Xero, NetSuite, SAP Business One, Excel financial modeling). SKIP personal expense/budget managers — that space is taken.' },
  { key: 'project-collab', prompt: 'Enterprise project/ticketing/collab tools nearly every company runs on (Jira, Confluence, ServiceNow, Asana, Monday.com, Notion).' },
  { key: 'marketing-commerce', prompt: 'Popular e-commerce & marketing platforms with deep feature sets (Shopify, WooCommerce, Klaviyo, Mailchimp, Google Ads/Meta Ads Manager).' },
  { key: 'data-bi', prompt: 'Mainstream data/BI tools used company-wide but only power users master (Power BI, Tableau, Looker, Excel Power Query/pivots).' },
  { key: 'devops-mainstream', prompt: 'Widely-adopted dev/ops platforms with deep dashboards nearly every eng org uses (GitHub/GitLab admin & Actions, Datadog, AWS/Azure/GCP consoles, Jenkins).' },
]

phase('Scout')

// ponytail: caller can pass the app-name list directly; the read-seen agent step has a known
// habit of silently returning "[]", which disables dedup for the whole run.
const seenRaw = args?.seen
  ? JSON.stringify(args.seen)
  : await agent(
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
3. Rank survivors best-first by demand × buildability × strength-of-fit (how naturally an NL operator beats the existing UI). Return the TOP 12 ONLY — drop the rest.
4. Keep ALL useful fields including each idea's \`domain\`; sharpen the killerExample for the top ~8 so it's genuinely compelling.

Return the final ranked list in the same schema.`,
  { label: 'synthesize', phase: 'Synthesize', schema: IDEA_SCHEMA, effort: 'high' }
)

// ponytail: hard cap — the synthesize agent has returned 24 despite being told to trim
const ideas = (ranked?.ideas ?? []).slice(0, 12)

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
