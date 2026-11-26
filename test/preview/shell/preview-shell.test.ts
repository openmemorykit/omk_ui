import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreviewScene } from '../../../preview/runtime/preview-settings'
import { ScenarioId } from '../../../preview/runtime/types'
import PreviewShell from '../../../preview/shell/PreviewShell.vue'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { fromPageEntry, stubRuntime, type StubRuntime } from './shell-helpers'

const LOG_LIMIT = 200
const OVERFLOW = 250
const HD_WIDTH = 1280
const CONTROLS = 8
const RESTARTED = 2
const SLOT_TEXT = 'page content'

let runtime: StubRuntime
let frames: Array<() => void>

function mountShell(search: string = ''): VueWrapper {
  return mount(PreviewShell, { props: { runtime, search }, slots: { default: `<p id="page">${SLOT_TEXT}</p>` }, attachTo: document.body })
}

function flushFrames(): void {
  for (let guard = 0; guard < OVERFLOW && frames.length > 0; guard += 1) frames.shift()?.()
}

function startedWith(): { id: string; scene: string; glyphSet: string; width: number } {
  const [id, settings] = runtime.start.mock.calls.at(-1) ?? []
  return { id: String(id), scene: String(settings?.scene), glyphSet: String(settings?.glyphSet), width: settings?.resolution.width ?? 0 }
}

beforeEach(() => {
  runtime = stubRuntime()
  frames = []
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback))
  delete document.documentElement.dataset.captureReady
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('PreviewShell', () => {
  it('marks its root and renders the page slot inside the scene element', () => {
    const wrapper = mountShell()
    expect(wrapper.attributes('data-omk-preview')).toBeDefined()
    const stage = wrapper.find('[data-surface="preview-scene"]')
    expect(stage.find('#page').text()).toBe(SLOT_TEXT)
    wrapper.unmount()
  })

  it('exposes the scene element for a viewport', () => {
    const wrapper = mountShell()
    const exposed = wrapper.vm as unknown as { scene: HTMLElement | null }
    expect(exposed.scene).toBe(wrapper.find('[data-surface="preview-scene"]').element)
    wrapper.unmount()
  })

  it('works with an empty slot', () => {
    const wrapper = mount(PreviewShell, { props: { runtime, search: '' } })
    expect(wrapper.find('[data-surface="preview-bar"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('starts the scenario read from the URL with its settings', () => {
    const wrapper = mountShell('?scenario=long-list&scene=day&glyphs=playStation&res=1280x720')
    expect(runtime.start).toHaveBeenCalledTimes(1)
    expect(startedWith()).toEqual({ id: ScenarioId.LongList, scene: PreviewScene.Day, glyphSet: GlyphSet.PlayStation, width: HD_WIDTH })
    wrapper.unmount()
  })

  it('sizes the scene to the chosen resolution', () => {
    const wrapper = mountShell('?res=1280x720')
    const style = wrapper.find('[data-surface="preview-scene"]').attributes('style') ?? ''
    expect(style).toContain('1280px')
    expect(style).toContain('720px')
    wrapper.unmount()
  })

  it('restarts the runtime with the new settings when the scene changes', async () => {
    const wrapper = mountShell('?scenario=radial&scene=night')
    await wrapper.find('select[name="scene"]').setValue(PreviewScene.Day)
    expect(runtime.start).toHaveBeenCalledTimes(RESTARTED)
    expect(startedWith()).toMatchObject({ id: ScenarioId.Radial, scene: PreviewScene.Day })
    wrapper.unmount()
  })

  it('restarts with the same settings when the scenario changes', async () => {
    const wrapper = mountShell('?scene=day')
    await wrapper.find('select[name="scenario"]').setValue(ScenarioId.FormErrors)
    expect(startedWith()).toMatchObject({ id: ScenarioId.FormErrors, scene: PreviewScene.Day })
    wrapper.unmount()
  })

  it('restarts when the glyph set or the resolution changes', async () => {
    const wrapper = mountShell()
    await wrapper.find('select[name="glyphs"]').setValue(GlyphSet.PlayStation)
    expect(startedWith().glyphSet).toBe(GlyphSet.PlayStation)
    await wrapper.find('select[name="resolution"]').setValue('1280x720')
    expect(startedWith().width).toBe(HD_WIDTH)
    wrapper.unmount()
  })

  it('does not apply an accent too dark to read', async () => {
    const wrapper = mountShell('?accent=%23FFD166')
    await wrapper.find('input[name="accent"]').setValue('#000000')
    const [, settings] = runtime.start.mock.calls.at(-1) ?? []
    expect(settings?.accent).not.toBe('#000000')
    wrapper.unmount()
  })

  it('writes the settings back into the address', async () => {
    const wrapper = mountShell()
    await wrapper.find('select[name="scene"]').setValue(PreviewScene.Day)
    expect(window.location.search).toContain('scene=day')
    wrapper.unmount()
  })

  it('puts the bar before the scene, outside it, reachable by keyboard', () => {
    const wrapper = mountShell()
    const bar = wrapper.find('[data-surface="preview-bar"]').element
    const stage = wrapper.find('[data-surface="preview-scene"]').element
    expect(stage.contains(bar)).toBe(false)
    expect(Boolean(bar.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    const controls = wrapper.findAll('[data-surface="preview-bar"] select, [data-surface="preview-bar"] input')
    expect(controls.length).toBeGreaterThanOrEqual(CONTROLS)
    for (const control of controls) {
      expect(control.attributes('tabindex')).toBeUndefined()
      expect(control.attributes('disabled')).toBeUndefined()
      expect(wrapper.find(`label[for="${control.attributes('id')}"]`).exists()).toBe(true)
    }
    wrapper.unmount()
  })

  it('draws a street scene in inline SVG without any external image', () => {
    const wrapper = mountShell()
    const html = wrapper.find('[data-surface="preview-scene"]').html()
    expect(html).toContain('<svg')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('url(')
    wrapper.unmount()
  })
})

describe('PreviewShell message log', () => {
  it('lists the messages of the runtime', async () => {
    const wrapper = mountShell()
    runtime.entries = [fromPageEntry(1), fromPageEntry(RESTARTED)]
    runtime.emitLog()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-surface="preview-log"] li')).toHaveLength(RESTARTED)
    wrapper.unmount()
  })

  it('keeps at most 200 entries, the most recent ones', async () => {
    const wrapper = mountShell()
    runtime.entries = Array.from({ length: OVERFLOW }, (_, index) => fromPageEntry(index))
    runtime.emitLog()
    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('[data-surface="preview-log"] li')
    expect(rows).toHaveLength(LOG_LIMIT)
    expect(rows[0]?.text()).toContain(String(OVERFLOW - 1))
    expect(rows[LOG_LIMIT - 1]?.text()).toContain(String(OVERFLOW - LOG_LIMIT))
    wrapper.unmount()
  })

  it('stops listening to the runtime when unmounted', () => {
    const removed = vi.fn()
    runtime.onLog = () => removed
    mountShell().unmount()
    expect(removed).toHaveBeenCalledTimes(1)
  })
})

describe('PreviewShell capture mode', () => {
  it('hides the bar and the log and fills the window with the scene', () => {
    const wrapper = mountShell('?capture=1&res=1280x720')
    expect(wrapper.find('[data-surface="preview-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-surface="preview-log"]').exists()).toBe(false)
    expect(wrapper.find('[data-surface="preview-scene"]').attributes('style') ?? '').not.toContain('1280px')
    expect(wrapper.attributes('data-capture')).toBeDefined()
    wrapper.unmount()
  })

  it('does not set captureReady while the scenario runs', () => {
    const wrapper = mountShell('?capture=1')
    flushFrames()
    expect(document.documentElement.dataset.captureReady).toBeUndefined()
    wrapper.unmount()
  })

  it('sets captureReady once the runtime is settled and the frames are painted', () => {
    const wrapper = mountShell('?capture=1')
    flushFrames()
    runtime.done = true
    flushFrames()
    expect(document.documentElement.dataset.captureReady).toBe('true')
    wrapper.unmount()
  })

  it('waits for two frames after the runtime settles', () => {
    runtime.done = true
    const wrapper = mountShell('?capture=1')
    expect(document.documentElement.dataset.captureReady).toBeUndefined()
    frames.shift()?.()
    expect(document.documentElement.dataset.captureReady).toBeUndefined()
    flushFrames()
    expect(document.documentElement.dataset.captureReady).toBe('true')
    wrapper.unmount()
  })

  it('never sets captureReady outside capture mode', () => {
    runtime.done = true
    const wrapper = mountShell()
    flushFrames()
    expect(document.documentElement.dataset.captureReady).toBeUndefined()
    wrapper.unmount()
  })

  it('clears captureReady when unmounted', () => {
    runtime.done = true
    const wrapper = mountShell('?capture=1')
    flushFrames()
    wrapper.unmount()
    expect(document.documentElement.dataset.captureReady).toBeUndefined()
  })
})
