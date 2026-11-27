<script setup lang="ts">
const state = defineModel<number>({ default: 0 })
</script>

<template>
  <p v-if="state === 'open'">open</p>
</template>
