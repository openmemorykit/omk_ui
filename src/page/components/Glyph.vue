<script setup lang="ts">
import { computed } from 'vue'
import type { GlyphSet } from '../../protocol/page-vocabulary'
import { glyphView, type GlyphName } from '../theme/glyph-view'

const props = defineProps<{ glyph: GlyphName; glyphSet: GlyphSet; label: string }>()
const view = computed(() => glyphView(props.glyph, props.glyphSet, props.label))
</script>

<template>
  <span :class="view.classes" role="img" :aria-label="label">
    <svg v-if="view.paths.length > 0" class="omk-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path v-for="path in view.paths" :key="path" :d="path" />
    </svg>
    <span v-else aria-hidden="true">{{ view.text }}</span>
  </span>
</template>
