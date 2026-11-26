import { describe, expect, it } from 'vitest'
import { themeView } from '../../../../src/page/application/views/theme-view'
import { deriveAccent } from '../../../../src/page/domain/accent'
import { FontFamily, PANEL_BACKGROUND, PanelSide, THEME_DEFAULTS } from '../../../../src/shared/config/theme-defaults'
import type { ThemeConfig } from '../../../../src/shared/config/config-schema'

const BASE_PX = 16
const FLOOR = 0.8
const PRECISION = 2
const EXACT = 5
const settings = (overrides: Partial<ThemeConfig> = {}): ThemeConfig => ({ ...THEME_DEFAULTS, ...overrides })

const TABLE = [
  { width: 1280, height: 720, scale: 0.9, root: 12.8 },
  { width: 1280, height: 720, scale: 1, root: 12.8 },
  { width: 1920, height: 1080, scale: 0.9, root: 14.4 },
  { width: 1920, height: 1080, scale: 1, root: 16 },
  { width: 1920, height: 1080, scale: 1.1, root: 17.6 },
  { width: 1440, height: 1080, scale: 1.1, root: 17.6 },
  { width: 2560, height: 1440, scale: 1, root: 21.333 },
  { width: 3840, height: 2160, scale: 1.1, root: 35.2 },
]

describe('themeView root font size', () => {
  it.each(TABLE)('is $root px at $width x $height with theme.scale $scale', ({ width, height, scale, root }) => {
    expect(themeView(settings({ scale }), { width, height }).rootFontSizePx).toBeCloseTo(root, PRECISION)
  })

  it('never goes under 16 px times the floor', () => {
    expect(themeView(settings(), { width: 320, height: 200 }).rootFontSizePx).toBeCloseTo(BASE_PX * FLOOR, EXACT)
  })

  it('falls back on the floor with a broken viewport', () => {
    expect(themeView(settings(), { width: Number.NaN, height: 1080 }).rootFontSizePx).toBeCloseTo(BASE_PX * FLOOR, EXACT)
  })
})

describe('themeView accent', () => {
  it('derives the accent variables with deriveAccent', () => {
    const view = themeView(settings(), { width: 1920, height: 1080 })
    const derived = deriveAccent(THEME_DEFAULTS.accent, PANEL_BACKGROUND)
    expect(view.cssVariables).toMatchObject({
      '--accent': derived.focusBackground,
      '--accent-ink': derived.accentInk,
      '--accent-dim': derived.accentDim,
      '--accent-text': derived.accentText,
      '--focus-bg': derived.focusBackground,
      '--focus-ink': derived.focusInk,
    })
  })

  it('uses a black ink on a light accent', () => {
    const view = themeView(settings({ accent: '#F2E94E' }), { width: 1920, height: 1080 })
    expect(view.cssVariables['--accent-ink']).toBe('#000000')
    expect(view.cssVariables['--focus-ink']).toBe('#000000')
  })

  it('uses a white ink on a dark accent', () => {
    expect(themeView(settings({ accent: '#1B2A8C' }), { width: 1920, height: 1080 }).cssVariables['--accent-ink']).toBe('#FFFFFF')
  })

  it('falls back on the default accent when the color is invalid', () => {
    const view = themeView(settings({ accent: 'nope' }), { width: 1920, height: 1080 })
    expect(view.cssVariables['--accent']).toBe(THEME_DEFAULTS.accent)
  })

  it('only holds derived and font variables', () => {
    const names = Object.keys(themeView(settings(), { width: 1920, height: 1080 }).cssVariables).sort()
    expect(names).toEqual(['--accent', '--accent-dim', '--accent-ink', '--accent-text', '--focus-bg', '--focus-ink', '--font-head', '--font-ui'])
  })
})

describe('themeView font, side and branding', () => {
  it('names the chosen family in both font variables', () => {
    const view = themeView(settings({ font: FontFamily.ArchivoNarrow }), { width: 1920, height: 1080 })
    expect(view.fontFamily).toBe(FontFamily.ArchivoNarrow)
    expect(view.cssVariables['--font-ui']).toMatch(/^'Archivo Narrow', /)
    expect(view.cssVariables['--font-head']).toBe(view.cssVariables['--font-ui'])
  })

  it('names Sofia Sans by default', () => {
    expect(themeView(settings(), { width: 1920, height: 1080 }).cssVariables['--font-ui']).toMatch(/^'Sofia Sans Semi Condensed', /)
  })

  it('passes side, monogram and logo through', () => {
    const view = themeView(settings({ side: PanelSide.Right, monogram: 'OK', logo: 'branding/logo.png' }), { width: 1920, height: 1080 })
    expect(view).toMatchObject({ side: PanelSide.Right, monogram: 'OK', logo: 'branding/logo.png' })
  })

  it('defaults to the O monogram without logo', () => {
    expect(themeView(settings(), { width: 1920, height: 1080 })).toMatchObject({ monogram: 'O', logo: null, side: PanelSide.Left })
  })
})
