<script setup lang="ts">
import { History, FilePlus } from '@lucide/vue'
import { RadioGroupRoot, RadioGroupItem, RadioGroupIndicator } from 'reka-ui'
import { useSettingsStore, type StartupBehavior } from '@/stores/settings'

const settings = useSettingsStore()

const options: { value: StartupBehavior; label: string; icon: typeof History }[] = [
  { value: 'restore', label: 'Восстановить вкладки', icon: History },
  { value: 'newTab', label: 'Новая вкладка', icon: FilePlus },
]
</script>

<template>
  <section>
    <h2 class="mb-3 text-sm font-semibold">При запуске</h2>
    <RadioGroupRoot v-model="settings.startupBehavior" class="flex gap-3">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-default flex-col items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm"
        :class="settings.startupBehavior === option.value ? 'border-accent bg-accent/10' : 'hover:bg-fg/5'"
        @click="settings.startupBehavior = option.value"
      >
        <RadioGroupItem :value="option.value" class="sr-only">
          <RadioGroupIndicator />
        </RadioGroupItem>
        <component :is="option.icon" :size="18" />
        {{ option.label }}
      </label>
    </RadioGroupRoot>
  </section>
</template>
