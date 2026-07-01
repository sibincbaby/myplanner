export const meta = {
  name: 'ai-discovery',
  description: 'Daily AI/agent project discovery — search, viability screen, generate plans, write to VitePress',
  phases: [
    { title: 'Discovery', detail: 'Search internet for new AI projects' },
    { title: 'Viability', detail: 'Score each candidate on 4 criteria' },
    { title: 'Planning', detail: 'Generate Claude-executable plans for viable projects' },
    { title: 'Write', detail: 'Write markdown files and commit' },
  ],
}

const DATE = args?.date ?? 'no-date-provided'
const REPO_ROOT = '/home/sibin/my-works/myplanner'

const INTEREST_PROFILE = `
Interest profile (from analysis of 168+ personal projects in ~/my-works):
- Claude/LLM tooling: CLI tools, extensions, wrappers around Claude and other LLMs
- Agent UIs: custom agent interfaces (openclaw, claw-desk, gravity-claw variants)
- Dev productivity: coding assistants, voice tools, diary/logging, redmine integrations
- Personal finance AI: expense tracking, budget analysis, card management tools
- Flutter + web AI apps: mobile-first AI-powered personal tools

EXECUTOR CONTEXT: Claude is the builder. Viability and planning are scoped to what
Claude can execute autonomously. No stack constraint.
`

phase('Discovery')

const DISCOVERY_SCHEMA = {
  type: 'object',
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'url', 'source', 'description', 'why_interesting', 'interest_score'],
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          source: { type: 'string' },
          description: { type: 'string' },
          why_interesting: { type: 'string' },
          interest_score: { type: 'number', minimum: 0, maximum: 4 }
        }
      }
    }
  }
}

const seenRaw = await agent(
  `Read the file ${REPO_ROOT}/state/seen.json and return its raw JSON content as a plain string. If the file is missing or contains invalid JSON, return the string "[]". Return ONLY the JSON string, nothing else.`,
  { label: 'read-seen', effort: 'low' }
)

const discovery = await agent(`
You are the Discovery Agent. Date: ${DATE}.

Search broadly across the internet for the NEWEST and most interesting AI/agent/automation projects that surfaced in the last 24-48 hours.

INTEREST PROFILE:
${INTEREST_PROFILE}

SEARCH STRATEGY:
- Determine the best currently-active sources yourself — do NOT use a fixed list. AI community activity shifts daily. Good source categories: code hosting platforms (trending sections), technical forums, developer social platforms, community aggregators, product launch platforms, AI-specific newsletters and communities.
- Search at least 5-6 distinctly different source types.
- Focus on NEWLY published or trending items, not evergreen popular projects.

WHAT TO FIND:
Projects and tools involving: LLMs, AI agents, MCP servers, Claude integrations, AI automation, AI productivity, AI finance, voice AI, coding assistants, agent UIs, multi-agent systems.

DEDUPLICATION:
Previously seen items (skip any URL from this list): ${seenRaw}

SCORING (interest_score = 0 to 4):
Count how many of the 5 interest areas above this project hits.
Only include candidates with interest_score >= 2.
Return top 8-10 candidates ranked by interest_score descending.
`, {
  label: 'discover',
  schema: DISCOVERY_SCHEMA,
  effort: 'high'
})

const candidates = discovery?.candidates ?? []
log(`Discovered ${candidates.length} candidates`)

if (candidates.length === 0) {
  await agent(
    `Create directory ${REPO_ROOT}/docs/daily if it does not exist. Then write this exact content to ${REPO_ROOT}/docs/daily/${DATE}.md:\n\n# Discovery Digest — ${DATE}\n\nNo new candidates found today. All discovered items were either previously seen or scored below the interest threshold (score < 2/4).\n\nAfter writing the file run: cd ${REPO_ROOT} && git add docs/daily/${DATE}.md && git commit -m "chore: daily digest ${DATE} — no new items"`,
    { label: 'write-empty-digest', effort: 'low' }
  )
} else {

phase('Viability')

const VIABILITY_SCHEMA = {
  type: 'object',
  required: ['url', 'title', 'scores', 'total', 'viable', 'reasoning'],
  properties: {
    url: { type: 'string' },
    title: { type: 'string' },
    scores: {
      type: 'object',
      required: ['weekend_buildable', 'fills_gap', 'novel', 'daily_utility'],
      properties: {
        weekend_buildable: { type: 'number', minimum: 0, maximum: 1 },
        fills_gap: { type: 'number', minimum: 0, maximum: 1 },
        novel: { type: 'number', minimum: 0, maximum: 1 },
        daily_utility: { type: 'number', minimum: 0, maximum: 1 }
      }
    },
    total: { type: 'number', minimum: 0, maximum: 4 },
    viable: { type: 'boolean' },
    reasoning: { type: 'string' }
  }
}

const viabilityResults = await parallel(candidates.map(c => () =>
  agent(`
Score this project's viability for the user to build with Claude's help.

Title: ${c.title}
URL: ${c.url}
Description: ${c.description}

${INTEREST_PROFILE}

SCORING CRITERIA (0 or 1 each):
1. weekend_buildable: Clear MVP achievable in 1-2 Claude Code sessions. Score 0 if months of work or requires specialized infra.
2. fills_gap: Fills a real gap in user's existing toolkit. Score 0 if they almost certainly have an equivalent already.
3. novel: Not already a widely-used polished open-source tool. Score 0 if a popular mature equivalent exists.
4. daily_utility: User would genuinely use this every single day. Score 0 if niche or occasional use.

viable = true when total >= 3.
Write 2-3 sentences of reasoning.
`, {
    label: `viability:${c.title.slice(0, 25)}`,
    schema: VIABILITY_SCHEMA,
    phase: 'Viability',
    effort: 'medium'
  })
))

const scored = viabilityResults.filter(Boolean)
const viable = scored.filter(v => v.viable)
log(`Viability: ${viable.length}/${scored.length} passed`)

phase('Planning')

const planResults = viable.length > 0
  ? await parallel(viable.map((v, idx) => () => {
      const c = candidates.find(c => c.url === v.url) ?? candidates[idx]
      return agent(`
Write a Claude-executable implementation plan for this project.

Project: ${v.title}
URL: ${v.url}
Description: ${c?.description ?? ''}
Why interesting: ${c?.why_interesting ?? ''}
Viability assessment: ${v.reasoning}

${INTEREST_PROFILE}

Write in markdown with these sections:
## Overview
## Stack Recommendation
## MVP Scope
## Implementation Phases (3-5 phases, each with Goal/Files/Key steps/Verify)
## Estimated Effort (in Claude sessions, 1 session = 2-4 hours of Claude work)
## Potential Blockers

Be specific: name actual files, commands, libraries. Claude executes this directly.
`, {
        label: `plan:${v.title.slice(0, 25)}`,
        phase: 'Planning',
        effort: 'high'
      })
    }))
  : []

const successfulPlans = planResults.filter(Boolean)
log(`Planning: ${successfulPlans.length}/${viable.length} plans generated`)

phase('Write')

const tableRows = scored.map(v => {
  const c = candidates.find(c => c.url === v.url)
  const slug = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const viableCell = v.viable
    ? `✅ [Plan](../projects/${DATE}-${slug}.md)`
    : '❌'
  return `| [${v.title}](${v.url}) | ${c?.source ?? '—'} | ${v.scores.weekend_buildable}/${v.scores.fills_gap}/${v.scores.novel}/${v.scores.daily_utility} | ${v.total}/4 | ${viableCell} |`
}).join('\n')

const viableListMd = viable.length > 0
  ? viable.map(v => {
      const slug = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return `- **[${v.title}](../projects/${DATE}-${slug}.md)** — ${v.reasoning}`
    }).join('\n')
  : '_No projects passed the viability threshold today (required: ≥ 3/4 criteria)._'

const digestMd = `# Discovery Digest — ${DATE}\n\n## Candidates Screened\n\n| Project | Source | WB/FG/N/DU | Score | Viable |\n|---------|--------|-----------|-------|--------|\n${tableRows}\n\n_WB = Weekend-buildable · FG = Fills-gap · N = Novel · DU = Daily-utility_\n\n## Viable Projects\n\n${viableListMd}\n`

const projectFiles = viable.map((v, i) => {
  const c = candidates.find(c => c.url === v.url)
  const plan = successfulPlans[i] ?? '_Plan generation failed — will retry tomorrow._'
  const slug = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return {
    slug,
    path: `${REPO_ROOT}/docs/projects/${DATE}-${slug}.md`,
    content: `# ${v.title}\n\n**Source:** <${v.url}>\n**Discovered:** ${DATE}\n**Viability:** ${v.total}/4\n\n> ${c?.why_interesting ?? ''}\n\n## Viability Scores\n\n| Criterion | Score |\n|-----------|-------|\n| Weekend-buildable | ${v.scores.weekend_buildable}/1 |\n| Fills a gap | ${v.scores.fills_gap}/1 |\n| Novel | ${v.scores.novel}/1 |\n| Daily utility | ${v.scores.daily_utility}/1 |\n| **Total** | **${v.total}/4** |\n\n${v.reasoning}\n\n---\n\n## Implementation Plan\n\n${plan}\n`
  }
})

const newSeen = candidates.map(c => ({ url: c.url, title: c.title, date_seen: DATE }))

await parallel([
  () => agent(
    `Create directory ${REPO_ROOT}/docs/daily if it does not exist. Write this exact content to ${REPO_ROOT}/docs/daily/${DATE}.md:\n\n${digestMd}`,
    { label: 'write-digest', phase: 'Write', effort: 'low' }
  ),
  ...projectFiles.map(f => () => agent(
    `Create directory ${REPO_ROOT}/docs/projects if it does not exist. Write this exact content to ${f.path}:\n\n${f.content}`,
    { label: `write-project:${f.slug}`, phase: 'Write', effort: 'low' }
  ))
])

await agent(
  `Read ${REPO_ROOT}/state/seen.json. Parse as JSON array. Append these entries: ${JSON.stringify(newSeen)}. Write the updated array back to ${REPO_ROOT}/state/seen.json as pretty-printed JSON.`,
  { label: 'update-seen', phase: 'Write', effort: 'low' }
)

await agent(`
Regenerate ${REPO_ROOT}/docs/.vitepress/config.ts with an updated sidebar.

Steps:
1. List all .md files in ${REPO_ROOT}/docs/daily/ sorted newest first by filename
2. List all .md files in ${REPO_ROOT}/docs/projects/ sorted newest first by filename
3. Write the complete config.ts:

import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AI Discovery',
  description: 'Daily AI project discovery dashboard',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Daily', link: '/daily/' },
      { text: 'Projects', link: '/projects/' }
    ],
    sidebar: [
      {
        text: 'Daily Digests',
        items: [ /* one per daily file: { text: 'YYYY-MM-DD', link: '/daily/YYYY-MM-DD' } */ ]
      },
      {
        text: 'Project Plans',
        collapsed: false,
        items: [ /* one per project file: { text: 'title from filename', link: '/projects/YYYY-MM-DD-slug' } */ ]
      }
    ],
    socialLinks: [],
    search: { provider: 'local' }
  }
})

For project item text: strip the date prefix and convert hyphens to spaces, title-case the result.
`, { label: 'update-sidebar', phase: 'Write', effort: 'low' })

await agent(
  `Run: cd ${REPO_ROOT} && git add -A && git commit -m "chore: daily discovery ${DATE} — ${viable.length} viable project(s)". Report the commit hash.`,
  { label: 'git-commit', phase: 'Write', effort: 'low' }
)

log(`Done — digest + ${projectFiles.length} project plan(s) committed`)

} // end candidates.length > 0
