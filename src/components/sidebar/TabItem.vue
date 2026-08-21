<script setup vapor lang="ts">
// Vapor mode opt-in (Vue 3.6): no VDOM/reactive-render overhead for what is
// often the largest, most frequently re-rendered list in the app. See
// docs/architecture.md, "Vapor mode: точечное включение".
import { X } from '@lucide/vue'
import type { Tab } from '@/stores/tabs'

const props = defineProps<{ tab: Tab; active: boolean }>()
const emit = defineEmits<{ select: []; close: [] }>()
</script>

<template>
  <div
    class="group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-default select-none"
    :class="active ? 'bg-surface-chrome-hover' : 'hover:bg-surface-chrome-hover/60'"
    @click="emit('select')"
  >
    <img v-if="props.tab.favicon" :src="props.tab.favicon" class="h-4 w-4 shrink-0" alt="" />
    <div v-else class="h-4 w-4 shrink-0 rounded-full bg-fg-muted/30" />

    <span class="min-w-0 flex-1 truncate text-sm" :class="props.tab.loading ? 'text-fg-muted' : 'text-fg'">
      {{ props.tab.title || 'Новая вкладка' }}
    </span>

    <button
      class="titlebar-no-drag hidden shrink-0 rounded p-0.5 hover:bg-fg/10 group-hover:block"
      :class="{ block: active }"
      @click.stop="emit('close')"
      aria-label="Закрыть вкладку"
    >
      <X :size="14" />
    </button>
  </div>
</template>
