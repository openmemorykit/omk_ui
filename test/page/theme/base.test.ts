import { describe, expect, it } from 'vitest'
import { declarationValues, readTokens, withoutKeyframes } from './css-reading'
import { readSource } from './read-source'

const baseCss = readSource('src/page/theme/base.css')
const tokensCss = readSource('src/page/theme/tokens.css')

const tokens = readTokens(tokensCss)
const themeFiles = [['tokens.css', tokensCss], ['base.css', baseCss]] as const
const TEXT_TOKEN = /^var\(--text-[a-z0-9-]+\)$/
const WEIGHT_TOKEN = /^var\(--font-weight-[a-z]+\)$/
const SHORT_MOTION = /var\(--(fast|exit)\)/
const ESSENTIAL_MOTION = /var\(--spin-duration\)/
const BADGE_TONES = ['info', 'success', 'warning', 'error', 'neutral']
const PIXEL_LENGTH = /\d+px/
const MOTION_OFF = /^none( !important)?$/

function referencedTokens(css: string): readonly string[] {
  return Array.from(css.matchAll(/var\(--([a-z0-9-]+)\)/g), (match) => match[1] ?? '')
}

describe('visual rule in the theme files', () => {
  it.each(themeFiles)('%s has no backdrop-filter, blur or gradient', (_name, css) => {
    expect(css).not.toContain('backdrop-filter')
    expect(css).not.toContain('blur(')
    expect(css).not.toContain('gradient(')
  })

  it.each(themeFiles)('%s draws no inner shadow', (_name, css) => {
    for (const shadow of declarationValues(css, 'box-shadow')) expect(shadow).not.toContain('inset')
  })

  it('never lowers opacity outside entry and exit keyframes', () => {
    expect(declarationValues(withoutKeyframes(baseCss), 'opacity')).toEqual([])
  })

  it('paints every surface with the panel alpha', () => {
    expect(baseCss).toMatch(/\[data-surface\]\s*\{[^}]*background-color:\s*rgb\(var\(--panel-rgb\) \/ var\(--panel-alpha\)\)/)
  })

  it('lays the veil over the content of a dimmed surface', () => {
    expect(baseCss).toMatch(/\[data-dimmed\][^{]*::after\s*\{[^}]*background-color:\s*var\(--dim-veil\)/)
  })

  it('cuts animations under reduced motion except essential ones', () => {
    expect(baseCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(baseCss).toContain('[data-motion="essential"]')
  })
})

describe('type and motion in base.css', () => {
  it('sizes text only through the text tokens', () => {
    const sizes = declarationValues(baseCss, 'font-size')
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) expect(size).toMatch(TEXT_TOKEN)
    expect(declarationValues(baseCss, 'font')).toEqual([])
  })

  it('sets weights only through the weight tokens', () => {
    for (const weight of declarationValues(baseCss, 'font-weight')) expect(weight).toMatch(WEIGHT_TOKEN)
  })

  it('keeps every length in rem', () => {
    expect(baseCss).not.toMatch(PIXEL_LENGTH)
  })

  it('times every transition and animation with the short tokens, the spinner aside', () => {
    const motions = [...declarationValues(baseCss, 'transition'), ...declarationValues(baseCss, 'animation')]
    expect(motions.length).toBeGreaterThan(0)
    for (const motion of motions) expect(SHORT_MOTION.test(motion) || ESSENTIAL_MOTION.test(motion) || MOTION_OFF.test(motion), motion).toBe(true)
  })

  it('only references tokens of tokens.css or properties it sets itself', () => {
    const local = readTokens(baseCss)
    for (const name of referencedTokens(baseCss)) expect(tokens.has(name) || local.has(name), name).toBe(true)
  })
})

describe('shared classes', () => {
  it.each(BADGE_TONES)('styles the %s badge tone', (tone) => {
    expect(baseCss).toContain(`.omk-badge[data-tone="${tone}"]`)
  })

  it.each(['.omk-row', '.omk-row.is-focused', '.omk-row.is-disabled.is-focused', '.omk-row--danger.is-focused', '.omk-keycap', '.omk-key.is-focused'])('defines %s', (selector) => {
    expect(baseCss).toContain(selector)
  })
})
