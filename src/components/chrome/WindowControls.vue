<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { Minus, Square, Copy, X } from '@lucide/vue'
import { isTauri } from '@/lib/tauri-env'

const isMaximized = ref(false)

let unlisten: UnlistenFn | undefined

onMounted(async () => {
  if (!isTauri()) return
  const appWindow = getCurrentWindow()
  isMaximized.value = await appWindow.isMaximized()
  unlisten = await appWindow.onResized(async () => {
    isMaximized.value = await appWindow.isMaximized()
  })
})

onUnmounted(() => {
  unlisten?.()
})

function minimize() {
  if (isTauri()) getCurrentWindow().minimize()
}

function toggleMaximize() {
  if (isTauri()) getCurrentWindow().toggleMaximize()
}

function closeWindow() {
  if (isTauri()) getCurrentWindow().close()
}
</script>

<template>
  <div class="titlebar-no-drag fixed right-0 top-0 z-50 flex h-12 items-center gap-0.5 rounded-bl-lg bg-surface-chrome/60 pl-2 pr-2 backdrop-blur-xl">
    <button class="rounded p-1.5 hover:bg-fg/10" title="Свернуть" aria-label="Свернуть" @click="minimize">
      <Minus :size="16" />
    </button>
    <button
      class="rounded p-1.5 hover:bg-fg/10"
      :title="isMaximized ? 'Восстановить' : 'Развернуть'"
      :aria-label="isMaximized ? 'Восстановить' : 'Развернуть'"
      @click="toggleMaximize"
    >
      <Copy v-if="isMaximized" :size="14" />
      <Square v-else :size="14" />
    </button>
    <button
      class="rounded p-1.5 hover:bg-red-500 hover:text-white"
      title="Закрыть"
      aria-label="Закрыть"
      @click="closeWindow"
    >
      <X :size="16" />
    </button>
  </div>
</template>
