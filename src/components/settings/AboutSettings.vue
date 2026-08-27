<script setup lang="ts">
import { useUpdaterStore } from '@/stores/updater'

const updater = useUpdaterStore()
</script>

<template>
  <section>
    <h2 class="mb-3 text-sm font-semibold">О программе</h2>
    <p class="text-sm text-fg-muted">
      Версия: <span class="font-medium text-fg">{{ updater.currentVersion }}</span>
    </p>
  </section>
</template>
