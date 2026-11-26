<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="omk-section" role="presentation">{{ label }}</div>
</template>
