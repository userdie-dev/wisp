<script setup vapor lang="ts">
// Vapor mode opt-in (Vue 3.6): no VDOM/reactive-render overhead for what is
// often the largest, most frequently re-rendered list in the app. See
// docs/architecture.md, "Vapor mode: точечное включение".
import { Loader2, X } from '@lucide/vue'
import type { Tab } from '@/stores/tabs'

const props = defineProps<{ tab: Tab; active: boolean }>()
const emit = defineEmits<{ select: []; close: []; faviconError: [] }>()
</script>

<template>
  <div
    class="group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-default select-none"
    :class="active ? 'bg-surface-chrome-hover' : 'hover:bg-surface-chrome-hover/60'"
    @click="emit('select')"
  >
    <Loader2 v-if="props.tab.loading" :size="16" class="shrink-0 animate-spin text-fg-muted" />
    <img
      v-else-if="props.tab.favicon"
      :src="props.tab.favicon"
      class="h-4 w-4 shrink-0"
      alt=""
      @error="emit('faviconError')"
    />
    <div v-else class="h-4 w-4 shrink-0 rounded-full bg-fg-muted/30" />

    <span class="min-w-0 flex-1 truncate text-sm" :class="props.tab.loading ? 'text-fg-muted' : 'text-fg'">
      {{ props.tab.title || 'Новая вкладка' }}
    </span>

    <button
      class="hidden shrink-0 rounded p-0.5 hover:bg-fg/10 group-hover:block"
      :class="{ block: active }"
      @click.stop="emit('close')"
      aria-label="Закрыть вкладку"
    >
      <X :size="14" />
    </button>
  </div>
</template>
