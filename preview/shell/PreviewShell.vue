<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import type { LogEntry, PreviewRuntime } from '../runtime/types'
import MessageLog from './MessageLog.vue'
import PreviewBar from './PreviewBar.vue'
import StreetScene from './StreetScene.vue'
import { readUrlScenario, readUrlSettings, toSearch, type UrlParam } from './url-settings'

const props = withDefaults(defineProps<{ runtime: PreviewRuntime; search?: string }>(), { search: () => window.location.search })

const scenario = shallowRef(readUrlScenario(props.search))
const settings = shallowRef(readUrlSettings(props.search))
const entries = shallowRef<readonly LogEntry[]>([])
const scene = useTemplateRef<HTMLElement>('scene')
let generation = 0
let stopLog: (() => void) | null = null

function markReady(token: number): void {
  if (token === generation) document.documentElement.dataset.captureReady = 'true'
}

function awaitCapture(token: number): void {
  if (token !== generation) return
  if (!props.runtime.settled()) {
    requestAnimationFrame(() => awaitCapture(token))
    return
  }
  requestAnimationFrame(() => requestAnimationFrame(() => markReady(token)))
}

function run(): void {
  generation += 1
  delete document.documentElement.dataset.captureReady
  props.runtime.start(scenario.value, settings.value)
  if (settings.value.capture) awaitCapture(generation)
}

function change(param: UrlParam, value: string): void {
  const next = new URLSearchParams(toSearch(scenario.value, settings.value))
  next.set(param, value)
  scenario.value = readUrlScenario(next.toString())
  settings.value = readUrlSettings(next.toString())
  window.history.replaceState(null, '', toSearch(scenario.value, settings.value))
  run()
}

onMounted(() => {
  if (!settings.value.capture) stopLog = props.runtime.onLog(() => (entries.value = props.runtime.log()))
  run()
})

onBeforeUnmount(() => {
  generation += 1
  stopLog?.()
  delete document.documentElement.dataset.captureReady
})

defineExpose({ scene })
</script>

<template>
  <div class="pv-shell" data-omk-preview="true" :data-capture="settings.capture ? 'true' : undefined">
    <PreviewBar v-if="!settings.capture" :scenario="scenario" :settings="settings" @change="change" />
    <div class="pv-main">
      <div class="pv-stage">
        <div
          ref="scene"
          class="pv-scene"
          data-surface="preview-scene"
          :style="settings.capture ? undefined : { width: `${settings.resolution.width}px`, height: `${settings.resolution.height}px` }"
        >
          <StreetScene :scene="settings.scene" />
          <slot />
        </div>
      </div>
      <MessageLog v-if="!settings.capture" :entries="entries" />
    </div>
  </div>
</template>

<style>
.pv-shell { display: flex; flex-direction: column; height: 100vh; background: #0c0b13; }
.pv-main { display: flex; flex: 1; min-height: 0; }
.pv-stage { flex: 1; min-width: 0; overflow: auto; }
.pv-scene { position: relative; overflow: hidden; }
.pv-main > .pv-log { width: 28rem; }
.pv-shell[data-capture] { display: block; height: auto; }
.pv-shell[data-capture] .pv-main { display: block; }
.pv-shell[data-capture] .pv-stage { overflow: hidden; }
.pv-shell[data-capture] .pv-scene { position: fixed; inset: 0; width: 100vw; height: 100vh; }
</style>
