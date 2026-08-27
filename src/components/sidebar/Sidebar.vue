<script setup lang="ts">
import { Plus, Clock, Star, Settings, PanelLeftClose } from '@lucide/vue'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import TabItem from './TabItem.vue'

const tabs = useTabsStore()
const settings = useSettingsStore()

function newTab() {
  tabs.createTab()
}
</script>

<template>
  <aside
    data-tauri-drag-region
    class="flex h-full w-[260px] shrink-0 flex-col overflow-hidden bg-surface-chrome pt-8 backdrop-blur-xl transition-[margin-left] duration-200 ease-out"
    :style="{ marginLeft: settings.sidebarCollapsed ? '-260px' : '0px' }"
  >
    <div class="flex items-center justify-between px-3 pb-2">
      <span class="text-xs font-medium text-fg-muted">Вкладки</span>
      <div class="flex items-center gap-1">
        <button
          class="rounded p-1 hover:bg-fg/10"
          aria-label="Новая вкладка"
          title="Новая вкладка (Ctrl+T)"
          @click="newTab"
        >
          <Plus :size="16" />
        </button>
        <button
          class="rounded p-1 hover:bg-fg/10"
          aria-label="Свернуть боковое меню"
          title="Свернуть боковое меню"
          @click="settings.toggleSidebar()"
        >
          <PanelLeftClose :size="16" />
        </button>
      </div>
    </div>

    <div class="flex-1 space-y-0.5 overflow-y-auto px-2">
      <TabItem
        v-for="tab in tabs.tabs"
        :key="tab.id"
        :tab="tab"
        :active="tab.id === tabs.activeTabId"
        @select="tabs.activateTab(tab.id)"
        @close="tabs.closeTab(tab.id)"
        @favicon-error="tabs.clearFavicon(tab.id)"
      />
    </div>

    <div class="flex items-center justify-around border-t border-border px-2 py-2">
      <button
        class="rounded p-2 hover:bg-fg/10"
        :class="{ 'text-accent': tabs.activeInternalPage === 'history' }"
        title="История"
        @click="tabs.showInternalPage('history')"
      >
        <Clock :size="18" />
      </button>
      <button
        class="rounded p-2 hover:bg-fg/10"
        :class="{ 'text-accent': tabs.activeInternalPage === 'bookmarks' }"
        title="Закладки"
        @click="tabs.showInternalPage('bookmarks')"
      >
        <Star :size="18" />
      </button>
      <button
        class="rounded p-2 hover:bg-fg/10"
        :class="{ 'text-accent': tabs.activeInternalPage === 'settings' }"
        title="Настройки"
        @click="tabs.showInternalPage('settings')"
      >
        <Settings :size="18" />
      </button>
    </div>
  </aside>
</template>
