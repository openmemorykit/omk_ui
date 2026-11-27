<script setup lang="ts">
defineProps<{ items: readonly string[] }>()
</script>

<template>
  <ul>
    <li v-for="item in items">{{ item }}</li>
  </ul>
</template>
