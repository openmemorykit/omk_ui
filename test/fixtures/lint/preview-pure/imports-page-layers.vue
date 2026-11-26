<script setup lang="ts">
import { store } from '../../../../src/page/infrastructure/store'
import { build } from '../../../../src/page/application/build'
import { Panel } from '../../../../src/page/components/panel'

const value = [store, build, Panel]
</script>

<template>
  <p>{{ value }}</p>
</template>
