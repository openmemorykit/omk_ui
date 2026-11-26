import { createApp, h } from 'vue'
import { createPageApp } from '../src/page/bootstrap'
import { Modality } from '../src/protocol/intents'
import { UiMode } from '../src/protocol/page-vocabulary'
import { createFrameRequester } from '../src/page/infrastructure/frame-requester'
import { createPreviewHost } from '../src/page/infrastructure/host/preview-host'
import { createTimeoutScheduler } from '../src/page/infrastructure/timeout-scheduler'
import { createElementViewport } from '../src/page/infrastructure/viewport'
import { createGamepadApiSource } from './input/gamepad-api-source'
import { numberConsoleMessages, withGamepadModality } from './input/preview-dispatch'
import { createPreviewRuntime } from './runtime/scenario-runner'
import { SCENARIO_CATALOG } from './scenarios'
import { installConsoleApi } from './shell/console-api'
import PreviewShell from './shell/PreviewShell.vue'

const PAGE_SLOT_ID = 'omk-page'

export function mountPreview(element: Element): void {
  const scheduler = createTimeoutScheduler({
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (handle) => window.clearTimeout(handle),
  })
  const runtime = createPreviewRuntime({ clock: { now: () => window.performance.now() }, scheduler, catalog: SCENARIO_CATALOG })
  createApp({ render: () => h(PreviewShell, { runtime }, { default: () => h('div', { id: PAGE_SLOT_ID }) }) }).mount(element)
  const slot = element.querySelector(`#${PAGE_SLOT_ID}`)
  const scene = slot?.parentElement
  if (slot === null || scene === null || scene === undefined) return
  createPageApp({
    host: createPreviewHost(runtime),
    win: window,
    viewport: createElementViewport(scene),
    attachInputs: ({ dispatch, state }) => {
      const padFrames = createFrameRequester((callback) => window.requestAnimationFrame(callback))
      const gesture = withGamepadModality(dispatch, () => state().modality)
      const stopPad = createGamepadApiSource(window.navigator, padFrames, gesture, () => ({ modality: Modality.Gamepad, radialOpen: state().mode === UiMode.Radial }))
      const number = numberConsoleMessages()
      const stopConsole = installConsoleApi(window, (message) => dispatch(number(message)))
      return () => {
        stopPad()
        stopConsole()
      }
    },
  }).mount(slot)
}
