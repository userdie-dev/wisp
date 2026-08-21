<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useContentBounds } from '@/composables/useContentBounds'
import HistoryView from '@/components/history/HistoryView.vue'
import BookmarksView from '@/components/bookmarks/BookmarksView.vue'
import SettingsView from '@/components/settings/SettingsView.vue'
import StartPage from '@/components/starttab/StartPage.vue'

const tabs = useTabsStore()
const el = ref<HTMLElement | null>(null)
useContentBounds(el)

const activeTab = computed(() => tabs.tabs.find((t) => t.id === tabs.activeTabId) ?? null)
// Chrome-rendered (opaque) whenever there's no tab webview underneath it to
// show through — internal pages and the start page, see
// docs/features/start-page.md.
const chromeRendered = computed(() => !!tabs.activeInternalPage || !!activeTab.value?.pending)
</script>

<template>
  <div ref="el" class="min-h-0 flex-1" :class="chromeRendered ? 'bg-surface' : 'bg-transparent'">
    <HistoryView v-if="tabs.activeInternalPage === 'history'" />
    <BookmarksView v-else-if="tabs.activeInternalPage === 'bookmarks'" />
    <SettingsView v-else-if="tabs.activeInternalPage === 'settings'" />
    <StartPage v-else-if="activeTab?.pending" />
    <!-- Otherwise: intentionally empty — the active tab's child webview is
         layered on top of this exact rect by Rust, see docs/architecture.md. -->
  </div>
</template>
