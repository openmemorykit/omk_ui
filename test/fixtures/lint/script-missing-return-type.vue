<script setup lang="ts">
function double(value: number) {
  return value * 2
}
const result = double(1)
</script>

<template>
  <p>{{ result }}</p>
</template>
