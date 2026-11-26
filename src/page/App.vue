<script setup lang="ts">
import './theme/tokens.css'
import './theme/base.css'
import { computed } from 'vue'
import { appView, AppLayerKind, LegendHost } from './application/views/app-view'
import ConfirmLayer from './components/ConfirmLayer.vue'
import HoldPrompt from './components/HoldPrompt.vue'
import KeyLegend from './components/KeyLegend.vue'
import PanelColumn from './components/PanelColumn.vue'
import RadialMenu from './components/RadialMenu.vue'
import ToastStack from './components/ToastStack.vue'
import { useUi } from './components/use-ui'
import VirtualKeyboard from './components/VirtualKeyboard.vue'

const { state, translate } = useUi()
const view = computed(() => appView(state.value, translate))
const confirm = computed(() => (view.value.layer?.kind === AppLayerKind.Confirm ? view.value.layer.view : null))
const keyboard = computed(() => (view.value.layer?.kind === AppLayerKind.Keyboard ? view.value.layer : null))
const HIDDEN = { display: 'none' }
</script>

<template>
  <div class="omk-app" :style="view.visible ? undefined : HIDDEN" :lang="view.lang">
    <PanelColumn>
      <template #layer>
        <ConfirmLayer v-if="confirm !== null" :view="confirm" />
        <VirtualKeyboard v-else-if="keyboard !== null" :view="keyboard.view" :title="keyboard.title" />
      </template>
      <template #legend><KeyLegend v-if="view.legend === LegendHost.Column" /></template>
    </PanelColumn>
    <RadialMenu>
      <template #legend><KeyLegend v-if="view.legend === LegendHost.Radial" /></template>
    </RadialMenu>
    <div v-if="view.layerAlone && confirm !== null" class="omk-app__alone">
      <ConfirmLayer :view="confirm" />
    </div>
    <ToastStack />
    <HoldPrompt />
  </div>
  <div class="omk-sr-only" role="status" aria-live="polite" />
  <div class="omk-sr-only" role="alert" aria-live="assertive" />
</template>

<style>
.omk-app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  contain: layout;
}

.omk-column__legend:empty {
  display: none;
}

.omk-app__alone {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.omk-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  white-space: nowrap;
  clip-path: inset(50%);
}
</style>
