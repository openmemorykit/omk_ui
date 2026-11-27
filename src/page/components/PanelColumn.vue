<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { BrandKind, ColumnRowKind, columnView } from '../application/views/column-view'
import { CHEVRON_DOWN, CHEVRON_RIGHT, CHEVRON_UP, INFO } from './chrome-icons'
import FormSubmitRow from './FormSubmitRow.vue'
import ItemRow from './ItemRow.vue'
import { useUi } from './use-ui'

const PUSH = 'omk-anim-push'
const POP = 'omk-anim-pop'
const NO_ROWS = 0
const { state, translate } = useUi()
const view = computed(() => columnView(state.value, translate))
const enterClass = shallowRef(PUSH)
const list = useTemplateRef<HTMLElement>('list')

const rowsBefore = computed(() => `calc(${String(view.value?.windowStart ?? NO_ROWS)} * var(--row-height))`)
const rowsAfter = computed(() => {
  const current = view.value
  const hidden = current === null ? NO_ROWS : current.rowCount - current.windowStart - current.rows.length
  return `calc(${String(hidden)} * var(--row-height))`
})

function revealActive(): void {
  const wanted = view.value?.activeDescendant ?? null
  if (wanted === null || list.value === null) return
  const options = [...list.value.querySelectorAll('[role="option"]')]
  options.find((option) => option.id === wanted)?.scrollIntoView({ block: 'nearest' })
}

watch(
  () => view.value?.crumbs.length ?? NO_ROWS,
  (depth, before) => {
    enterClass.value = depth < before ? POP : PUSH
  },
)
watch(() => [view.value?.panelId, view.value?.activeDescendant], revealActive, { flush: 'post' })
onMounted(revealActive)
</script>

<template>
  <section v-if="view !== null" class="omk-column omk-surface-deep omk-surface-lifted" data-surface="column" :data-side="view.side" :data-dimmed="view.dimmed ? '' : undefined">
    <header class="omk-banner">
      <img v-if="view.brand.kind === BrandKind.Logo" class="omk-logo" :src="view.brand.logo ?? ''" alt="" />
      <span v-else class="omk-monogram" aria-hidden="true">{{ view.brand.monogram }}</span>
      <span class="omk-banner__text">
        <span class="omk-title">{{ view.title }}</span>
        <span v-if="view.subtitle !== null" class="omk-banner__subtitle">{{ view.subtitle }}</span>
      </span>
    </header>
    <nav class="omk-crumbs omk-surface-deep">
      <template v-for="(crumb, index) in view.crumbs" :key="crumb.id">
        <svg v-if="index > 0" class="omk-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="CHEVRON_RIGHT" /></svg>
        <span class="omk-crumbs__crumb" :class="{ 'is-current': index === view.crumbs.length - 1 }">{{ crumb.title }}</span>
      </template>
    </nav>
    <div class="omk-column__body">
      <div v-if="view.covered" class="omk-column__layer omk-surface-raised"><slot name="layer" /></div>
      <div class="omk-rows">
        <div :key="view.panelId" ref="list" class="omk-rows__list" :class="enterClass" role="listbox" :aria-label="view.title" :aria-activedescendant="view.activeDescendant ?? undefined">
          <div class="omk-rows__spacer" aria-hidden="true" :style="{ height: rowsBefore }" />
          <template v-for="entry in view.rows" :key="entry.id">
            <ItemRow v-if="entry.kind === ColumnRowKind.Item" :row="entry.row" />
            <FormSubmitRow v-else :submit="entry.submit" />
          </template>
          <div class="omk-rows__spacer" aria-hidden="true" :style="{ height: rowsAfter }" />
        </div>
        <p v-if="view.emptyText !== null" class="omk-column__empty omk-secondary">{{ view.emptyText }}</p>
      </div>
      <footer class="omk-foot omk-surface-deep">
        <span class="omk-foot__arrows" aria-hidden="true">
          <svg class="omk-icon omk-foot__arrow" :class="{ 'is-on': view.canScrollUp }" viewBox="0 0 24 24"><path :d="CHEVRON_UP" /></svg>
          <svg class="omk-icon omk-foot__arrow" :class="{ 'is-on': view.canScrollDown }" viewBox="0 0 24 24"><path :d="CHEVRON_DOWN" /></svg>
        </span>
        <span v-if="view.counter !== null" class="omk-foot__position"><span class="omk-foot__count">{{ view.counter.position }}</span> <span class="omk-foot__total">/ {{ view.counter.total }}</span></span>
      </footer>
    </div>
    <p v-if="view.description !== null" class="omk-description omk-secondary">
      <svg class="omk-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="INFO" /></svg>
      <span>{{ view.description.text }}</span>
    </p>
    <div v-if="$slots.legend" class="omk-column__legend"><slot name="legend" /></div>
  </section>
</template>

<style>
.omk-column[data-surface] {
  position: absolute;
  top: var(--column-edge);
  width: var(--column-width);
  contain: layout paint;
}

.omk-column[data-side="left"] {
  left: var(--column-edge);
}

.omk-column[data-side="right"] {
  right: var(--column-edge);
}

.omk-banner {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  height: var(--banner-height);
  padding: 0 var(--space-6);
  background-color: var(--accent);
  color: var(--accent-ink);
}

.omk-monogram, .omk-logo {
  flex: none;
  width: var(--monogram-size);
  height: var(--monogram-size);
}

.omk-logo {
  object-fit: contain;
}

.omk-monogram {
  display: grid;
  place-items: center;
  border: var(--focus-ring) solid currentColor;
  font-family: var(--font-head);
  font-size: var(--text-monogram);
  font-weight: var(--font-weight-heavy);
  line-height: var(--leading-tight);
}

.omk-banner__text {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: var(--space-1);
}

.omk-banner__subtitle {
  overflow: hidden;
  font-size: var(--text-secondary);
  font-weight: var(--font-weight-bold);
  line-height: var(--leading-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.omk-crumbs {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--bar-height);
  padding: 0 var(--space-4) 0 var(--space-6);
  color: var(--ink-3);
  font-size: var(--text-secondary);
  font-weight: var(--font-weight-strong);
  white-space: nowrap;
}

.omk-crumbs .omk-icon {
  width: var(--icon-small);
  height: var(--icon-small);
  color: var(--ink-faint);
}

.omk-crumbs__crumb.is-current {
  color: var(--ink);
}

.omk-column__body {
  position: relative;
}

.omk-rows {
  height: calc(var(--visible-rows) * var(--row-height) + var(--space-3));
  padding: var(--space-1) 0;
  overflow: hidden;
  background-color: var(--panel);
}

.omk-column__empty {
  margin: 0;
  padding: var(--space-6);
}

.omk-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--foot-height);
  padding: 0 var(--space-6);
  color: var(--ink-3);
  font-size: var(--text-min);
  font-weight: var(--font-weight-strong);
  font-variant-numeric: tabular-nums;
}

.omk-foot__arrows {
  display: flex;
  gap: var(--space-1);
}

.omk-foot__arrow {
  width: var(--icon-small);
  height: var(--icon-small);
  color: var(--ink-faint);
}

.omk-foot__arrow.is-on, .omk-foot__count {
  color: var(--ink);
}

.omk-column__layer ~ .omk-rows {
  height: 0;
  padding: 0;
  visibility: hidden;
}

.omk-column__layer ~ .omk-foot {
  display: none;
}

.omk-column__layer > [data-surface] {
  box-shadow: none;
}

.omk-description {
  display: flex;
  gap: var(--space-4);
  min-height: var(--description-height);
  margin: var(--space-2) 0 0;
  padding: var(--space-4) var(--space-6);
  background-color: var(--panel);
}

.omk-description .omk-icon {
  width: var(--icon-small);
  height: var(--icon-small);
  margin-top: var(--space-1);
  color: var(--ink-3);
}

.omk-column__legend {
  margin-top: var(--space-2);
  border-top: 0.0625rem solid var(--line);
}
</style>
