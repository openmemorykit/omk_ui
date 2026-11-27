<script setup lang="ts">
import { computed } from 'vue'
import { legendView } from '../application/views/legend-view'
import Glyph from './Glyph.vue'
import { useUi } from './use-ui'

const ui = useUi()
const view = computed(() => legendView(ui.state.value, ui.translate))
</script>

<template>
  <div v-if="view !== null" class="omk-legend omk-surface-deep" data-surface="legend" :data-modality="view.modality">
    <div v-for="entry in view.entries" :key="entry.action" class="omk-legend__entry" :data-hold="entry.hold">
      <span class="omk-legend__group omk-legend__group--keys">
        <Glyph v-for="key in entry.keys" :key="`${key.glyph}-${key.label}`" :glyph="key.glyph" :glyph-set="view.glyphSet" :label="key.label" :class="{ 'is-muted': key.muted }" />
      </span>
      <span class="omk-legend__group omk-legend__group--pad">
        <Glyph v-for="pad in entry.pad" :key="pad.glyph" :glyph="pad.glyph" :glyph-set="view.glyphSet" :label="pad.label" :class="{ 'is-muted': pad.muted }" />
      </span>
      <span class="omk-legend__label">{{ entry.label }}</span>
      <span v-if="entry.hold" class="omk-legend__hold">{{ ui.translate('ui.prompt.hold') }}</span>
    </div>
  </div>
</template>

<style>
.omk-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-6);
  padding: var(--space-4) var(--space-6);
  font-size: var(--text-min);
}

.omk-legend__entry {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--ink-2);
  font-weight: var(--font-weight-strong);
  line-height: var(--leading-tight);
}

.omk-legend__group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.omk-legend__group--keys {
  order: 1;
}

.omk-legend__group--pad {
  order: 2;
}

.omk-legend[data-modality="gamepad"] .omk-legend__group--pad {
  order: 0;
}

.omk-legend[data-modality="gamepad"] .omk-legend__group--keys {
  order: 1;
}

.omk-legend__label {
  order: 3;
}

.omk-legend__hold {
  order: 4;
  color: var(--accent-text);
  font-size: var(--text-min);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
}
</style>
