<script setup lang="ts">
defineProps<{ text: string; empty: boolean; placeholder: string | null }>()
</script>

<template>
  <template v-if="empty">
    <span v-if="placeholder !== null" class="omk-row__placeholder">{{ placeholder }}</span>
  </template>
  <span v-else class="omk-row__text">{{ text }}</span>
</template>
