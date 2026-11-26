<script setup lang="ts">
import { computed } from 'vue'
import { RowKind, RowVariant, type RowView } from '../application/views/row-view'
import { PageCommandType } from '../domain/page-commands'
import { ICON_PATHS } from '../theme/icons'
import { ALERT } from './chrome-icons'
import CycleValue from './CycleValue.vue'
import SectionHeader from './SectionHeader.vue'
import TextValue from './TextValue.vue'
import ToggleSwitch from './ToggleSwitch.vue'
import { useUi } from './use-ui'

const props = defineProps<{ row: RowView }>()
const { dispatch } = useUi()
const NO_PATHS: readonly string[] = []

const iconPaths = computed(() => (props.row.icon === null ? NO_PATHS : ICON_PATHS[props.row.icon]))
const variantClass = computed(() => (props.row.variant === RowVariant.Default ? null : `omk-row--${props.row.variant}`))
const hasValue = computed(() => props.row.kind !== RowKind.Plain || props.row.pending || props.row.value !== null || props.row.badge !== null)

function hover(): void {
  dispatch({ type: PageCommandType.HoverItem, itemId: props.row.id })
}

function click(): void {
  dispatch({ type: PageCommandType.ClickItem, itemId: props.row.id })
}
</script>

<template>
  <SectionHeader v-if="row.kind === RowKind.Section" :label="row.label" />
  <div v-else :id="row.elementId" class="omk-item" role="option" :aria-selected="row.focused" :aria-disabled="row.disabled ? 'true' : undefined" @mousemove="hover" @click="click">
    <div class="omk-row" :class="[variantClass, { 'is-focused': row.focused, 'is-disabled': row.disabled }]">
      <svg v-if="row.icon !== null" class="omk-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="path in iconPaths" :key="path" :d="path" /></svg>
      <span class="omk-row__label">{{ row.label }}</span>
      <span v-if="hasValue" class="omk-row__value">
        <span v-if="row.pending" class="omk-spinner" aria-hidden="true" />
        <CycleValue v-if="row.kind === RowKind.Cycle" :item-id="row.id" :value="row.value ?? ''" />
        <ToggleSwitch v-else-if="row.kind === RowKind.Toggle" :item-id="row.id" :on="row.on" />
        <TextValue v-else-if="row.kind === RowKind.Text" :text="row.value ?? ''" :empty="row.empty" :placeholder="row.placeholder" />
        <span v-else-if="row.value !== null" class="omk-row__text">{{ row.value }}</span>
        <span v-if="row.badge !== null" class="omk-badge" :data-tone="row.badge.tone">{{ row.badge.label }}</span>
      </span>
    </div>
    <div v-if="row.error !== null" class="omk-row__error" role="alert">
      <svg class="omk-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="ALERT" /></svg>
      <span>{{ row.error }}</span>
    </div>
  </div>
</template>
