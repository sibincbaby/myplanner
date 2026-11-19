import DefaultTheme from 'vitepress/theme'
import { useRoute, inBrowser } from 'vitepress'
import { nextTick, onMounted, watch, type App } from 'vue'
import FeedHome from './FeedHome.vue'
import './style.css'

const feedOf = (p: string) =>
  p.startsWith('/daily/') || p.startsWith('/projects/') ? 'daily'
  : p.startsWith('/ideas/') ? 'ideas'
  : p.startsWith('/hardware-revival/') ? 'hardware' : ''

// Give every table cell its column name so phones can show each row as a card (see style.css).
const labelTables = () => {
  for (const table of document.querySelectorAll<HTMLTableElement>('.vp-doc table')) {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '')
    const rows = [...table.querySelectorAll('tbody tr')]
    // Ranked tables ("#" column): on phones the card title becomes "1. <second cell>"
    table.classList.toggle('ranked', rows.length > 0 && rows.every((tr) => /^\d+$/.test(tr.children[0]?.textContent?.trim() ?? '')))
    for (const tr of rows)
      [...tr.children].forEach((td, i) => td.setAttribute('data-label', heads[i] ?? ''))
  }
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: App }) {
    app.component('FeedHome', FeedHome)
  },
  setup() {
    const route = useRoute()
    const sync = () => {
      if (!inBrowser) return
      // The current feed's accent colour follows you around the site
      const feed = feedOf(route.path)
      if (feed) document.documentElement.dataset.feed = feed
      else delete document.documentElement.dataset.feed
      nextTick(labelTables)
    }
    onMounted(sync)
    watch(() => route.path, sync, { flush: 'post' })
  }
}
