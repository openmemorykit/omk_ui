<script setup lang="ts">
import type { Clock, Scheduler } from '../../../../src/page/application/ports'

const value: [Clock?, Scheduler?] = []
</script>

<template>
  <p>{{ value }}</p>
</template>
