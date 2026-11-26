<script setup lang="ts">
import { computed } from 'vue'
import { PreviewScene } from '../runtime/preview-settings'

interface Palette {
  readonly sky: string
  readonly haze: string
  readonly far: string
  readonly mid: string
  readonly near: string
  readonly window: string
  readonly road: string
  readonly walk: string
  readonly line: string
  readonly sun: string
  readonly neonA: string
  readonly neonB: string
  readonly figure: string
  readonly sunRadius: number
}
interface Rect {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fill: string
}
interface Layer {
  readonly shade: 'far' | 'mid'
  readonly top: number
  readonly bottom: number
  readonly minWidth: number
  readonly windows: boolean
}

const props = defineProps<{ scene: PreviewScene }>()

const PALETTES: Readonly<Record<PreviewScene, Palette>> = {
  [PreviewScene.Day]: { sky: '#8CC4EE', haze: '#D8E8F2', far: '#B4C3D3', mid: '#8E9CB2', near: '#5F6A80', window: '#C3CDDA', road: '#6C6F78', walk: '#A5A29A', line: '#F4F1E8', sun: '#FFF6D6', neonA: '#D2448A', neonB: '#2B95B5', figure: '#22232B', sunRadius: 70 },
  [PreviewScene.Night]: { sky: '#0B0E26', haze: '#2A1C46', far: '#161A38', mid: '#10112A', near: '#0A0A16', window: '#E7B770', road: '#17181F', walk: '#22232C', line: '#8A8676', sun: '#E6E3FF', neonA: '#FF4FA3', neonB: '#45E0FF', figure: '#0A0A10', sunRadius: 44 },
}
const SEED = 7
const LCG_MULTIPLIER = 16807
const LCG_MODULUS = 2147483647
const SKYLINE_BOTTOM = 700
const SKYLINE_START = -20
const SKYLINE_END = 1940
const SKYLINE_GAP = 6
const WIDTH_SPREAD = 90
const WINDOW_TOP_MARGIN = 18
const WINDOW_BOTTOM = 640
const WINDOW_ROW = 26
const WINDOW_COLUMN = 20
const WINDOW_SIDE_MARGIN = 12
const WINDOW_END_MARGIN = 14
const WINDOW_SIZE = { width: 9, height: 12 }
const LIT_THRESHOLD: Readonly<Record<PreviewScene, number>> = { [PreviewScene.Day]: 0.25, [PreviewScene.Night]: 0.55 }
const LAYERS: readonly Layer[] = [
  { shade: 'far', top: 260, bottom: 420, minWidth: 70, windows: false },
  { shade: 'mid', top: 330, bottom: 520, minWidth: 60, windows: true },
]

function createRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * LCG_MULTIPLIER) % LCG_MODULUS
    return state / LCG_MODULUS
  }
}

function windowsOf(random: () => number, x: number, top: number, width: number, scene: PreviewScene, fill: string): Rect[] {
  const found: Rect[] = []
  for (let y = top + WINDOW_TOP_MARGIN; y < WINDOW_BOTTOM; y += WINDOW_ROW) {
    for (let left = x + WINDOW_SIDE_MARGIN; left < x + width - WINDOW_END_MARGIN; left += WINDOW_COLUMN) {
      if (random() > LIT_THRESHOLD[scene]) found.push({ key: `w${left}-${y}`, x: left, y, fill, ...WINDOW_SIZE })
    }
  }
  return found
}

function buildSkyline(scene: PreviewScene): { blocks: Rect[]; windows: Rect[] } {
  const palette = PALETTES[scene]
  const random = createRandom(SEED)
  const blocks: Rect[] = []
  const windows: Rect[] = []
  for (const layer of LAYERS) {
    for (let x = SKYLINE_START; x < SKYLINE_END; ) {
      const width = layer.minWidth + random() * WIDTH_SPREAD
      const top = layer.top + random() * (layer.bottom - layer.top)
      const fill = palette[layer.shade]
      blocks.push({ key: `b${layer.shade}-${x}`, x, y: top, width, height: SKYLINE_BOTTOM - top, fill })
      if (layer.windows) windows.push(...windowsOf(random, x, top, width, scene, palette.window))
      x += width + SKYLINE_GAP
    }
  }
  return { blocks, windows }
}

const palette = computed(() => PALETTES[props.scene])
const skyline = computed(() => buildSkyline(props.scene))
</script>

<template>
  <svg class="pv-street" :data-scene="scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="1920" height="700" :fill="palette.sky" />
    <rect y="520" width="1920" height="180" :fill="palette.haze" />
    <circle cx="1500" cy="170" :r="palette.sunRadius" :fill="palette.sun" />
    <rect v-for="block in skyline.blocks" :key="block.key" :x="block.x" :y="block.y" :width="block.width" :height="block.height" :fill="block.fill" />
    <rect v-for="lit in skyline.windows" :key="lit.key" :x="lit.x" :y="lit.y" :width="lit.width" :height="lit.height" :fill="lit.fill" />
    <rect x="160" y="420" width="300" height="80" fill="none" :stroke="palette.neonA" stroke-width="8" />
    <rect x="1240" y="470" width="220" height="70" fill="none" :stroke="palette.neonB" stroke-width="8" />
    <rect y="640" width="1920" height="440" :fill="palette.walk" />
    <path d="M700 640H1220L1920 1080H0Z" :fill="palette.road" />
    <path d="M958 660h4v60h-4zM954 780h12v90h-12zM948 940h24v140h-24z" :fill="palette.line" />
    <circle cx="960" cy="720" r="26" :fill="palette.figure" />
    <path d="M910 760h100l14 130h-30l-8 140h-52l-8-140h-30z" :fill="palette.figure" />
    <rect x="1470" y="690" width="300" height="110" rx="14" :fill="palette.near" />
    <path d="M1520 690l40-60h140l40 60z" :fill="palette.near" />
    <rect x="1480" y="725" width="40" height="16" fill="#FF3B3B" />
    <rect x="1720" y="725" width="40" height="16" fill="#FF3B3B" />
    <circle cx="1530" cy="810" r="30" fill="#05050A" />
    <circle cx="1710" cy="810" r="30" fill="#05050A" />
  </svg>
</template>

<style>
.pv-street { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
</style>
