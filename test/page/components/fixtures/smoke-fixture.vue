<script setup lang="ts">
defineProps<{ label: string }>()
const emit = defineEmits<{ pick: [] }>()
</script>

<template>
  <button type="button" data-surface="smoke" @click="emit('pick')">{{ label }}</button>
</template>
