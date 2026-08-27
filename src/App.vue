<script setup lang="ts">
import { onMounted } from 'vue'
import Sidebar from '@/components/sidebar/Sidebar.vue'
import Toolbar from '@/components/chrome/Toolbar.vue'
import ContentHost from '@/components/chrome/ContentHost.vue'
import WindowControls from '@/components/chrome/WindowControls.vue'
import { useTabsStore } from '@/stores/tabs'
import { useHistoryStore } from '@/stores/history'

const tabs = useTabsStore()

// Eagerly instantiate the history store so its `tab-updated` subscription is
// active for the whole session — otherwise nothing records visits until the
// user first opens the History page (the only other place it's used).
useHistoryStore()

onMounted(() => {
  if (tabs.tabs.length === 0) tabs.createTab()
})
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-transparent">
    <Sidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex h-12 shrink-0">
        <div data-tauri-drag-region class="min-w-0 flex-1">
          <Toolbar />
        </div>
        <WindowControls />
      </div>
      <ContentHost />
    </div>
  </div>
</template>
