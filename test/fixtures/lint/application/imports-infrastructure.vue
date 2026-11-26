<script setup lang="ts">
import { store } from '../infrastructure/store'

const value = store
</script>

<template>
  <p>{{ value }}</p>
</template>
