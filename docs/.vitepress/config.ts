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
        items: [
          { text: '2026-07-02', link: '/daily/2026-07-02' },
          { text: '2026-07-01', link: '/daily/2026-07-01' }
        ]
      },
      {
        text: 'Project Plans',
        collapsed: false,
        items: [
          { text: 'expense-budget-tracker — Finance + AI SQL API', link: '/projects/2026-07-02-expense-budget-tracker' },
          { text: 'natively — AI Meeting Assistant', link: '/projects/2026-07-02-natively' },
          { text: 'claudish — Claude Code × 580 Models', link: '/projects/2026-07-02-claudish' },
          { text: 'agentic-tools-mcp — Task + Memory MCP', link: '/projects/2026-07-02-agentic-tools-mcp' },
          { text: 'private-agent — Flutter Android Agent', link: '/projects/2026-07-02-private-agent' },
          { text: 'agent-teams-ai', link: '/projects/2026-07-01-agent-teams-ai' },
          { text: 'CloudCLI — Claude Code Mobile UI', link: '/projects/2026-07-01-cloudcli-claude-code-mobile-ui' },
          { text: 'Moodiary — Flutter AI Diary', link: '/projects/2026-07-01-moodiary' },
          { text: 'OpenKnowledge — AI Markdown Wiki', link: '/projects/2026-07-01-openknowledge' }
        ]
      }
    ],
    socialLinks: [],
    search: { provider: 'local' }
  }
})
