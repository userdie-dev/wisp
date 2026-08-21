<script setup lang="ts">
import { ref } from 'vue'
import { Check, ChevronDown, Plus, Trash2 } from '@lucide/vue'
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from 'reka-ui'
import { useSettingsStore } from '@/stores/settings'
import { isValidSearchTemplate } from '@/lib/search-engines'
import { nanoid } from 'nanoid'

const settings = useSettingsStore()

const newName = ref('')
const newTemplate = ref('')
const templateError = ref('')

function addEngine() {
  if (!newName.value.trim()) return
  if (!isValidSearchTemplate(newTemplate.value)) {
    templateError.value = 'Шаблон должен содержать ровно одно вхождение %s'
    return
  }
  templateError.value = ''
  settings.addCustomSearchEngine({
    id: `custom-${nanoid()}`,
    name: newName.value.trim(),
    urlTemplate: newTemplate.value.trim(),
    builtIn: false,
  })
  newName.value = ''
  newTemplate.value = ''
}
</script>

<template>
  <section>
    <h2 class="mb-3 text-sm font-semibold">Поиск по умолчанию</h2>

    <SelectRoot v-model="settings.searchEngineId">
      <SelectTrigger
        class="flex h-9 w-64 items-center justify-between rounded-md border border-border bg-transparent px-3 text-sm"
      >
        <SelectValue />
        <SelectIcon><ChevronDown :size="14" /></SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent class="rounded-md border border-border bg-surface p-1 shadow-lg">
          <SelectViewport>
            <SelectItem
              v-for="engine in settings.allSearchEngines()"
              :key="engine.id"
              :value="engine.id"
              class="flex cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-fg/10"
            >
              <SelectItemText>{{ engine.name }}</SelectItemText>
              <SelectItemIndicator><Check :size="14" /></SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>

    <h3 class="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-fg-muted">Свои поисковые системы</h3>
    <div class="mb-3 space-y-1">
      <div
        v-for="engine in settings.customSearchEngines"
        :key="engine.id"
        class="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fg/5"
      >
        <span class="flex-1 truncate text-sm">{{ engine.name }}</span>
        <span class="truncate text-xs text-fg-muted">{{ engine.urlTemplate }}</span>
        <button class="rounded p-1 hover:bg-fg/10" @click="settings.removeCustomSearchEngine(engine.id)">
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-start gap-2">
      <input
        v-model="newName"
        placeholder="Имя"
        class="h-9 w-32 rounded-md border border-border bg-transparent px-2 text-sm"
      />
      <input
        v-model="newTemplate"
        placeholder="https://example.com/search?q=%s"
        class="h-9 flex-1 min-w-64 rounded-md border border-border bg-transparent px-2 text-sm"
      />
      <button
        class="flex h-9 items-center gap-1 rounded-md bg-accent px-3 text-sm text-accent-fg"
        @click="addEngine"
      >
        <Plus :size="14" /> Добавить
      </button>
    </div>
    <p v-if="templateError" class="mt-1 text-xs text-red-500">{{ templateError }}</p>
  </section>
</template>
