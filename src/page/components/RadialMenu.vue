<script setup lang="ts">
import { computed, watch } from 'vue'
import { radialView } from '../application/views/radial-view'
import { PageCommandType } from '../domain/page-commands'
import { CHILD_STEP_DEGREES, pointerVector, RADIAL_RING_OUTER, RADIAL_SUBRING_INNER, RADIAL_SUBRING_OUTER } from '../domain/radial-geometry'
import { Intent, IntentPhase } from '../../protocol/intents'
import { ICON_PATHS } from '../theme/icons'
import RadialSector from './RadialSector.vue'
import { useUi } from './use-ui'

const RING_INNER = 140
const NEEDLE_RADIUS = 137
const FULL_TURN = 360
const HALVES = 2
const MIDDLE = 0.5
const QUARTER_TURN = 90
const HALF_TURN = 180
const PATH_SEPARATOR = ' · '

const { state, dispatch, translate } = useUi()
const view = computed(() => radialView(state.value, translate))
const sectorHalf = computed(() => FULL_TURN / HALVES / Math.max(view.value?.sectors.length ?? 1, 1))
const childHalf = CHILD_STEP_DEGREES / HALVES
const centerPaths = computed(() => (view.value === null ? [] : ICON_PATHS[view.value.center.icon]))
const trail = computed(() => (view.value === null || view.value.center.path.length === 0 ? '' : [...view.value.center.path, view.value.center.name].join(PATH_SEPARATOR)))
const needle = computed(() => {
  const angle = view.value?.needleAngle ?? 0
  const radians = ((angle - QUARTER_TURN) * Math.PI) / HALF_TURN
  return `translate(${NEEDLE_RADIUS * Math.cos(radians)} ${NEEDLE_RADIUS * Math.sin(radians)}) rotate(${angle})`
})

let aimedNothing = false
watch(() => view.value === null, () => { aimedNothing = false })

function aim(event: PointerEvent): void {
  if (!(event.currentTarget instanceof Element)) return
  const box = event.currentTarget.getBoundingClientRect()
  const center = { x: box.left + box.width * MIDDLE, y: box.top + box.height * MIDDLE }
  const vector = pointerVector({ x: event.clientX, y: event.clientY }, center, box.width / (RADIAL_SUBRING_OUTER * HALVES), RADIAL_SUBRING_OUTER)
  aimedNothing = vector === null
  dispatch({ type: PageCommandType.PointerAim, vector })
}

function confirm(): void {
  if (aimedNothing) return
  dispatch({ type: PageCommandType.LocalIntent, intent: Intent.Confirm, phase: IntentPhase.Press, fromEscape: false })
  dispatch({ type: PageCommandType.LocalIntent, intent: Intent.Confirm, phase: IntentPhase.Release, fromEscape: false })
}
</script>

<template>
  <div v-if="view !== null" class="omk-radial-layer">
    <slot name="legend" />
    <div class="omk-radial omk-anim-zoom" role="menu" @pointermove="aim" @click="confirm">
      <div class="omk-radial__ring" data-surface="radial-ring" />
      <svg class="omk-radial__svg" viewBox="-424 -424 848 848" role="none">
        <RadialSector
          v-for="sector in view.sectors"
          :key="sector.id"
          :view="sector"
          :inner="RING_INNER"
          :outer="RADIAL_RING_OUTER"
          :half="sectorHalf"
          :popup="sector.hasChildren"
          :parent="sector.parent"
          :dimmed="sector.dimmed"
        />
        <RadialSector
          v-for="child in view.children"
          :key="child.id"
          sub
          :view="child"
          :inner="RADIAL_SUBRING_INNER"
          :outer="RADIAL_SUBRING_OUTER"
          :half="childHalf"
        />
        <g class="omk-radial__needle" :transform="needle"><path d="M0 -4L7 4H-7Z" /></g>
      </svg>
      <div class="omk-radial__center omk-surface-raised" data-surface="radial-center">
        <svg class="omk-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path v-for="path in centerPaths" :key="path" :d="path" />
        </svg>
        <span class="omk-radial__name">{{ view.center.name }}</span>
        <span class="omk-radial__desc">{{ view.center.description }}</span>
        <span v-if="trail.length > 0" class="omk-radial__path">{{ trail }}</span>
      </div>
    </div>
  </div>
</template>

<style>
.omk-radial-layer { display: contents; }
.omk-radial { position: absolute; top: 50%; left: 50%; width: calc(var(--radial-subring-outer) * 2); height: calc(var(--radial-subring-outer) * 2); margin: calc(var(--radial-subring-outer) * -1) 0 0 calc(var(--radial-subring-outer) * -1); contain: layout paint; }
.omk-radial__ring { position: absolute; top: 50%; left: 50%; width: calc(var(--radial-ring-outer) * 2); height: calc(var(--radial-ring-outer) * 2); margin: calc(var(--radial-ring-outer) * -1) 0 0 calc(var(--radial-ring-outer) * -1); border-radius: var(--radius-round); background-color: rgb(var(--panel-deep-rgb) / var(--panel-alpha)); box-shadow: var(--shadow-surface); }
.omk-radial__svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.omk-radial__fill { fill: var(--panel); stroke: var(--panel-deep); stroke-width: 4; }
.omk-radial__label { fill: var(--ink); font-family: var(--font-ui); font-size: 19px; font-weight: var(--font-weight-strong); text-anchor: middle; }
.omk-radial__icon { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.omk-radial__veil { fill: var(--dim-veil); }
.omk-radial__edge { fill: var(--accent); }
.omk-radial__sector.is-parent .omk-radial__fill { fill: var(--accent-dim); }
.omk-radial__sector.is-sub .omk-radial__fill { fill: var(--panel-raised); }
.omk-radial__sector.is-aimed .omk-radial__fill { fill: var(--focus-bg); stroke: var(--focus-bg); }
.omk-radial__sector.is-aimed .omk-radial__label { fill: var(--focus-ink); font-weight: var(--font-weight-bold); }
.omk-radial__sector.is-aimed .omk-radial__icon { stroke: var(--focus-ink); }
.omk-radial__needle { fill: var(--accent-text); }
.omk-radial__center { position: absolute; top: 50%; left: 50%; display: grid; align-content: center; justify-items: center; gap: var(--space-2); width: calc(var(--radial-hole) * 2); height: calc(var(--radial-hole) * 2); margin: calc(var(--radial-hole) * -1) 0 0 calc(var(--radial-hole) * -1); padding: 0 var(--space-7); border-radius: var(--radius-round); text-align: center; }
.omk-radial__center .omk-icon { width: 2.25rem; height: 2.25rem; color: var(--accent-text); }
.omk-radial__name { max-width: 100%; overflow: hidden; font-family: var(--font-head); font-size: var(--text-radial-name); font-weight: var(--font-weight-heavy); line-height: var(--leading-tight); text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.omk-radial__desc { color: var(--ink-2); font-size: var(--text-secondary); line-height: 1.25; }
.omk-radial__path { color: var(--accent-text); font-size: var(--text-min); font-weight: var(--font-weight-strong); line-height: var(--leading-tight); }
</style>
