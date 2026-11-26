<script setup lang="ts">
import { computed } from 'vue'
import type { RadialChildView } from '../application/views/radial-view'
import { ICON_PATHS } from '../theme/icons'

const QUARTER_TURN = 90
const HALF_TURN = 180
const PRECISION = 100
const ICON_SIZE = 24
const ICON_RISE = 30
const LABEL_DROP = 18
const EDGE_WIDTH = 8
const MIDDLE = 0.5

const props = defineProps<{
  view: RadialChildView
  inner: number
  outer: number
  half: number
  popup?: boolean
  parent?: boolean
  dimmed?: boolean
  sub?: boolean
}>()

const round = (value: number): number => Math.round(value * PRECISION) / PRECISION

function point(radius: number, degrees: number): string {
  const radians = ((degrees - QUARTER_TURN) * Math.PI) / HALF_TURN
  return `${round(radius * Math.cos(radians))} ${round(radius * Math.sin(radians))}`
}

function band(inner: number, outer: number, from: number, to: number): string {
  const large = to - from > HALF_TURN ? 1 : 0
  return `M${point(outer, from)}A${outer} ${outer} 0 ${large} 1 ${point(outer, to)}L${point(inner, to)}A${inner} ${inner} 0 ${large} 0 ${point(inner, from)}Z`
}

const shape = computed(() => band(props.inner, props.outer, props.view.angle - props.half, props.view.angle + props.half))
const edge = computed(() => band(props.outer - EDGE_WIDTH, props.outer, props.view.angle - props.half, props.view.angle + props.half))
const anchor = computed(() => point((props.inner + props.outer) * MIDDLE, props.view.angle).split(' ').map(Number))
const iconAt = computed(() => `translate(${round((anchor.value[0] ?? 0) - ICON_SIZE * MIDDLE)} ${round((anchor.value[1] ?? 0) - ICON_RISE)})`)
const paths = computed(() => ICON_PATHS[props.view.icon])
</script>

<template>
  <g
    role="menuitem"
    class="omk-radial__sector"
    :class="{ 'is-aimed': view.aimed, 'is-parent': parent, 'is-dimmed': dimmed, 'is-sub': sub }"
    :aria-label="view.label"
    :aria-haspopup="popup ? 'menu' : undefined"
    :aria-current="view.aimed ? 'true' : undefined"
  >
    <path class="omk-radial__fill" :d="shape" />
    <path v-if="parent" class="omk-radial__edge" :d="edge" />
    <g :transform="iconAt">
      <path v-for="path in paths" :key="path" class="omk-radial__icon" :d="path" />
    </g>
    <text class="omk-radial__label" :x="anchor[0]" :y="(anchor[1] ?? 0) + LABEL_DROP">{{ view.label }}</text>
    <path v-if="dimmed" class="omk-radial__veil" :d="shape" />
  </g>
</template>
