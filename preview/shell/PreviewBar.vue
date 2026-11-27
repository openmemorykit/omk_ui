<script setup lang="ts">
import { computed } from 'vue'
import { GlyphSet } from '../../src/protocol/page-vocabulary'
import { PanelSide } from '../../src/shared/config/theme-defaults'
import { PreviewLanguage, PreviewScene, type PreviewSettings } from '../runtime/preview-settings'
import { ScenarioId } from '../runtime/types'
import { MAX_SCALE, MIN_SCALE, UrlParam } from './url-settings'

interface Field {
  readonly param: UrlParam
  readonly name: string
  readonly label: string
  readonly value: string
  readonly options: readonly string[]
}

const props = defineProps<{ scenario: ScenarioId; settings: PreviewSettings }>()
const emit = defineEmits<{ change: [param: UrlParam, value: string] }>()

const SCALE_STEP = 0.05
const RESOLUTIONS: readonly string[] = ['1280x720', '1920x1080', '2560x1440']

const resolution = computed(() => `${props.settings.resolution.width}x${props.settings.resolution.height}`)
const fields = computed<readonly Field[]>(() => [
  { param: UrlParam.Scenario, name: 'scenario', label: 'Scenario', value: props.scenario, options: Object.values(ScenarioId) },
  { param: UrlParam.Resolution, name: 'resolution', label: 'Resolution', value: resolution.value, options: [...new Set([...RESOLUTIONS, resolution.value])] },
  { param: UrlParam.Scene, name: 'scene', label: 'Scene', value: props.settings.scene, options: Object.values(PreviewScene) },
  { param: UrlParam.Glyphs, name: 'glyphs', label: 'Glyphs', value: props.settings.glyphSet, options: Object.values(GlyphSet) },
  { param: UrlParam.Side, name: 'side', label: 'Side', value: props.settings.side, options: Object.values(PanelSide) },
  { param: UrlParam.Language, name: 'language', label: 'Language', value: props.settings.language, options: Object.values(PreviewLanguage) },
])

function choose(param: UrlParam, event: Event): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) emit('change', param, event.target.value)
}
</script>

<template>
  <form class="pv-bar" data-surface="preview-bar" aria-label="Preview settings" @submit.prevent>
    <div v-for="field in fields" :key="field.param" class="pv-field">
      <label :for="`pv-${field.name}`">{{ field.label }}</label>
      <select :id="`pv-${field.name}`" :name="field.name" @change="choose(field.param, $event)">
        <option v-for="option in field.options" :key="option" :value="option" :selected="option === field.value">{{ option }}</option>
      </select>
    </div>
    <div class="pv-field">
      <label for="pv-accent">Accent</label>
      <input id="pv-accent" name="accent" type="color" :value="settings.accent" @change="choose(UrlParam.Accent, $event)" />
    </div>
    <div class="pv-field">
      <label for="pv-scale">Server scale</label>
      <input id="pv-scale" name="scale" type="number" :min="MIN_SCALE" :max="MAX_SCALE" :step="SCALE_STEP" :value="settings.scale" @change="choose(UrlParam.Scale, $event)" />
    </div>
  </form>
</template>

<style>
.pv-bar { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; align-items: flex-end; padding: 0.75rem 1rem; background: #16141f; color: #f4f2f9; font: 1.125rem/1.35 system-ui, sans-serif; }
.pv-field { display: flex; flex-direction: column; gap: 0.25rem; }
.pv-field label { color: #c6c1d6; }
.pv-field select, .pv-field input { min-height: 2.25rem; padding: 0 0.5rem; border: 0.125rem solid #46435a; border-radius: 0.25rem; background: #0c0b13; color: inherit; font: inherit; }
.pv-field select:focus-visible, .pv-field input:focus-visible { outline: 0.1875rem solid #ffd166; outline-offset: 0.125rem; }
</style>
