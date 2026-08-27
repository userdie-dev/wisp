<script setup lang="ts">
import { onMounted } from 'vue'
import { PanelLeftOpen } from '@lucide/vue'
import Sidebar from '@/components/sidebar/Sidebar.vue'
import Toolbar from '@/components/chrome/Toolbar.vue'
import ContentHost from '@/components/chrome/ContentHost.vue'
import WindowControls from '@/components/chrome/WindowControls.vue'
import UpdateBanner from '@/components/chrome/UpdateBanner.vue'
import { useTabsStore } from '@/stores/tabs'
import { useHistoryStore } from '@/stores/history'
import { useSettingsStore } from '@/stores/settings'
import { useUpdaterStore } from '@/stores/updater'
import { isTauri } from '@/lib/tauri-env'

const tabs = useTabsStore()
const settings = useSettingsStore()
const updater = useUpdaterStore()

// Eagerly instantiate the history store so its `tab-updated` subscription is
// active for the whole session — otherwise nothing records visits until the
// user first opens the History page (the only other place it's used).
useHistoryStore()

onMounted(() => {
  if (tabs.tabs.length === 0) tabs.createTab()

  // Auto-check for updates if enabled — see docs/features/auto-update.md.
  // Delayed so it doesn't compete with the first paint / initial tab creation,
  // and so the persisted `updatesAutoCheck` setting has loaded by then.
  if (isTauri()) {
    setTimeout(() => {
      if (settings.updatesAutoCheck) updater.check({ silent: true })
    }, 3000)
  }
})
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-transparent">
    <Sidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex h-12 shrink-0">
        <div data-tauri-drag-region class="flex min-w-0 flex-1 items-center">
          <Transition
            :duration="{ enter: 200, leave: 150 }"
            enter-active-class="transition duration-200 ease-out"
            leave-active-class="transition duration-150 ease-in"
            enter-from-class="-translate-x-2 opacity-0"
            leave-to-class="-translate-x-2 opacity-0"
          >
            <button
              v-if="settings.sidebarCollapsed"
              class="ml-2 shrink-0 rounded p-1.5 hover:bg-fg/10"
              aria-label="Развернуть боковое меню"
              title="Развернуть боковое меню"
              @click="settings.toggleSidebar()"
            >
              <PanelLeftOpen :size="16" />
            </button>
          </Transition>
          <div class="min-w-0 flex-1">
            <Toolbar />
          </div>
        </div>
        <WindowControls />
      </div>
      <UpdateBanner />
      <ContentHost />
    </div>
  </div>
</template>
