<script setup lang="ts">
import { ref } from 'vue'
import { Search } from '@lucide/vue'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useBookmarksStore } from '@/stores/bookmarks'
import { resolveInput } from '@/lib/omnibox'

const tabs = useTabsStore()
const settings = useSettingsStore()
const bookmarks = useBookmarksStore()

const query = ref('')

function submit() {
  if (!tabs.activeTabId) return
  const resolved = resolveInput(query.value, settings.activeSearchEngine())
  if (!resolved) return
  tabs.navigate(tabs.activeTabId, resolved)
}

function openShortcut(url: string) {
  if (!tabs.activeTabId) return
  tabs.navigate(tabs.activeTabId, url)
}

const shortcuts = () => bookmarks.bookmarks.filter((b) => b.folderId === null).slice(0, 8)
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-8 px-6">
    <h1 class="text-2xl font-semibold text-fg-muted">Новая вкладка</h1>

    <div class="relative w-full max-w-xl">
      <Search :size="18" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
      <input
        v-model="query"
        autofocus
        class="h-12 w-full rounded-full border border-border bg-surface px-11 text-sm outline-none focus:border-accent"
        placeholder="Поиск или адрес сайта"
        @keydown.enter="submit"
      />
    </div>

    <div v-if="shortcuts().length > 0" class="grid grid-cols-4 gap-4">
      <button
        v-for="bookmark in shortcuts()"
        :key="bookmark.id"
        class="flex w-20 flex-col items-center gap-1.5 rounded-lg p-2 text-center hover:bg-fg/5"
        @click="openShortcut(bookmark.url)"
      >
        <span
          class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-chrome-hover text-sm font-medium"
        >
          <img v-if="bookmark.favicon" :src="bookmark.favicon" class="h-5 w-5" alt="" />
          <span v-else>{{ bookmark.title.charAt(0).toUpperCase() }}</span>
        </span>
        <span class="w-full truncate text-xs text-fg-muted">{{ bookmark.title }}</span>
      </button>
    </div>
  </div>
</template>
