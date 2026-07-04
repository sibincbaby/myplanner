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
          { text: '2026-07-05', link: '/daily/2026-07-05' },
          { text: '2026-07-03', link: '/daily/2026-07-03' },
          { text: '2026-07-02', link: '/daily/2026-07-02' },
          { text: '2026-07-01', link: '/daily/2026-07-01' }
        ]
      },
      {
        text: 'Project Plans',
        collapsed: false,
        items: [
          { text: 'Wikix', link: '/projects/2026-07-03-wikix' },
          { text: 'Kojo', link: '/projects/2026-07-03-kojo' },
          { text: 'Calstakk', link: '/projects/2026-07-03-calstakk' },
          { text: 'Apparat', link: '/projects/2026-07-03-apparat' },
          { text: 'Private Agent', link: '/projects/2026-07-02-private-agent' },
          { text: 'Natively', link: '/projects/2026-07-02-natively' },
          { text: 'Expense Budget Tracker', link: '/projects/2026-07-02-expense-budget-tracker' },
          { text: 'Claudish', link: '/projects/2026-07-02-claudish' },
          { text: 'Agentic Tools Mcp', link: '/projects/2026-07-02-agentic-tools-mcp' },
          { text: 'Openknowledge', link: '/projects/2026-07-01-openknowledge' },
          { text: 'Moodiary', link: '/projects/2026-07-01-moodiary' },
          { text: 'Cloudcli Claude Code Mobile Ui', link: '/projects/2026-07-01-cloudcli-claude-code-mobile-ui' },
          { text: 'Agent Teams Ai', link: '/projects/2026-07-01-agent-teams-ai' }
        ]
      }
    ],
    socialLinks: [],
    search: { provider: 'local' }
  }
})
