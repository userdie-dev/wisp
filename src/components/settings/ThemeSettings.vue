<script setup lang="ts">
import { Monitor, Sun, Moon } from '@lucide/vue'
import { RadioGroupRoot, RadioGroupItem, RadioGroupIndicator } from 'reka-ui'
import { useSettingsStore, type Theme } from '@/stores/settings'

const settings = useSettingsStore()

const options: { value: Theme; label: string; icon: typeof Monitor }[] = [
  { value: 'system', label: 'Системная', icon: Monitor },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
]
</script>

<template>
  <section>
    <h2 class="mb-3 text-sm font-semibold">Тема</h2>
    <RadioGroupRoot v-model="settings.theme" class="flex gap-3">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-default flex-col items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm"
        :class="settings.theme === option.value ? 'border-accent bg-accent/10' : 'hover:bg-fg/5'"
        @click="settings.theme = option.value"
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
