<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, RotateCw, Star } from '@lucide/vue'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useBookmarksStore } from '@/stores/bookmarks'
import { resolveInput } from '@/lib/omnibox'

const tabs = useTabsStore()
const settings = useSettingsStore()
const bookmarks = useBookmarksStore()

const activeTab = computed(() => tabs.tabs.find((t) => t.id === tabs.activeTabId) ?? null)
const omniboxValue = ref('')

// Watches the tab id *and* its url — a plain `watch(activeTab, ...)` would
// miss url changes on the same tab object (e.g. navigating away from the
// start page), since the computed's object reference doesn't change.
watch(
  () => [activeTab.value?.id, activeTab.value?.url] as const,
  ([, url]) => {
    omniboxValue.value = url ?? ''
  },
  { immediate: true },
)

function submitOmnibox() {
  const tab = activeTab.value
  if (!tab) return
  const resolved = resolveInput(omniboxValue.value, settings.activeSearchEngine())
  if (!resolved) return
  tabs.navigate(tab.id, resolved)
}

const bookmarked = computed(() => (activeTab.value ? bookmarks.isBookmarked(activeTab.value.url) : false))

function toggleBookmark() {
  const tab = activeTab.value
  if (!tab || !tab.url) return
  if (bookmarked.value) bookmarks.removeByUrl(tab.url)
  else bookmarks.add({ url: tab.url, title: tab.title, favicon: tab.favicon, folderId: null })
}
</script>

<template>
  <div v-if="activeTab" class="titlebar-drag flex h-12 shrink-0 items-center gap-1 bg-surface-chrome px-3 backdrop-blur-xl">
    <button
      class="titlebar-no-drag rounded p-1.5 hover:bg-fg/10 disabled:opacity-30"
      :disabled="!activeTab"
      title="Назад"
      @click="tabs.goBack(activeTab!.id)"
    >
      <ArrowLeft :size="16" />
    </button>
    <button
      class="titlebar-no-drag rounded p-1.5 hover:bg-fg/10 disabled:opacity-30"
      :disabled="!activeTab"
      title="Вперёд"
      @click="tabs.goForward(activeTab!.id)"
    >
      <ArrowRight :size="16" />
    </button>
    <button
      class="titlebar-no-drag rounded p-1.5 hover:bg-fg/10 disabled:opacity-30"
      :disabled="!activeTab"
      title="Обновить"
      @click="tabs.reload(activeTab!.id)"
    >
      <RotateCw :size="16" />
    </button>

    <input
      v-model="omniboxValue"
      class="titlebar-no-drag mx-2 h-8 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-accent"
      placeholder="Поиск или адрес сайта"
      @keydown.enter="submitOmnibox"
    />

    <button
      class="titlebar-no-drag rounded p-1.5 hover:bg-fg/10"
      :class="bookmarked ? 'text-accent' : ''"
      title="Добавить в закладки"
      @click="toggleBookmark"
    >
      <Star :size="16" :fill="bookmarked ? 'currentColor' : 'none'" />
    </button>
  </div>
</template>
