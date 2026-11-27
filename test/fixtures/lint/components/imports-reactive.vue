<script setup lang="ts">
import { reactive, ref, shallowReactive } from 'vue'

const first = reactive({ value: 0 })
const second = ref(0)
const third = shallowReactive({ value: 0 })
</script>

<template>
  <p>{{ first.value }} {{ second }} {{ third.value }}</p>
</template>
