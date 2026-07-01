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
          { text: '2026-07-01', link: '/daily/2026-07-01' }
        ]
      },
      {
        text: 'Project Plans',
        collapsed: false,
        items: [
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
