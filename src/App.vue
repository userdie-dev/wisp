<script setup lang="ts">
import { onMounted } from 'vue'
import Sidebar from '@/components/sidebar/Sidebar.vue'
import Toolbar from '@/components/chrome/Toolbar.vue'
import ContentHost from '@/components/chrome/ContentHost.vue'
import { useTabsStore } from '@/stores/tabs'

const tabs = useTabsStore()

onMounted(() => {
  if (tabs.tabs.length === 0) tabs.createTab()
})
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-transparent">
    <Sidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <Toolbar />
      <ContentHost />
    </div>
  </div>
</template>
