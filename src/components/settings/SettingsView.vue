<script setup lang="ts">
import ThemeSettings from './ThemeSettings.vue'
import SearchSettings from './SearchSettings.vue'
</script>

<template>
  <div class="mx-auto h-full max-w-2xl space-y-10 overflow-y-auto px-6 py-8">
    <h1 class="text-lg font-semibold">Настройки</h1>
    <ThemeSettings />
    <SearchSettings />
  </div>
</template>
