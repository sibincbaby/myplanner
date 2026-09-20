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
          { text: '2026-09-20', link: '/daily/2026-09-20' }
        ]
      },
      {
        text: 'Project Plans',
        collapsed: false,
        items: [
          { text: 'Addyosmani Agent Skills', link: '/projects/2026-09-20-addyosmani-agent-skills' },
          { text: 'Leviai Ai Personal Finance Mcp', link: '/projects/2026-09-20-leviai-ai-personal-finance-mcp' },
          { text: 'Thedotmack Claude Mem', link: '/projects/2026-09-20-thedotmack-claude-mem' },
          { text: 'Cosinusalpha Webctl Cli Browser Automation For Agents', link: '/projects/2026-09-20-cosinusalpha-webctl-cli-browser-automation-for-agents' },
          { text: 'Affaan M Ecc Agent Performance Optimization', link: '/projects/2026-09-20-affaan-m-ecc-agent-performance-optimization' }
        ]
      }
    ],
    socialLinks: [],
    search: { provider: 'local' }
  }
})
