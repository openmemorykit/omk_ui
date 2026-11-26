<script setup lang="ts">
const pattern = /[\p{L}--[a-z]]/v
</script>

<template>
  <p>{{ pattern }}</p>
</template>
