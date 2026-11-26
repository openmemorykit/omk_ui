import { DEFAULT_PREVIEW_SETTINGS } from '../../../preview/runtime/preview-settings'
import { createPreviewRuntime } from '../../../preview/runtime/scenario-runner'
import type { PreviewRuntime, ScenarioId } from '../../../preview/runtime/types'
import { SCENARIO_CATALOG } from '../../../preview/scenarios'
import { PageCommandType } from '../../../src/page/domain/page-commands'
import type { Frame, UiState } from '../../../src/page/domain/ui-state'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import { createFakeTime, createPageDriver, READY, type FakeTime, type PageDriver } from '../runtime/runtime-helpers'

export interface Played {
  readonly runtime: PreviewRuntime
  readonly page: PageDriver
  readonly time: FakeTime
}

export function play(id: ScenarioId): Played {
  const time = createFakeTime()
  const runtime = createPreviewRuntime({ clock: time.clock, scheduler: time.scheduler, catalog: SCENARIO_CATALOG })
  const page = createPageDriver((message) => runtime.deliver(message))
  runtime.listen((message) => page.dispatch(message))
  runtime.start(id, DEFAULT_PREVIEW_SETTINGS)
  runtime.deliver(READY)
  return { runtime, page, time }
}

export function press(page: PageDriver, intent: Intent, times = 1): void {
  for (let count = 0; count < times; count += 1) {
    page.dispatch({ type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Press, fromEscape: false })
    page.dispatch({ type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Release, fromEscape: false })
  }
}

export function topFrame(state: UiState): Frame | undefined {
  return state.stack[state.stack.length - 1]
}
