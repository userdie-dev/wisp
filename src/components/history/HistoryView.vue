<script setup lang="ts">
import { computed, ref } from 'vue'
import { Trash2 } from '@lucide/vue'
import { useHistoryStore } from '@/stores/history'
import { useTabsStore } from '@/stores/tabs'

const history = useHistoryStore()
const tabs = useTabsStore()
const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return history.entries
  return history.entries.filter(
    (e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q),
  )
})

function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Сегодня'
  if (sameDay(d, yesterday)) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const grouped = computed(() => {
  const groups: { label: string; items: typeof filtered.value }[] = []
  for (const entry of filtered.value) {
    const label = dayLabel(entry.visitedAt)
    const group = groups.at(-1)
    if (group?.label === label) group.items.push(entry)
    else groups.push({ label, items: [entry] })
  }
  return groups
})

function open(url: string) {
  tabs.createTab(url)
}
</script>

<template>
  <div class="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-8">
    <div class="mb-4 flex items-center justify-between gap-4">
      <h1 class="text-lg font-semibold">История</h1>
      <button
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-fg/10"
        @click="history.clearAll()"
      >
        <Trash2 :size="14" /> Очистить всё
      </button>
    </div>

    <input
      v-model="query"
      class="mb-6 h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-accent"
      placeholder="Поиск по истории"
    />

    <div v-if="grouped.length === 0" class="text-sm text-fg-muted">История пуста.</div>

    <div v-for="group in grouped" :key="group.label" class="mb-6">
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">{{ group.label }}</h2>
      <div class="space-y-0.5">
        <div
          v-for="entry in group.items"
          :key="entry.id"
          class="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fg/5"
        >
          <button class="min-w-0 flex-1 truncate text-left text-sm" @click="open(entry.url)">
            <span class="font-medium">{{ entry.title || entry.url }}</span>
            <span class="ml-2 text-fg-muted">{{ entry.url }}</span>
          </button>
          <button
            class="hidden rounded p-1 hover:bg-fg/10 group-hover:block"
            aria-label="Удалить запись"
            @click="history.removeEntry(entry.id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
