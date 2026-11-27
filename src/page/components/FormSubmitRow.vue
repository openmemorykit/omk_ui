<script setup lang="ts">
import { SubmitState, type FormSubmitView } from '../application/views/form-submit-view'
import { PageCommandType } from '../domain/page-commands'
import { ALERT } from './chrome-icons'
import { useUi } from './use-ui'

const props = defineProps<{ submit: FormSubmitView }>()
const { dispatch } = useUi()

function hover(): void {
  dispatch({ type: PageCommandType.HoverItem, itemId: props.submit.id })
}

function click(): void {
  dispatch({ type: PageCommandType.ClickItem, itemId: props.submit.id })
}
</script>

<template>
  <div :id="submit.elementId" class="omk-item" role="option" :aria-selected="submit.focused" @mousemove="hover" @click="click">
    <div class="omk-row omk-row--primary" :class="{ 'is-focused': submit.focused }">
      <span class="omk-row__label">{{ submit.label }}</span>
      <span v-if="submit.state === SubmitState.Pending || submit.countText !== null" class="omk-row__value" :class="{ 'omk-row__value--warning': submit.countText !== null }">
        <span v-if="submit.state === SubmitState.Pending" class="omk-spinner" aria-hidden="true" />
        <span v-if="submit.countText !== null">{{ submit.countText }}</span>
      </span>
    </div>
    <div v-if="submit.message !== null" class="omk-row__error" role="alert">
      <svg class="omk-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="ALERT" /></svg>
      <span>{{ submit.message }}</span>
    </div>
  </div>
</template>

<style>
.omk-row__value--warning {
  color: var(--warning);
}

.omk-row.is-focused .omk-row__value.omk-row__value--warning {
  color: var(--focus-ink);
}
</style>
