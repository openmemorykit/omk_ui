import { describe, expect, it } from 'vitest'
import { buildMatrix, captureUrl, SCENARIO_IDS } from '../../tools/capture/matrix.mjs'

const FULL_HD = '1920x1080'
const HD = '1280x720'
const QHD = '2560x1440'
const SCENARIO_COUNT = 14
const FULL_HD_VARIANTS = ['base', 'day', 'right', 'accent-light', 'scale-0.9', 'scale-1.1']
const WIDE_SCENARIOS = ['radial', 'radial-children', 'whitelist-list', 'long-list', 'keyboard-letters', 'keyboard-accents', 'keyboard-symbols']
const GLYPH_SCENARIOS = ['radial', 'whitelist-list', 'keyboard-letters']
const EXPECTED_TOTAL = SCENARIO_COUNT * FULL_HD_VARIANTS.length + GLYPH_SCENARIOS.length + WIDE_SCENARIOS.length * 2 + 1

const matrix = buildMatrix()
const names = matrix.map((spec) => spec.name)
const find = (name: string) => matrix.find((spec) => spec.name === name)

describe('capture matrix', () => {
  it('lists the fourteen scenario identifiers of the preview', () => {
    expect([...SCENARIO_IDS].sort()).toEqual([
      'confirm-danger', 'disabled-focused', 'form-errors', 'form-pending', 'keyboard-accents', 'keyboard-letters',
      'keyboard-symbols', 'long-list', 'prompt-hold', 'radial', 'radial-children', 'toasts', 'whitelist', 'whitelist-list',
    ])
  })

  it('has the expected number of captures with unique names', () => {
    expect(matrix).toHaveLength(EXPECTED_TOTAL)
    expect(new Set(names).size).toBe(names.length)
  })

  it('captures every scenario in 1080p for each scene, side, accent and scale variant', () => {
    for (const scenario of SCENARIO_IDS) {
      for (const variant of FULL_HD_VARIANTS) expect(names).toContain(`${scenario}-${FULL_HD}-${variant}`)
    }
  })

  it('adds 720p and 1440p only for the list, radial and keyboard scenarios', () => {
    for (const scenario of SCENARIO_IDS) {
      const wide = WIDE_SCENARIOS.includes(scenario)
      expect(names.includes(`${scenario}-${HD}-base`)).toBe(wide)
      expect(names.includes(`${scenario}-${QHD}-base`)).toBe(wide)
    }
  })

  it('captures the PlayStation glyph variant in 1080p for radial, whitelist-list and keyboard-letters only', () => {
    const glyphNames = matrix.filter((spec) => spec.variant === 'playStation').map((spec) => spec.name)
    expect(glyphNames.sort()).toEqual(GLYPH_SCENARIOS.map((scenario) => `${scenario}-${FULL_HD}-playStation`).sort())
    expect(find(`radial-${FULL_HD}-playStation`)?.glyphs).toBe('playStation')
    expect(find(`radial-${FULL_HD}-base`)?.glyphs).toBe('xbox')
  })

  it('writes one png per capture under the scenario, resolution and variant name', () => {
    for (const spec of matrix) expect(spec.file).toBe(`${spec.scenario}-${spec.width}x${spec.height}-${spec.variant}.png`)
  })

  it('moves one setting at a time away from the base capture', () => {
    expect(find(`radial-${FULL_HD}-base`)).toMatchObject({ scene: 'night', side: 'left', accent: null, scale: null, reducedMotion: false })
    expect(find(`radial-${FULL_HD}-day`)?.scene).toBe('day')
    expect(find(`radial-${FULL_HD}-right`)?.side).toBe('right')
    expect(find(`radial-${FULL_HD}-accent-light`)?.accent).toMatch(/^#[0-9A-F]{6}$/)
    expect(find(`radial-${FULL_HD}-scale-0.9`)?.scale).toBe(0.9)
    expect(find(`radial-${FULL_HD}-scale-1.1`)?.scale).toBe(1.1)
  })

  it('sizes the viewport from the resolution of the name', () => {
    expect(find(`radial-${HD}-base`)).toMatchObject({ width: 1280, height: 720 })
    expect(find(`radial-${QHD}-base`)).toMatchObject({ width: 2560, height: 1440 })
  })

  it('captures prompt-hold once more under reduced motion', () => {
    const reduced = matrix.filter((spec) => spec.reducedMotion)
    expect(reduced.map((spec) => spec.name)).toEqual([`prompt-hold-${FULL_HD}-reduced-motion`])
  })
})

describe('captureUrl', () => {
  it('builds the preview contract url with capture=1 and the language fixed', () => {
    const spec = find(`radial-${FULL_HD}-playStation`)
    const params = new URL(captureUrl(spec!), 'http://x').searchParams
    expect(params.get('scenario')).toBe('radial')
    expect(params.get('res')).toBe(FULL_HD)
    expect(params.get('scene')).toBe('night')
    expect(params.get('glyphs')).toBe('playStation')
    expect(params.get('side')).toBe('left')
    expect(params.get('capture')).toBe('1')
    expect(params.get('lang')).toBe('fr')
    expect(params.has('accent')).toBe(false)
    expect(params.has('scale')).toBe(false)
  })

  it('writes accent and scale only when the capture changes them', () => {
    const accent = new URL(captureUrl(find(`radial-${FULL_HD}-accent-light`)!), 'http://x').searchParams.get('accent')
    expect(accent).toMatch(/^#[0-9A-F]{6}$/)
    expect(captureUrl(find(`radial-${FULL_HD}-accent-light`)!)).toContain('%23')
    expect(new URL(captureUrl(find(`radial-${FULL_HD}-scale-1.1`)!), 'http://x').searchParams.get('scale')).toBe('1.1')
  })
})
