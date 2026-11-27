import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPreviewRuntime } from '../../../preview/runtime/scenario-runner'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../preview/runtime/preview-settings'
import { ScenarioId, type PreviewRuntime } from '../../../preview/runtime/types'
import { SCENARIO_CATALOG } from '../../../preview/scenarios'
import { createPreviewHost } from '../../../src/page/infrastructure/host/preview-host'
import { createTimeoutScheduler } from '../../../src/page/infrastructure/timeout-scheduler'
import { mountOn, type MountedPage } from './rig'

const TICKS = 4

let runtime: PreviewRuntime
let page: MountedPage

function played(id: ScenarioId): void {
  const scheduler = createTimeoutScheduler({ setTimeout: (callback, delay) => window.setTimeout(callback, delay), clearTimeout: (handle) => window.clearTimeout(handle) })
  runtime = createPreviewRuntime({ clock: { now: () => performance.now() }, scheduler, catalog: SCENARIO_CATALOG })
  runtime.start(id, DEFAULT_PREVIEW_SETTINGS)
  page = mountOn(createPreviewHost(runtime))
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < TICKS; tick += 1) {
    await nextTick()
    page.frame()
  }
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers()
  document.head.replaceChildren()
})

afterEach(() => {
  page.unmount()
  vi.useRealTimers()
})

describe('page driven by the fake client', () => {
  it('shows the column when the fake client boots a whitelist list', async () => {
    played(ScenarioId.WhitelistList)
    await settle()
    expect(page.root().style.display).not.toBe('none')
    expect(page.container.querySelector('[data-surface="column"]')).not.toBeNull()
    expect(runtime.settled()).toBe(true)
  })

  it('shows the radial menu with the legend inside it and no second legend', async () => {
    played(ScenarioId.Radial)
    await settle()
    expect(page.container.querySelector('[data-surface="radial-ring"]')).not.toBeNull()
    expect(page.container.querySelectorAll('[data-surface="legend"]')).toHaveLength(1)
    expect(page.container.querySelector('.omk-radial-layer [data-surface="legend"]')).not.toBeNull()
  })

  it('puts the confirmation in the layer of the column', async () => {
    played(ScenarioId.ConfirmDanger)
    await settle()
    expect(page.container.querySelector('.omk-column__layer [data-surface="confirm"]')).not.toBeNull()
  })

  it('puts the virtual keyboard in the layer of the column, titled by its item', async () => {
    played(ScenarioId.KeyboardLetters)
    await settle()
    const keyboard = page.container.querySelector('.omk-column__layer [data-surface="keyboard"]')
    expect(keyboard).not.toBeNull()
    expect(keyboard?.querySelector('.omk-layer-title')?.textContent).not.toBe('')
    expect(keyboard?.querySelector('input')).toBe(document.activeElement)
  })

  it('shows notifications and the legend of the column in their places', async () => {
    played(ScenarioId.Toasts)
    await settle()
    expect(page.container.querySelectorAll('[data-surface="toast"]').length).toBeGreaterThan(0)
  })

  it('shows the hold prompt', async () => {
    played(ScenarioId.PromptHold)
    await settle()
    expect(page.container.querySelector('[data-surface="prompt"]')).not.toBeNull()
  })
})
