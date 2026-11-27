<script setup lang="ts">
import { computed } from 'vue'
import { promptView } from '../application/views/prompt-view'
import { themeView } from '../application/views/theme-view'
import Glyph from './Glyph.vue'
import { useUi } from './use-ui'

const ui = useUi()
const view = computed(() => promptView(ui.state.value, ui.translate))
const columnSide = computed(() => themeView(ui.state.value.settings, ui.viewport.value).side)
const ringState = computed(() => view.value?.state ?? 'idle')
const ringStyle = computed(() => ({ '--ring-ms': `${view.value?.ringMs ?? 0}ms` }))
</script>

<template>
  <div v-if="view !== null" class="omk-prompt" data-surface="prompt" :data-column-side="columnSide">
    <span v-if="view.hold" :key="`${view.id}-${ringState}`" class="omk-prompt__ring" data-motion="essential" :data-state="ringState" :style="ringStyle">
      <span class="omk-prompt__track" />
      <span class="omk-prompt__half omk-prompt__half--right"><span class="omk-prompt__arc" data-motion="essential" /></span>
      <span class="omk-prompt__half omk-prompt__half--left"><span class="omk-prompt__arc" data-motion="essential" /></span>
      <Glyph class="omk-prompt__glyph" :glyph="view.glyph.glyph" :glyph-set="ui.state.value.glyphSet" :label="view.glyph.label" />
    </span>
    <Glyph v-else class="omk-prompt__glyph" :glyph="view.glyph.glyph" :glyph-set="ui.state.value.glyphSet" :label="view.glyph.label" />
    <span class="omk-prompt__text">
      <span v-if="view.hold" class="omk-prompt__hold">{{ view.holdLabel }}</span>
      <span class="omk-prompt__action">{{ view.label }}</span>
    </span>
  </div>
</template>

<style>
.omk-prompt {
  position: fixed;
  bottom: var(--column-edge);
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-7) var(--space-4) var(--space-4);
  box-shadow: var(--shadow-toast);
}

.omk-prompt[data-column-side="left"] {
  right: 4rem;
}

.omk-prompt[data-column-side="right"] {
  left: 4rem;
}

.omk-prompt__ring {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 3.25rem;
  height: 3.25rem;
  --ring-width: var(--focus-ring);
}

.omk-prompt__track {
  position: absolute;
  inset: 0;
  border: var(--ring-width) solid var(--control-off);
  border-radius: var(--radius-round);
}

.omk-prompt__half {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  overflow: hidden;
}

.omk-prompt__half--right {
  right: 0;
}

.omk-prompt__half--left {
  left: 0;
}

.omk-prompt__arc {
  position: absolute;
  top: 0;
  width: 200%;
  height: 100%;
  border: var(--ring-width) solid transparent;
  border-top-color: var(--accent);
  border-right-color: var(--accent);
  border-radius: var(--radius-round);
}

.omk-prompt__half--right .omk-prompt__arc {
  right: 0;
  transform: rotate(-135deg);
}

.omk-prompt__half--left .omk-prompt__arc {
  left: 0;
  transform: rotate(45deg);
}

.omk-prompt__ring[data-state="holding"] .omk-prompt__half--right .omk-prompt__arc {
  animation: omk-ring-right calc(var(--ring-ms) / 2) linear both;
}

.omk-prompt__ring[data-state="holding"] .omk-prompt__half--left .omk-prompt__arc {
  animation: omk-ring-left calc(var(--ring-ms) / 2) linear calc(var(--ring-ms) / 2) both;
}

.omk-prompt__ring[data-state="completed"] .omk-prompt__half--right .omk-prompt__arc {
  transform: rotate(45deg);
}

.omk-prompt__ring[data-state="completed"] .omk-prompt__half--left .omk-prompt__arc {
  transform: rotate(225deg);
}

.omk-prompt__ring[data-state="completed"] .omk-prompt__arc {
  border-top-color: var(--success);
  border-right-color: var(--success);
}

.omk-prompt__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.omk-prompt__hold {
  color: var(--accent-text);
  font-size: var(--text-min);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--tracking-caps);
  line-height: var(--leading-tight);
  text-transform: uppercase;
}

.omk-prompt__action {
  font-size: var(--text-field);
  font-weight: var(--font-weight-strong);
  line-height: var(--leading-tight);
}

@keyframes omk-ring-right {
  from { transform: rotate(-135deg); }
  to { transform: rotate(45deg); }
}

@keyframes omk-ring-left {
  from { transform: rotate(45deg); }
  to { transform: rotate(225deg); }
}
</style>
