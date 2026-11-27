<script setup lang="ts">
import type { ChoiceView, ConfirmView } from '../application/views/confirm-view'
import { PageCommandType } from '../domain/page-commands'
import { useUi } from './use-ui'

defineProps<{ view: ConfirmView }>()
const { dispatch } = useUi()

function hover(choice: ChoiceView): void {
  dispatch({ type: PageCommandType.HoverItem, itemId: choice.id })
}

function choose(choice: ChoiceView): void {
  dispatch({ type: PageCommandType.ClickItem, itemId: choice.id })
}

function choiceClasses(choice: ChoiceView): Record<string, boolean> {
  return { 'is-focused': choice.focused, 'omk-row--danger': choice.danger }
}
</script>

<template>
  <section class="omk-confirm omk-surface-raised omk-surface-lifted omk-anim-rise" data-surface="confirm" role="dialog" aria-modal="true" :aria-label="view.title" aria-describedby="omk-confirm-text">
    <div class="omk-layer-head" :class="{ 'layer-head--danger': view.danger }">
      <span class="omk-layer-title">{{ view.title }}</span>
    </div>
    <p id="omk-confirm-text" class="omk-confirm__text omk-secondary">{{ view.text }}</p>
    <div class="omk-confirm__choices" role="group">
      <div
        v-for="choice in view.choices"
        :key="choice.id"
        class="omk-row"
        :class="choiceClasses(choice)"
        role="button"
        @mousemove="hover(choice)"
        @click="choose(choice)"
      >
        <span class="omk-row__label">{{ choice.label }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.omk-confirm {
  width: var(--column-width);
}

.omk-layer-head {
  display: flex;
  align-items: center;
  height: 3.5rem;
  padding: 0 var(--space-6);
  border-top: var(--stroke-key) solid var(--accent);
}

.layer-head--danger {
  border-top-color: var(--error);
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

.omk-confirm__text {
  margin: 0;
  padding: var(--space-5) var(--space-6) var(--space-4);
}

.omk-confirm__choices {
  margin: 0;
  padding: 0;
  background-color: var(--panel);
}
</style>
