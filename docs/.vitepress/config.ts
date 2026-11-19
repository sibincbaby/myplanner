import { defineConfig, type DefaultTheme } from 'vitepress'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

// Every sidebar is generated from the files on disk, so the daily routines never need to edit this file.
const dir = (d: string) => new URL(`../${d}/`, import.meta.url)
// Page slugs in docs/<d>, newest first
const pages = (d: string) =>
  (existsSync(dir(d)) ? readdirSync(dir(d)) : []).filter((f) => f.endsWith('.md') && f !== 'index.md').map((f) => f.slice(0, -3)).sort().reverse()
// "agent-teams-ai — Multi-Agent Kanban" -> "agent-teams-ai"; falls back to the slug
const title = (d: string, slug: string) => {
  const h1 = /^# (.+)$/m.exec(readFileSync(new URL(`${slug}.md`, dir(d)), 'utf8'))?.[1]
  return (h1 ?? slug.slice(11).replace(/-/g, ' ')).split(/ [—–-] /)[0].trim()
}
const MONTH = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
// One collapsible group per month; the newest month starts open
const byMonth = (d: string, label: (slug: string) => string): DefaultTheme.SidebarItem[] => {
  const groups = new Map<string, DefaultTheme.SidebarItem[]>()
  for (const slug of pages(d)) {
    const ym = slug.slice(0, 7)
    groups.set(ym, [...(groups.get(ym) ?? []), { text: label(slug), link: `/${d}/${slug}` }])
  }
  return [...groups].map(([ym, items], i) => ({ text: MONTH(ym), collapsed: i > 0, items }))
}
const day = (slug: string) => new Date(`${slug}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const daily = pages('daily')
const ideas = pages('ideas')

export default defineConfig({
  title: 'AI Discovery',
  description: 'Daily AI project discovery dashboard',
  head: [['meta', { name: 'theme-color', content: '#f7f8fa' }]],
  markdown: {
    // AI-written digests contain literal <TAGS> and {{...}}; treat both as text, not HTML/Vue
    html: false,
    // Single newlines in AI-written reports are meant as line breaks
    breaks: true,
    config: (md) => {
      for (const rule of ['text', 'code_inline'] as const) {
        const orig = md.renderer.rules[rule]!
        md.renderer.rules[rule] = (...args) => orig(...args).replace(/{{/g, '&#123;&#123;')
      }
    }
  },
  themeConfig: {
    nav: [
      { text: 'Discovery', link: `/daily/${daily[0]}`, activeMatch: '^/(daily|projects)/' },
      { text: 'Ideas', link: `/ideas/${ideas[0]}`, activeMatch: '^/ideas/' },
      { text: 'Hardware', link: '/hardware-revival/', activeMatch: '^/hardware-revival/' }
    ],
    // Each feed shows only its own pages
    sidebar: {
      '/daily/': [
        { text: 'Project plans', link: `/projects/${pages('projects')[0]}` },
        ...byMonth('daily', day)
      ],
      '/projects/': [
        { text: 'Daily digests', link: `/daily/${daily[0]}` },
        ...byMonth('projects', (slug) => title('projects', slug))
      ],
      '/ideas/': byMonth('ideas', day),
      '/hardware-revival/': [
        {
          text: 'Hardware revival',
          items: [
            { text: 'Overview', link: '/hardware-revival/' },
            { text: 'India watchlist', link: '/hardware-revival/watchlist' },
            { text: 'Research log', link: '/hardware-revival/research-log' }
          ]
        },
        ...byMonth('hardware-revival/reports', day)
      ]
    },
    outline: { level: [2, 3], label: 'On this page' },
    docFooter: { prev: 'Newer', next: 'Older' },
    socialLinks: [],
    search: { provider: 'local' }
  }
})
