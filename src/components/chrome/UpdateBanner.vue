<script setup lang="ts">
import { computed } from 'vue'
import { Download, X } from '@lucide/vue'
import { useUpdaterStore } from '@/stores/updater'

const updater = useUpdaterStore()

const visible = computed(
  () =>
    !updater.bannerDismissed &&
    (updater.status === 'available' ||
      updater.status === 'downloading' ||
      updater.status === 'ready'),
)

const progress = computed(() =>
  updater.contentLength ? Math.round((updater.downloaded / updater.contentLength) * 100) : null,
)
</script>

<template>
  <div
    v-if="visible"
    class="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-accent/10 px-3 text-sm"
  >
    <template v-if="updater.status === 'available'">
      <span class="min-w-0 flex-1 truncate">
        Доступно обновление Wisp {{ updater.info?.version }}
      </span>
      <button
        class="flex h-6 items-center gap-1 rounded bg-accent px-2 text-xs text-accent-fg"
        @click="updater.downloadAndInstall()"
      >
        <Download :size="12" /> Установить
      </button>
    </template>

    <template v-else-if="updater.status === 'downloading'">
      <span class="min-w-0 flex-1 truncate text-fg-muted">
        Загрузка обновления{{ progress !== null ? ` — ${progress}%` : '…' }}
      </span>
    </template>

    <template v-else-if="updater.status === 'ready'">
      <span class="min-w-0 flex-1 truncate">Обновление готово к установке</span>
      <button
        class="flex h-6 items-center rounded bg-accent px-2 text-xs text-accent-fg"
        @click="updater.relaunch()"
      >
        Перезапустить
      </button>
    </template>

    <button
      class="shrink-0 rounded p-1 hover:bg-fg/10"
      aria-label="Скрыть"
      @click="updater.dismissBanner()"
    >
      <X :size="14" />
    </button>
  </div>
</template>
