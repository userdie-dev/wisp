<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { FolderOpen, LoaderCircle, RotateCw, Trash2, X } from '@lucide/vue'
import { useDownloadsStore, type DownloadItem } from '@/stores/downloads'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { isTauri } from '@/lib/tauri-env'

const downloads = useDownloadsStore()
const settings = useSettingsStore()
const tabs = useTabsStore()

const effectiveDir = ref('')

async function refreshDir() {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  effectiveDir.value = await invoke<string>('downloads_dir')
}
onMounted(refreshDir)

async function chooseDir() {
  if (!isTauri()) return
  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({ directory: true, multiple: false, defaultPath: effectiveDir.value })
  if (typeof picked !== 'string') return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('downloads_set_dir', { path: picked })
  settings.downloadsDir = picked
  await refreshDir()
}

async function resetDir() {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('downloads_set_dir', { path: null })
  settings.downloadsDir = null
  await refreshDir()
}

function retry(item: DownloadItem) {
  tabs.openFromContent(item.url, false)
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-8">
    <div class="mb-4 flex items-center justify-between gap-4">
      <h1 class="text-lg font-semibold">Загрузки</h1>
      <button
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-fg/10"
        @click="downloads.clearFinished()"
      >
        <Trash2 :size="14" /> Очистить завершённые
      </button>
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <span class="text-fg-muted">Папка загрузок:</span>
      <span class="min-w-0 flex-1 truncate font-medium">{{ effectiveDir || '—' }}</span>
      <button class="rounded-md px-2 py-1 text-xs hover:bg-fg/10" @click="chooseDir">Изменить…</button>
      <button
        v-if="settings.downloadsDir"
        class="rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-fg/10"
        @click="resetDir"
      >
        Сбросить
      </button>
    </div>

    <div v-if="downloads.items.length === 0" class="text-sm text-fg-muted">Загрузок пока нет.</div>

    <div class="space-y-1">
      <div
        v-for="item in downloads.items"
        :key="item.id"
        class="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-fg/5"
      >
        <LoaderCircle
          v-if="item.state === 'in_progress'"
          :size="16"
          class="shrink-0 animate-spin text-fg-muted"
        />
        <span
          v-else
          class="h-2 w-2 shrink-0 rounded-full"
          :class="item.state === 'done' ? 'bg-green-500' : 'bg-red-500'"
        />

        <div class="min-w-0 flex-1">
          <button
            class="block max-w-full truncate text-left text-sm font-medium hover:underline disabled:no-underline disabled:hover:no-underline"
            :disabled="item.state !== 'done'"
            :title="item.path"
            @click="downloads.openFile(item)"
          >
            {{ item.filename }}
          </button>
          <div class="truncate text-xs text-fg-muted">
            {{ item.state === 'failed' ? 'Не удалось · ' : '' }}{{ item.url }} · {{ fmtTime(item.startedAt) }}
          </div>
        </div>

        <button
          class="hidden shrink-0 rounded p-1 hover:bg-fg/10 group-hover:block"
          title="Показать в папке"
          @click="downloads.showInFolder(item)"
        >
          <FolderOpen :size="14" />
        </button>
        <button
          v-if="item.state === 'failed'"
          class="hidden shrink-0 rounded p-1 hover:bg-fg/10 group-hover:block"
          title="Повторить"
          @click="retry(item)"
        >
          <RotateCw :size="14" />
        </button>
        <button
          class="hidden shrink-0 rounded p-1 hover:bg-fg/10 group-hover:block"
          title="Убрать из списка"
          @click="downloads.remove(item.id)"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>
