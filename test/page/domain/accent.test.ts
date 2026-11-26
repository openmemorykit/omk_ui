import { describe, expect, it } from 'vitest'
import { ACCENT_TEXT_MIN_CONTRAST, deriveAccent } from '../../../src/page/domain/accent'
import { contrastRatio } from '../../../src/shared/config/contrast'
import { PANEL_BACKGROUND, THEME_DEFAULTS } from '../../../src/shared/config/theme-defaults'

const HEX_PATTERN = /^#[0-9A-F]{6}$/
const DARK_ACCENT = '#6A55E0'
const LIGHT_ACCENT = '#F0F0A0'
const DEFAULT_ACCENT = '#8F7BFF'
const BLACK = '#000000'
const WHITE = '#FFFFFF'
const STEP = 0.05
const HALF_STEPS = 10
const CHANNEL_MAX = 255
const RADIX = 16
const DIGITS = 2
const OFFSETS = [1, 1 + DIGITS, 1 + DIGITS + DIGITS]

function blend(from: string, share: number): string {
  const pairs = OFFSETS.map((offset) => {
    const channel = parseInt(from.slice(offset, offset + DIGITS), RADIX)
    return Math.round(channel + (CHANNEL_MAX - channel) * share).toString(RADIX).toUpperCase().padStart(DIGITS, '0')
  })
  return `#${pairs.join('')}`
}

describe('deriveAccent', () => {
  it('keeps the default accent readable as text and ink', () => {
    const tokens = deriveAccent(DEFAULT_ACCENT, PANEL_BACKGROUND)
    expect(contrastRatio(tokens.accentText, PANEL_BACKGROUND)).toBeGreaterThanOrEqual(ACCENT_TEXT_MIN_CONTRAST)
    expect(contrastRatio(tokens.accentInk, DEFAULT_ACCENT)).toBeGreaterThanOrEqual(ACCENT_TEXT_MIN_CONTRAST)
  })

  it('picks black ink on a light accent', () => {
    expect(deriveAccent(LIGHT_ACCENT, PANEL_BACKGROUND).accentInk).toBe(BLACK)
  })

  it('picks white ink on a dark accent', () => {
    expect(deriveAccent(DARK_ACCENT, PANEL_BACKGROUND).accentInk).toBe(WHITE)
  })

  it('lightens a dark accent until text contrast is reached', () => {
    expect(contrastRatio(DARK_ACCENT, PANEL_BACKGROUND)).toBeLessThan(ACCENT_TEXT_MIN_CONTRAST)
    const tokens = deriveAccent(DARK_ACCENT, PANEL_BACKGROUND)
    expect(tokens.accentText).not.toBe(DARK_ACCENT)
    expect(contrastRatio(tokens.accentText, PANEL_BACKGROUND)).toBeGreaterThanOrEqual(ACCENT_TEXT_MIN_CONTRAST)
  })

  it('does not lighten an accent that already reads', () => {
    expect(deriveAccent(LIGHT_ACCENT, PANEL_BACKGROUND).accentText).toBe(LIGHT_ACCENT)
  })

  it('lightens in steps of 5 percent toward white', () => {
    const tokens = deriveAccent(DARK_ACCENT, PANEL_BACKGROUND)
    const shares = Array.from({ length: HALF_STEPS }, (_unused, index) => (index + 1) * STEP)
    const matches = shares.filter((share) => blend(DARK_ACCENT, share) === tokens.accentText)
    expect(matches).toHaveLength(1)
    const lower = blend(DARK_ACCENT, (matches[0] ?? 0) - STEP)
    expect(contrastRatio(lower, PANEL_BACKGROUND)).toBeLessThan(ACCENT_TEXT_MIN_CONTRAST)
  })

  it('mixes the dim color with a quarter of accent and three quarters of background', () => {
    expect(deriveAccent('#FF0000', '#000000').accentDim).toBe('#400000')
    expect(deriveAccent('#000000', '#FFFFFF').accentDim).toBe('#BFBFBF')
  })

  it('keeps secondary ink readable on the dim color of the default accent', () => {
    expect(contrastRatio('#C6C1D6', deriveAccent(DEFAULT_ACCENT, PANEL_BACKGROUND).accentDim)).toBeGreaterThanOrEqual(ACCENT_TEXT_MIN_CONTRAST)
  })

  it('reuses accent and ink for focus', () => {
    const tokens = deriveAccent(DEFAULT_ACCENT, PANEL_BACKGROUND)
    expect(tokens.focusBackground).toBe(DEFAULT_ACCENT)
    expect(tokens.focusInk).toBe(tokens.accentInk)
  })

  it.each([DEFAULT_ACCENT, DARK_ACCENT, LIGHT_ACCENT, '#00FF00', '#123456'])('renders only #RRGGBB tokens for %s', (accent) => {
    const tokens = deriveAccent(accent, PANEL_BACKGROUND)
    for (const value of Object.values(tokens)) expect(value).toMatch(HEX_PATTERN)
  })

  it('normalizes lowercase input', () => {
    expect(deriveAccent('#8f7bff', PANEL_BACKGROUND).focusBackground).toBe(DEFAULT_ACCENT)
  })

  it.each(['', 'red', '#12345', '#GGGGGG', 'rgb(0,0,0)'])('falls back to the default accent for %j', (invalid) => {
    expect(deriveAccent(invalid, PANEL_BACKGROUND)).toEqual(deriveAccent(THEME_DEFAULTS.accent, PANEL_BACKGROUND))
  })

  it('falls back to the default panel background when it is invalid', () => {
    expect(deriveAccent(DEFAULT_ACCENT, 'nope')).toEqual(deriveAccent(DEFAULT_ACCENT, PANEL_BACKGROUND))
  })

  it('falls back on both when accent and background are invalid', () => {
    expect(deriveAccent('nope', 'nope')).toEqual(deriveAccent(THEME_DEFAULTS.accent, PANEL_BACKGROUND))
  })

  it('normalizes a lowercase panel background', () => {
    expect(deriveAccent(DEFAULT_ACCENT, PANEL_BACKGROUND.toLowerCase())).toEqual(deriveAccent(DEFAULT_ACCENT, PANEL_BACKGROUND))
  })

  it('stops lightening at white when the background is too light to reach text contrast', () => {
    expect(deriveAccent(LIGHT_ACCENT, WHITE).accentText).toBe(WHITE)
  })
})
