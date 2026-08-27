<script setup lang="ts">
import { computed } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { RefreshCw, Download, RotateCcw } from '@lucide/vue'
import { useUpdaterStore } from '@/stores/updater'
import { useSettingsStore } from '@/stores/settings'

const updater = useUpdaterStore()
const settings = useSettingsStore()

const busy = computed(() => updater.status === 'checking' || updater.status === 'downloading')

const statusText = computed(() => {
  switch (updater.status) {
    case 'checking':
      return 'Проверка обновлений…'
    case 'available':
      return `Доступна версия ${updater.info?.version}`
    case 'downloading':
      return updater.contentLength
        ? `Загрузка… ${Math.round((updater.downloaded / updater.contentLength) * 100)}%`
        : 'Загрузка…'
    case 'ready':
      return 'Обновление установлено — перезапустите приложение'
    case 'upToDate':
      return 'У вас последняя версия'
    case 'error':
      return `Ошибка: ${updater.error}`
    case 'unsupported':
      return 'Недоступно в режиме разработки'
    default:
      return ''
  }
})
</script>

<template>
  <section>
    <h2 class="mb-3 text-sm font-semibold">Обновления</h2>

    <p class="text-sm text-fg-muted">
      Текущая версия: <span class="font-medium text-fg">{{ updater.currentVersion }}</span>
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <button
        class="flex h-9 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-sm disabled:opacity-50"
        :disabled="busy || updater.status === 'unsupported'"
        @click="updater.check()"
      >
        <RefreshCw :size="14" :class="updater.status === 'checking' && 'animate-spin'" />
        Проверить обновления
      </button>

      <button
        v-if="updater.status === 'available' || updater.status === 'downloading'"
        class="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm text-accent-fg disabled:opacity-50"
        :disabled="updater.status === 'downloading'"
        @click="updater.downloadAndInstall()"
      >
        <Download :size="14" />
        Установить
      </button>

      <button
        v-if="updater.status === 'ready'"
        class="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm text-accent-fg"
        @click="updater.relaunch()"
      >
        <RotateCcw :size="14" />
        Перезапустить
      </button>
    </div>

    <p
      v-if="statusText"
      class="mt-2 text-xs"
      :class="updater.status === 'error' ? 'text-red-500' : 'text-fg-muted'"
    >
      {{ statusText }}
    </p>

    <pre
      v-if="updater.status === 'available' && updater.info?.notes"
      class="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border p-2 text-xs text-fg-muted"
      >{{ updater.info.notes }}</pre
    >

    <label class="mt-5 flex items-center gap-3 text-sm">
      <SwitchRoot
        v-model="settings.updatesAutoCheck"
        class="relative h-5 w-9 shrink-0 rounded-full border border-border transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <SwitchThumb
          class="block size-4 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-fg"
        />
      </SwitchRoot>
      Проверять обновления автоматически при запуске
    </label>
  </section>
</template>
