import { createContentLoader } from 'vitepress'

export interface Entry {
  feed: 'daily' | 'ideas' | 'hardware'
  date: string
  url: string
  stat: string
  lead: string
}

// Table rows of the first markdown table in a page, header and separator excluded.
const rows = (src: string) => {
  const t = src.split('\n').filter((l) => l.startsWith('|'))
  return t.slice(2).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
}
const plain = (s = '') => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim()
// Item names are often "Name - long description"; keep the name.
const shortName = (s: string) => plain(s).split(/ [-–—:] /)[0]

function summarize(feed: Entry['feed'], src: string): Pick<Entry, 'stat' | 'lead'> {
  if (feed === 'daily') {
    const r = rows(src)
    const viable = r.filter((c) => c.some((x) => x.includes('✅')))
    return {
      stat: r.length ? `${viable.length} of ${r.length} worth building` : 'No new candidates',
      lead: viable.map((c) => shortName(c[0])).join(', ')
    }
  }
  if (feed === 'ideas') {
    const r = rows(src).filter((c) => /^\d+$/.test(c[0]))
    return { stat: r.length ? `${r.length} ideas` : 'No new ideas', lead: r.slice(0, 3).map((c) => plain(c[1])).join(', ') }
  }
  const focus = /\*\*Focus:\*\*\s*([^·\n]+)/.exec(src)?.[1]?.trim() ?? ''
  const top = /^### (.+)$/m.exec(src)?.[1] ?? ''
  // "D Robotics / automation" -> "Robotics / automation"
  return { stat: focus ? plain(focus).replace(/^[A-G]\s+/, '') : 'Report', lead: plain(top) }
}

const feedOf = (url: string): Entry['feed'] =>
  url.startsWith('/daily/') ? 'daily' : url.startsWith('/ideas/') ? 'ideas' : 'hardware'

export default createContentLoader(['daily/*.md', 'ideas/*.md', 'hardware-revival/reports/*.md'], {
  includeSrc: true,
  transform: (pages) =>
    pages
      .map((p) => {
        const feed = feedOf(p.url)
        const date = /(\d{4}-\d{2}-\d{2})/.exec(p.url)?.[1] ?? ''
        return { feed, date, url: p.url, ...summarize(feed, p.src ?? '') } as Entry
      })
      .filter((e) => e.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60) // the home page only shows recent days; keeps the client payload small
})
