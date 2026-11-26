import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountPreview } from '../../../preview/main'
import { CONSOLE_FIRST_SEQ } from '../../../preview/input/preview-dispatch'
import { Intent } from '../../../src/protocol/intents'

const TICKS = 5
const FRAME_MS = 16
const UHD_WIDTH = 3840
const UHD_HEIGHT = 2160
const UHD_ROOT_FONT = '32px'
const DPAD_RIGHT = 15
const BUTTON_COUNT = 17

async function settle(): Promise<void> {
  for (let tick = 0; tick < TICKS; tick += 1) {
    await nextTick()
    vi.advanceTimersByTime(FRAME_MS)
  }
  await nextTick()
}

function mounted(): HTMLElement {
  document.body.replaceChildren()
  const element = document.createElement('div')
  document.body.append(element)
  mountPreview(element)
  return element
}

beforeEach(() => {
  vi.useFakeTimers()
  document.head.replaceChildren()
  window.history.replaceState(null, '', '/?scenario=radial')
})

afterEach(() => {
  Reflect.deleteProperty(window, 'ui')
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('preview entry', () => {
  it('mounts the page inside the scene of the preview shell, which plays the scenario', async () => {
    const element = mounted()
    await settle()
    const scene = element.querySelector('.pv-scene')
    expect(scene?.querySelector('.omk-app')).not.toBeNull()
    expect(scene?.querySelector('[data-surface="radial-ring"]')).not.toBeNull()
    expect(element.querySelector('[data-omk-preview]')).not.toBeNull()
  })

  it('measures the page on the scene element, not on the window', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(UHD_WIDTH)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(UHD_HEIGHT)
    mounted()
    await settle()
    expect(document.documentElement.style.fontSize).toBe(UHD_ROOT_FONT)
  })

  it('numbers the intents of window.ui.dispatch from the console numbering', async () => {
    const element = mounted()
    await settle()
    window.ui?.dispatch(Intent.Right)
    await settle()
    expect(element.querySelector('.pv-log')?.textContent).toContain(String(CONSOLE_FIRST_SEQ + 1))
  })

  it('switches to the gamepad modality at the first gesture of the pad, whatever the scenario', async () => {
    const buttons = Array.from({ length: BUTTON_COUNT }, (_unused, index) => ({ pressed: index === DPAD_RIGHT, value: 1 }))
    window.history.replaceState(null, '', '/?scenario=whitelist-list')
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [{ connected: true, axes: [0, 0], buttons }] })
    const element = mounted()
    expect(element.querySelector('[data-surface="legend"]')?.getAttribute('data-modality')).not.toBe('gamepad')
    await settle()
    expect(element.querySelector('[data-surface="legend"]')?.getAttribute('data-modality')).toBe('gamepad')
    Reflect.deleteProperty(navigator, 'getGamepads')
  })

  it('removes nothing it did not install: the console api exists once mounted', async () => {
    mounted()
    await settle()
    expect(window.ui).toBeDefined()
  })
})
