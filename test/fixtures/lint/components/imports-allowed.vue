<script setup lang="ts">
import { computed, inject, shallowRef } from 'vue'

const source = inject<number>('source', 0)
const local = shallowRef(0)
const total = computed(() => source + local.value)
</script>

<template>
  <p>{{ total }}</p>
</template>
