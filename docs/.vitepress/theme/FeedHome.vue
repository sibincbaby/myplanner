<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { data as entries, type Entry } from '../../feeds.data'

const FEEDS: Record<Entry['feed'], { name: string; about: string }> = {
  daily: { name: 'Discovery', about: 'New AI and agent projects, screened for what’s worth building' },
  ideas: { name: 'Ideas', about: 'Hard-to-use apps an AI operator could unlock' },
  hardware: { name: 'Hardware', about: 'Devices worth unlocking, reflashing or buying used' }
}
const ORDER = Object.keys(FEEDS) as Entry['feed'][]

const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', opts)

const latest = computed(() => ORDER.map((f) => entries.find((e) => e.feed === f)).filter(Boolean) as Entry[])
const newest = computed(() => entries[0]?.date)

// Everything except each feed's latest, grouped by day, newest first.
const earlier = computed(() => {
  const shown = new Set(latest.value.map((e) => e.url))
  const days = new Map<string, Entry[]>()
  for (const e of entries) {
    if (shown.has(e.url)) continue
    days.set(e.date, [...(days.get(e.date) ?? []), e])
  }
  return [...days].slice(0, 10).map(([date, list]) => ({
    date,
    list: list.sort((a, b) => ORDER.indexOf(a.feed) - ORDER.indexOf(b.feed))
  }))
})
</script>

<template>
  <main class="fh">
    <header class="fh-head">
      <h1 v-if="newest">{{ fmt(newest, { weekday: 'long', day: 'numeric', month: 'long' }) }}</h1>
      <p>Three scouts search the web every morning. This is what they found most recently.</p>
    </header>

    <section class="fh-latest" aria-label="Latest from each feed">
      <a v-for="e in latest" :key="e.url" :href="withBase(e.url)" class="fh-card" :data-feed="e.feed">
        <span class="fh-card-top">
          <span class="fh-feed">{{ FEEDS[e.feed].name }}</span>
          <time :datetime="e.date">{{ fmt(e.date, { day: 'numeric', month: 'short' }) }}</time>
        </span>
        <span class="fh-stat">{{ e.stat }}</span>
        <span v-if="e.lead" class="fh-lead">{{ e.lead }}</span>
        <span class="fh-about">{{ FEEDS[e.feed].about }}</span>
      </a>
    </section>

    <section v-if="earlier.length" class="fh-earlier">
      <h2>Earlier</h2>
      <div v-for="day in earlier" :key="day.date" class="fh-day">
        <time :datetime="day.date">{{ fmt(day.date, { weekday: 'short', day: 'numeric', month: 'short' }) }}</time>
        <ul>
          <li v-for="e in day.list" :key="e.url" :data-feed="e.feed">
            <a :href="withBase(e.url)">
              <span class="fh-feed">{{ FEEDS[e.feed].name }}</span>
              <span class="fh-stat">{{ e.stat }}</span>
            </a>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
