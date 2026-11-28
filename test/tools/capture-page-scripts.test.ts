// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freezePromptRing, PROMPT_RING_FRACTION, surveyPage } from '../../tools/capture/page-scripts.mjs'

const RADIAL_SELECTOR = '.omk-radial'
const SVG_UNIT_SIZE = 19
const SCREEN_SCALE = 0.8
const BOX = { width: 100, height: 20, left: 0, top: 0, right: 100, bottom: 20, x: 0, y: 0, toJSON: () => ({}) }

const NO_PSEUDO = undefined

function stubLayout(pseudoStyle: Partial<CSSStyleDeclaration> | null = null): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(BOX)
  const real = globalThis.getComputedStyle.bind(globalThis)
  vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((element, pseudo = NO_PSEUDO) => {
    if (pseudo !== NO_PSEUDO && pseudoStyle !== null) return pseudoStyle as CSSStyleDeclaration
    const style = real(element)
    const realized: Record<string, string> = { visibility: 'visible', opacity: '1' }
    return new Proxy(style, { get: (target, key) => (typeof key === 'string' && key in realized ? realized[key] : Reflect.get(target, key, target)) })
  })
}

function textOf(survey: ReturnType<typeof surveyPage>, label: string) {
  return survey.texts.find((entry) => entry.text === label)
}

describe('surveyPage', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    stubLayout()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads the computed font size of an HTML text as it is', () => {
    document.body.innerHTML = '<p style="font-size: 18px">Plain</p>'
    expect(textOf(surveyPage(RADIAL_SELECTOR), 'Plain')?.fontSize).toBe(18)
  })

  it('multiplies the font size of a text drawn in an SVG by the scale to the screen, so that 19 units are read as the pixels the player sees', () => {
    document.body.innerHTML = `<svg viewBox="0 0 10 10"><text style="font-size: ${SVG_UNIT_SIZE}px">Sector</text></svg>`
    const label = document.querySelector('text')
    if (label === null) throw new Error('text expected')
    Object.defineProperty(label, 'getScreenCTM', { value: () => ({ a: SCREEN_SCALE }) })
    expect(textOf(surveyPage(RADIAL_SELECTOR), 'Sector')?.fontSize).toBeCloseTo(SVG_UNIT_SIZE * SCREEN_SCALE)
  })

  it('keeps the font size of an SVG text whose matrix is unknown', () => {
    document.body.innerHTML = `<svg viewBox="0 0 10 10"><text style="font-size: ${SVG_UNIT_SIZE}px">Sector</text></svg>`
    const label = document.querySelector('text')
    if (label === null) throw new Error('text expected')
    Object.defineProperty(label, 'getScreenCTM', { value: () => null })
    expect(textOf(surveyPage(RADIAL_SELECTOR), 'Sector')?.fontSize).toBe(SVG_UNIT_SIZE)
  })

  it('reads whether the veil of the column is displayed', () => {
    document.body.innerHTML = '<section data-surface="column" data-dimmed><p>Column</p></section><div class="omk-radial"></div>'
    vi.restoreAllMocks()
    stubLayout({ backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'none' })
    expect(surveyPage(RADIAL_SELECTOR).column).toMatchObject({ dimmed: true, veilColor: 'rgba(0, 0, 0, 0.75)', veilDisplay: 'none' })
  })
})

interface FakeAnimation { effect: { target: { closest: (selector: string) => unknown }; getComputedTiming: () => { endTime: number } }; currentTime: number | null; paused: boolean; pause: () => void }

function fakeAnimation(inRing: boolean, endTime: number): FakeAnimation {
  const animation: FakeAnimation = {
    effect: { target: { closest: (selector: string) => (inRing && selector === '.omk-prompt__ring' ? {} : null) }, getComputedTiming: () => ({ endTime }) },
    currentTime: 0,
    paused: false,
    pause: () => void (animation.paused = true),
  }
  return animation
}

describe('freezePromptRing', () => {
  const HOLD_MS = 1_500
  const right = fakeAnimation(true, HOLD_MS / 2)
  const left = fakeAnimation(true, HOLD_MS)
  const elsewhere = fakeAnimation(false, 200)
  const root = { getAnimations: () => [right, left, elsewhere] } as unknown as Document

  it('holds both arcs of the ring at 62 % of the hold, measured on the longest of them', () => {
    expect(PROMPT_RING_FRACTION).toBe(0.62)
    expect(freezePromptRing(PROMPT_RING_FRACTION, root)).toBe(2)
    expect([right.paused, left.paused]).toEqual([true, true])
    expect(right.currentTime).toBeCloseTo(HOLD_MS * 0.62)
    expect(left.currentTime).toBeCloseTo(HOLD_MS * 0.62)
  })

  it('leaves every other animation alone', () => {
    expect(elsewhere.paused).toBe(false)
    expect(elsewhere.currentTime).toBe(0)
  })

  it('does nothing on a page without a ring', () => {
    expect(freezePromptRing(PROMPT_RING_FRACTION, { getAnimations: () => [elsewhere] } as unknown as Document)).toBe(0)
  })
})

describe('capture.mjs', () => {
  const source = readFileSync('tools/capture.mjs', 'utf8')

  it('freezes the ring of the prompt after the animations settled and before the survey', () => {
    const settled = source.indexOf('page.evaluate(settleAnimations)')
    const frozen = source.indexOf('page.evaluate(freezePromptRing, PROMPT_RING_FRACTION)')
    const surveyed = source.indexOf('page.evaluate(surveyPage')
    expect(settled).toBeGreaterThan(-1)
    expect(frozen).toBeGreaterThan(settled)
    expect(surveyed).toBeGreaterThan(frozen)
  })
})
