import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { Intent, IntentPhase, InputSource } from '../../../src/protocol/intents'
import { FromPage } from '../../../src/protocol/from-page'
import { ToPage } from '../../../src/protocol/to-page'
import { TO_PAGE_SAMPLES } from '../../fixtures/messages'
import { OWNED_REMOVE_CONFIRM } from '../../fixtures/owned'
import { trackListeners, type ListenerLedger } from '../infrastructure/ledger'
import appSource from '../../../src/page/App.vue?raw'
import { FULL_HD, mountScripted, ROOT_SELECTOR, type MountedPage, type ScriptedHost } from './rig'

createApp({ render: () => null }).unmount()

const BOOT = TO_PAGE_SAMPLES[ToPage.Boot]
const SMALL = { width: 1280, height: 720 }
const FIRST_SEQ = 1
const COMMAND_SEQ = 9

let page: MountedPage<ScriptedHost>
let ledger: ListenerLedger

async function settle(): Promise<void> {
  await nextTick()
  page.frame()
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers()
  document.documentElement.removeAttribute('style')
  document.head.replaceChildren()
  ledger = trackListeners(window)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  page.unmount()
  ledger.restore()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('page at rest', () => {
  beforeEach(() => {
    page = mountScripted()
  })

  it('hides the root and leaves no timer nor frame pending', () => {
    expect(page.root().style.display).toBe('none')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not even ask for a frame or a timer', () => {
    const frames = vi.spyOn(window, 'requestAnimationFrame')
    const timers = vi.spyOn(window, 'setTimeout')
    page.unmount()
    page = mountScripted()
    expect(frames).not.toHaveBeenCalled()
    expect(timers).not.toHaveBeenCalled()
  })

  it('asks the host for its boot once, by listening', () => {
    expect(page.host.sent).toEqual([{ type: FromPage.Ready }])
    expect(page.host.listening()).toBe(1)
  })

  it('has a polite status region and an assertive alert region, both outside the hidden root', () => {
    const status = page.container.querySelector('[role="status"]')
    const alert = page.container.querySelector('[role="alert"]')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(alert?.getAttribute('aria-live')).toBe('assertive')
    expect(page.root().contains(status)).toBe(false)
    expect(page.root().contains(alert)).toBe(false)
  })

  it('draws no surface', () => {
    expect(page.container.querySelector('[data-surface]')).toBeNull()
  })
})

describe('page after boot', () => {
  beforeEach(async () => {
    page = mountScripted()
    page.host.emit(BOOT)
    await settle()
  })

  it('shows the column once the host booted', () => {
    expect(page.root().style.display).not.toBe('none')
    expect(page.container.querySelectorAll('[data-surface="column"]')).toHaveLength(1)
  })

  it('takes the language of the locale on the root', () => {
    expect(page.root().getAttribute('lang')).toBe(BOOT.locale.language)
  })

  it('acknowledges an intent with one ack on the next frame', async () => {
    page.host.emit({ type: ToPage.Intent, seq: FIRST_SEQ, intent: Intent.Down, phase: IntentPhase.Press, source: InputSource.Pad })
    await settle()
    expect(page.host.sent.filter((message) => message.type === FromPage.Ack)).toEqual([{ type: FromPage.Ack, lastIntentSeq: FIRST_SEQ }])
  })

  it('moves the focus with the physical keyboard', async () => {
    const before = page.container.querySelector('[aria-activedescendant]')?.getAttribute('aria-activedescendant')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', cancelable: true }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }))
    await settle()
    expect(page.container.querySelector('[aria-activedescendant]')?.getAttribute('aria-activedescendant')).not.toBe(before)
  })

  it('reports the loss of the window focus to the domain', async () => {
    window.dispatchEvent(new Event('blur'))
    await settle()
    expect(page.host.sent.filter((message) => message.type === FromPage.Paused)).toContainEqual({ type: FromPage.Paused, paused: true })
  })
})

describe('legend placement', () => {
  it('moves the legend from the column to the radial menu, never showing two', async () => {
    page = mountScripted()
    page.host.emit(BOOT)
    await settle()
    expect(page.container.querySelectorAll('.omk-column [data-surface="legend"]')).toHaveLength(1)
    page.host.emit({ type: ToPage.OpenRadial })
    await settle()
    expect(page.container.querySelectorAll('[data-surface="legend"]')).toHaveLength(1)
    expect(page.container.querySelector('.omk-radial-layer [data-surface="legend"]')).not.toBeNull()
    expect(page.container.querySelector('.omk-column__legend')?.children).toHaveLength(0)
  })

  it('floats the radial legend, centred above the radial, instead of a full-width strip', async () => {
    page = mountScripted()
    page.host.emit(BOOT)
    page.host.emit({ type: ToPage.OpenRadial })
    await settle()
    const placement = page.container.querySelector('.omk-radial-layer [data-surface="legend"]')?.closest('.omk-app__radial-legend')
    expect(placement).not.toBeNull()
    expect(placement?.parentElement?.classList.contains('omk-radial-layer')).toBe(true)
    const rule = /\.omk-app__radial-legend\s*\{([^}]*)\}/.exec(appSource)?.[1] ?? ''
    expect(rule).toMatch(/position:\s*absolute/)
    expect(rule).toMatch(/left:\s*50%/)
    expect(rule).toMatch(/transform:\s*translateX\(-50%\)/)
    expect(rule).toMatch(/top:\s*var\(--space-/)
  })
})

describe('live regions', () => {
  it('speak the language of the locale as the root does, so that an announcement is not read with the language of the document', async () => {
    page = mountScripted()
    expect(page.container.querySelector('[role="status"]')?.getAttribute('lang')).toBeTruthy()
    page.host.emit({ ...BOOT, locale: { ...BOOT.locale, language: 'en' } })
    await settle()
    expect(page.root().getAttribute('lang')).toBe('en')
    expect(page.container.querySelector('[role="status"]')?.getAttribute('lang')).toBe('en')
    expect(page.container.querySelector('[role="alert"]')?.getAttribute('lang')).toBe('en')
  })

  it('announces an opened panel in the status region and a form error in the alert region', async () => {
    page = mountScripted()
    page.host.emit(TO_PAGE_SAMPLES[ToPage.OpenPanel])
    await settle()
    expect(page.container.querySelector('[role="status"]')?.textContent).toContain('ui.announce.panelOpened')
    expect(page.container.querySelector('[role="alert"]')?.textContent).toBe('')
  })
})

describe('confirmation without panel', () => {
  it('renders the confirmation alone, centered, with the root visible', async () => {
    page = mountScripted()
    page.host.emit({ ...BOOT, panels: [], radialEntries: [], commandSeq: 0 })
    page.host.emit({ type: ToPage.ShowConfirm, commandSeq: COMMAND_SEQ, confirm: OWNED_REMOVE_CONFIRM })
    await settle()
    const confirm = page.container.querySelector<HTMLElement>('[data-surface="confirm"]')
    expect(confirm).not.toBeNull()
    expect(page.container.querySelector('[data-surface="column"]')).toBeNull()
    expect(page.root().style.display).not.toBe('none')
    expect(confirm?.closest('.omk-app__alone')).not.toBeNull()
  })
})

describe('radial over a confirmation alone', () => {
  it('draws the radial menu alone, never stacked on the confirmation', async () => {
    page = mountScripted()
    page.host.emit({ ...BOOT, panels: [], commandSeq: 0 })
    page.host.emit({ type: ToPage.ShowConfirm, commandSeq: COMMAND_SEQ, confirm: OWNED_REMOVE_CONFIRM })
    page.host.emit({ type: ToPage.OpenRadial })
    await settle()
    expect(page.container.querySelector('.omk-app__alone')).toBeNull()
    expect(page.container.querySelector('[data-surface="confirm"]')).toBeNull()
    expect(page.container.querySelectorAll('.omk-radial')).toHaveLength(1)
  })
})

describe('theme and viewport', () => {
  it('sets the root font size from the viewport and recomputes it on resize', async () => {
    page = mountScripted()
    expect(document.documentElement.style.fontSize).toBe('16px')
    page.viewport.resize(SMALL)
    await settle()
    expect(document.documentElement.style.fontSize).toBe('12.8px')
    page.viewport.resize(FULL_HD)
    await settle()
    expect(document.documentElement.style.fontSize).toBe('16px')
  })

  it('applies the accent and the font of the boot settings', async () => {
    page = mountScripted()
    page.host.emit({ ...BOOT, settings: { ...BOOT.settings, accent: '#3DDC97', font: 'archivoNarrow' } })
    await settle()
    expect(document.documentElement.style.getPropertyValue('--font-ui')).toContain('Archivo Narrow')
    expect(document.head.querySelectorAll('style[data-omk-fonts]')).toHaveLength(1)
    expect(document.head.querySelector('style[data-omk-fonts]')?.textContent).toContain('Archivo Narrow')
  })
})

describe('dispose', () => {
  it('detaches every listener it attached and stops listening to the host', async () => {
    page = mountScripted()
    page.host.emit(BOOT)
    await settle()
    page.unmount()
    expect(ledger.active()).toBe(0)
    expect(page.host.listening()).toBe(0)
    expect(page.container.querySelector(ROOT_SELECTOR)).toBeNull()
    page = mountScripted()
  })

  it('cancels the timers of the store', async () => {
    page = mountScripted()
    page.host.emit(TO_PAGE_SAMPLES[ToPage.Boot])
    page.host.emit({ type: ToPage.Intent, seq: FIRST_SEQ, intent: Intent.Down, phase: IntentPhase.Press, source: InputSource.Pad })
    await settle()
    const pending = vi.getTimerCount()
    expect(pending).toBeGreaterThan(0)
    page.unmount()
    expect(vi.getTimerCount()).toBeLessThan(pending)
    page = mountScripted()
  })

  it('sends nothing to the host once disposed, even for frames already requested', async () => {
    page = mountScripted()
    page.host.emit(BOOT)
    await settle()
    page.host.emit({ type: ToPage.Intent, seq: FIRST_SEQ, intent: Intent.Down, phase: IntentPhase.Press, source: InputSource.Pad })
    page.unmount()
    page.frame()
    expect(page.host.sent.filter((message) => message.type === FromPage.Ack)).toEqual([])
    page = mountScripted()
  })

  it('can be disposed twice and mounted only once', () => {
    page = mountScripted()
    page.app.mount(document.createElement('div'))
    expect(page.host.listening()).toBe(1)
    page.app.dispose()
    expect(() => page.app.dispose()).not.toThrow()
  })
})
