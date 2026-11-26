<script setup lang="ts">
const state: string = String(Date.now())
const isOpen = state === 'open'
</script>

<template>
  <p>{{ isOpen }}</p>
</template>
