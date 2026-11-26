<script setup lang="ts">
import { PageCommandType } from '../domain/page-commands'
import { CHEVRON_LEFT, CHEVRON_RIGHT } from './chrome-icons'
import { useUi } from './use-ui'

const props = defineProps<{ itemId: string; value: string }>()
const { dispatch } = useUi()
const BACKWARD = -1
const FORWARD = 1

function step(direction: typeof BACKWARD | typeof FORWARD): void {
  dispatch({ type: PageCommandType.StepItem, itemId: props.itemId, step: direction })
}
</script>

<template>
  <span class="omk-cycle">
    <svg class="omk-icon omk-cycle__arrow" viewBox="0 0 24 24" aria-hidden="true" @click.stop="step(BACKWARD)"><path :d="CHEVRON_LEFT" /></svg>
    <span class="omk-cycle__value">{{ value }}</span>
    <svg class="omk-icon omk-cycle__arrow" viewBox="0 0 24 24" aria-hidden="true" @click.stop="step(FORWARD)"><path :d="CHEVRON_RIGHT" /></svg>
  </span>
</template>
