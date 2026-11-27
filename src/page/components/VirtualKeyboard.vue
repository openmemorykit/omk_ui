<script setup lang="ts">
import { nextTick, onMounted, useTemplateRef, watch } from 'vue'
import type { KeyboardView, KeyView } from '../application/views/keyboard-view'
import { KeyAction } from '../domain/keyboard-layouts'
import { PageCommandType } from '../domain/page-commands'
import { ERASE, LAYERS, SHIFT } from './chrome-icons'
import { useUi } from './use-ui'

const props = defineProps<{ view: KeyboardView; title?: string }>()
const { dispatch } = useUi()
const field = useTemplateRef<HTMLInputElement>('field')
const KEY_ICONS: ReadonlyMap<KeyAction, string> = new Map([[KeyAction.Shift, SHIFT], [KeyAction.Erase, ERASE], [KeyAction.Layer, LAYERS]])

function place(): void {
  const element = field.value
  if (element === null) return
  if (element.value !== props.view.value) element.value = props.view.value
  element.setSelectionRange(element.value.length, element.value.length)
}

function send(): void {
  const element = field.value
  if (element === null) return
  dispatch({ type: PageCommandType.TypeText, value: element.value })
  void nextTick(place)
}

function onInput(event: Event): void {
  if (event instanceof InputEvent && event.isComposing) return
  send()
}

function onFocus(): void {
  dispatch({ type: PageCommandType.TextInputFocused, itemId: props.view.itemId })
}

function press(key: KeyView): void {
  dispatch({ type: PageCommandType.ClickKey, row: key.row, unit: key.unit })
}

function keepFocus(event: MouseEvent): void {
  event.preventDefault()
}

function iconOf(key: KeyView): string | null {
  return KEY_ICONS.get(key.action) ?? null
}

function keyClasses(key: KeyView): Record<string, boolean> {
  return { 'is-focused': key.focused, 'is-active': key.active, 'omk-key--action': key.action === KeyAction.Submit }
}

onMounted(() => field.value?.focus())
watch(() => props.view.value, place, { flush: 'post' })
</script>

<template>
  <section class="omk-keyboard omk-surface-raised omk-surface-lifted omk-anim-rise" data-surface="keyboard" role="dialog" aria-modal="true" :aria-label="title ?? view.layerName">
    <div v-if="title !== undefined" class="omk-layer-head">
      <span class="omk-layer-title">{{ title }}</span>
    </div>
    <div class="omk-keyboard__body">
      <input
        ref="field"
        class="omk-keyboard__field"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :value="view.value"
        :maxlength="view.maxLength"
        :data-text-input="view.itemId"
        :aria-label="title ?? view.layerName"
        @input="onInput"
        @compositionend="send"
        @focus="onFocus"
      />
      <div class="omk-keyboard__meta">
        <span>{{ view.layerName }}</span>
        <span data-counter :class="{ 'is-limit': view.atLimit }">{{ view.counterText }}</span>
      </div>
      <div class="omk-keyboard__keys">
        <div v-for="(row, rowIndex) in view.rows" :key="rowIndex" class="omk-keyboard__row" data-key-row>
          <button
            v-for="key in row"
            :key="key.unit"
            type="button"
            tabindex="-1"
            class="omk-key"
            :class="keyClasses(key)"
            :style="{ '--units': key.units }"
            :aria-label="key.accessibleLabel"
            @mousedown="keepFocus"
            @click="press(key)"
          >
            <svg v-if="iconOf(key) !== null" class="omk-icon omk-key__icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="iconOf(key) ?? ''" /></svg>
            <span v-else class="omk-key__label" :class="{ 'omk-key__label--long': key.label.length > 1 }">{{ key.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.omk-keyboard {
  width: var(--column-width);
}

.omk-layer-head {
  display: flex;
  align-items: center;
  height: 3.5rem;
  padding: 0 var(--space-6);
  border-top: var(--stroke-key) solid var(--accent);
}

.omk-layer-title {
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-head);
  font-size: var(--text-layer-title);
  font-weight: var(--font-weight-heavy);
  line-height: var(--leading-tight);
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.omk-keyboard__body {
  padding: var(--space-4);
}

.omk-keyboard__field {
  box-sizing: border-box;
  width: 100%;
  min-height: 3.25rem;
  padding: var(--space-4);
  border: 0.0625rem solid var(--line);
  border-radius: 0;
  outline: none;
  background-color: var(--well);
  caret-color: var(--accent);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-field);
  line-height: var(--leading-text);
}

.omk-keyboard__meta {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) var(--space-1) var(--space-4);
  color: var(--ink-3);
  font-size: var(--text-min);
  font-weight: var(--font-weight-strong);
  font-variant-numeric: tabular-nums;
}

.omk-keyboard__meta .is-limit {
  color: var(--warning);
}

.omk-keyboard__keys {
  display: grid;
  gap: var(--space-1);
}

.omk-keyboard__row {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: var(--space-1);
}

.omk-keyboard__row .omk-key {
  grid-column: span var(--units);
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  font-family: var(--font-ui);
}

.omk-key__label {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.omk-key.is-active .omk-key__icon {
  fill: currentColor;
}

.omk-key__label--long {
  font-size: var(--text-min);
}
</style>
