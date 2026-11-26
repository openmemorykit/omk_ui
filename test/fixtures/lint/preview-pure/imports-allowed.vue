<script setup lang="ts">
import { created } from '../../../../src/client/domain/owner-registry'
import { opened } from '../../../../src/page/domain/boot'
import { shape } from '../../../../src/protocol/to-page'

const value = [created, opened, shape]
</script>

<template>
  <p>{{ value }}</p>
</template>
