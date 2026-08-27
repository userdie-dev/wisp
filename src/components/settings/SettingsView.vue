<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { Palette, Search, Rocket, DownloadCloud, Info } from '@lucide/vue'
import ThemeSettings from './ThemeSettings.vue'
import SearchSettings from './SearchSettings.vue'
import StartupSettings from './StartupSettings.vue'
import UpdateSettings from './UpdateSettings.vue'
import AboutSettings from './AboutSettings.vue'

type SectionId = 'appearance' | 'search' | 'startup' | 'updates' | 'about'

interface NavItem {
  id: SectionId
  label: string
  icon: Component
  component: Component
}

const groups: { items: NavItem[] }[] = [
  {
    items: [
      { id: 'appearance', label: 'Внешний вид', icon: Palette, component: ThemeSettings },
      { id: 'search', label: 'Поиск', icon: Search, component: SearchSettings },
      { id: 'startup', label: 'При запуске', icon: Rocket, component: StartupSettings },
      { id: 'updates', label: 'Обновления', icon: DownloadCloud, component: UpdateSettings },
    ],
  },
  {
    items: [{ id: 'about', label: 'О программе', icon: Info, component: AboutSettings }],
  },
]

const active = ref<SectionId>('appearance')

const activeItem = computed(
  () => groups.flatMap((g) => g.items).find((i) => i.id === active.value)!,
)
</script>

<template>
  <div class="flex h-full">
    <nav class="w-56 shrink-0 overflow-y-auto border-r border-border px-3 py-6">
      <h1 class="mb-4 px-2 text-lg font-semibold">Настройки</h1>
      <template v-for="(group, gi) in groups" :key="gi">
        <hr v-if="gi > 0" class="my-2 border-border" />
        <button
          v-for="item in group.items"
          :key="item.id"
          class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
          :class="
            active === item.id
              ? 'bg-accent/10 font-medium text-accent'
              : 'text-fg hover:bg-fg/5'
          "
          @click="active = item.id"
        >
          <component :is="item.icon" :size="16" class="shrink-0" />
          {{ item.label }}
        </button>
      </template>
    </nav>

    <div class="min-w-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-2xl px-8 py-8">
        <component :is="activeItem.component" />
      </div>
    </div>
  </div>
</template>
