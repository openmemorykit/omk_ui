<script setup lang="ts">
const state: string = String(Date.now())
let label = ''
switch (state) {
  case 'open':
    label = 'o'
    break
  default:
    break
}
</script>

<template>
  <p>{{ label }}</p>
</template>
