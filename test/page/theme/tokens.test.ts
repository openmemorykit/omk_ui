import { describe, expect, it } from 'vitest'
import { deriveAccent } from '../../../src/page/domain/accent'
import { RADIAL_HOLE_RADIUS, RADIAL_RING_OUTER, RADIAL_SUBRING_INNER } from '../../../src/page/domain/radial-geometry'
import { COLUMN_WIDTH, RADIAL_DIAMETER } from '../../../src/page/domain/scale'
import { MIN_FOCUS_CONTRAST } from '../../../src/shared/config/config-schema'
import { contrastRatio, parseHexChannels, relativeLuminance } from '../../../src/shared/config/contrast'
import { PANEL_BACKGROUND, THEME_DEFAULTS } from '../../../src/shared/config/theme-defaults'
import { colorOf, millisecondsOf, readTokens, remOf, tokenOf, tripletChannels } from './css-reading'
import { readSource } from './read-source'

const tokens = readTokens(readSource('src/page/theme/tokens.css'))
const PRIMARY_TEXT = 12
const SECONDARY_TEXT = 6
const ACCENT_TEXT = 4.5
const TEXT_ON_FILL = 4.5
const NON_TEXT = 3
const MIN_TEXT_REM = 1.125
const ROOT_PIXELS = 16
const HALF = 2
const MAX_MOTION_MS = 120
const WCAG20_THRESHOLD = 0.03928
const SRGB_THRESHOLD = 0.04045
const CHANNEL_MAX = 255
const LUMINANCE_DIGITS = 10
const LINEAR_DIVISOR = 12.92
const GAMMA_OFFSET = 0.055
const GAMMA_DIVISOR = 1.055
const GAMMA_EXPONENT = 2.4
const HEX_RADIX = 16
const CHANNEL_DIGITS = 2
const GRAY_CHANNELS = 3
const SURFACES = ['panel', 'panel-deep', 'panel-raised']
const SECONDARY_INKS = ['ink-2', 'ink-3']
const TONES = ['info', 'success', 'warning', 'error']
const FORBIDDEN_NAME = /blur|sheen|gloss|glass|reflect|gradient|grain|glow/
const FORBIDDEN_VALUE = /gradient\(|blur\(|inset/
const ALLOWED_WEIGHTS: readonly string[] = ['500', '600', '700', '800']

function ratio(foreground: string, background: string): number {
  return contrastRatio(colorOf(tokens, foreground), colorOf(tokens, background))
}

function wcag20Luminance(channel: number): number {
  const value = channel / CHANNEL_MAX
  return value <= WCAG20_THRESHOLD ? value / LINEAR_DIVISOR : ((value + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT
}

describe('panel surface tokens', () => {
  it('keeps every surface opaque', () => {
    expect(tokenOf(tokens, 'panel-alpha')).toBe('1')
  })

  it('aligns --panel-rgb with PANEL_BACKGROUND', () => {
    expect(tripletChannels(tokenOf(tokens, 'panel-rgb'))).toEqual(parseHexChannels(PANEL_BACKGROUND))
  })

  it('dims with the panel color at 0.75 instead of opacity', () => {
    expect(tokenOf(tokens, 'dim-veil')).toBe('rgb(var(--panel-rgb) / 0.75)')
  })

  it.each(SURFACES)('draws --%s with the panel alpha', (surface) => {
    expect(tokenOf(tokens, surface)).toMatch(/var\(--panel-alpha\)\)$/)
  })

  it('has no blur, sheen or gradient token', () => {
    for (const [name, value] of tokens) {
      expect(name).not.toMatch(FORBIDDEN_NAME)
      expect(value).not.toMatch(FORBIDDEN_VALUE)
    }
  })

  it('keeps the panel dark enough for lightened accents to reach text contrast', () => {
    expect(contrastRatio('#FFFFFF', PANEL_BACKGROUND)).toBeGreaterThanOrEqual(PRIMARY_TEXT)
    expect(relativeLuminance(PANEL_BACKGROUND)).toBeLessThan(relativeLuminance(colorOf(tokens, 'ink-3')))
  })
})

describe('text contrast on every surface', () => {
  it.each(SURFACES)('reads primary ink at 12:1 or more on --%s', (surface) => {
    expect(ratio('ink', surface)).toBeGreaterThanOrEqual(PRIMARY_TEXT)
  })

  it.each(SURFACES.flatMap((surface) => SECONDARY_INKS.map((ink) => [ink, surface])))('reads --%s at 6:1 or more on --%s', (ink, surface) => {
    expect(ratio(ink, surface)).toBeGreaterThanOrEqual(SECONDARY_TEXT)
  })

  it.each(SURFACES)('reads accent text at 4.5:1 or more on --%s', (surface) => {
    expect(ratio('accent-text', surface)).toBeGreaterThanOrEqual(ACCENT_TEXT)
  })

  it.each([
    ['focus-ink', 'focus-bg'],
    ['ink-2', 'accent-dim'],
    ['error', 'panel'],
    ['error', 'error-wash'],
    ['error-ink', 'error'],
    ['warning', 'panel'],
    ['success', 'panel'],
    ['accent-text', 'key'],
    ['ink', 'accent-dim'],
    ...TONES.map((tone) => ['tone-ink', tone]),
  ])('reads --%s on --%s at 4.5:1 or more', (foreground, background) => {
    expect(ratio(foreground ?? '', background ?? '')).toBeGreaterThanOrEqual(TEXT_ON_FILL)
  })

  it.each(['chip', 'keycap', 'key'])('reads primary ink at 12:1 or more on --%s', (fill) => {
    expect(ratio('ink', fill)).toBeGreaterThanOrEqual(PRIMARY_TEXT)
  })

  it.each([
    ['ink-faint', 'panel'],
    ['ink-faint', 'keycap'],
    ['ink-2', 'control-off'],
    ['accent', 'panel'],
  ])('shows --%s on --%s at 3:1 or more', (foreground, background) => {
    expect(ratio(foreground ?? '', background ?? '')).toBeGreaterThanOrEqual(NON_TEXT)
  })

  it.each([...TONES, 'ink-2'])('shows the --%s badge dot at 3:1 or more on the chip', (tone) => {
    expect(ratio(tone, 'chip')).toBeGreaterThanOrEqual(NON_TEXT)
  })

  it('keeps the default accent at the focus contrast', () => {
    expect(contrastRatio(THEME_DEFAULTS.accent, PANEL_BACKGROUND)).toBeGreaterThanOrEqual(MIN_FOCUS_CONTRAST)
  })
})

describe('luminance threshold', () => {
  it('keeps sRGB 0.04045 over WCAG 2.0 0.03928, since no 8-bit channel lies between them', () => {
    const levels = Array.from({ length: CHANNEL_MAX + 1 }, (_unused, channel) => channel / CHANNEL_MAX)
    expect(levels.filter((level) => level > WCAG20_THRESHOLD && level <= SRGB_THRESHOLD)).toEqual([])
  })

  it('gives the WCAG 2.0 luminance on every gray level', () => {
    for (let channel = 0; channel <= CHANNEL_MAX; channel += 1) {
      const gray = `#${channel.toString(HEX_RADIX).padStart(CHANNEL_DIGITS, '0').repeat(GRAY_CHANNELS)}`
      expect(relativeLuminance(gray)).toBeCloseTo(wcag20Luminance(channel), LUMINANCE_DIGITS)
    }
  })
})

describe('accent tokens', () => {
  it('starts from the default accent', () => {
    expect(colorOf(tokens, 'accent')).toBe(THEME_DEFAULTS.accent)
  })

  it('ships the derived tokens that deriveAccent gives for the default accent', () => {
    const derived = deriveAccent(THEME_DEFAULTS.accent, PANEL_BACKGROUND)
    expect(colorOf(tokens, 'accent-ink')).toBe(derived.accentInk)
    expect(colorOf(tokens, 'accent-dim')).toBe(derived.accentDim)
    expect(colorOf(tokens, 'accent-text')).toBe(derived.accentText)
    expect(colorOf(tokens, 'focus-bg')).toBe(derived.focusBackground)
    expect(colorOf(tokens, 'focus-ink')).toBe(derived.focusInk)
  })
})

describe('sizes', () => {
  it.each([
    ['row-height', '2.75rem'],
    ['text-row', '1.3125rem'],
    ['text-secondary', '1.125rem'],
    ['text-min', '1.125rem'],
    ['column-width', '30rem'],
    ['column-edge', '4.5rem'],
    ['radial-hole', '8.25rem'],
    ['radial-ring-inner', '8.75rem'],
    ['radial-ring-outer', '19.875rem'],
    ['radial-subring-inner', '20.625rem'],
    ['radial-subring-outer', '26.5rem'],
  ])('sets --%s to %s', (name, value) => {
    expect(tokenOf(tokens, name ?? '')).toBe(value)
  })

  it('keeps every text size at 1.125rem or more', () => {
    const textSizes = Array.from(tokens).filter(([name]) => name.startsWith('text-'))
    expect(textSizes.length).toBeGreaterThan(0)
    for (const [, value] of textSizes) expect(remOf(value)).toBeGreaterThanOrEqual(MIN_TEXT_REM)
  })

  it('matches the column and radial geometry of the domain', () => {
    const pixels = (name: string): number => (remOf(tokenOf(tokens, name)) ?? 0) * ROOT_PIXELS
    expect(pixels('column-width')).toBe(COLUMN_WIDTH)
    expect(pixels('radial-hole')).toBe(RADIAL_HOLE_RADIUS)
    expect(pixels('radial-ring-outer')).toBe(RADIAL_RING_OUTER)
    expect(pixels('radial-subring-inner')).toBe(RADIAL_SUBRING_INNER)
    expect(pixels('radial-subring-outer') * HALF).toBe(RADIAL_DIAMETER)
  })
})

describe('type and motion', () => {
  it('keeps the font weights to the four shipped files', () => {
    const weights = Array.from(tokens).filter(([name]) => name.startsWith('font-weight-'))
    expect(weights.length).toBeGreaterThan(0)
    for (const [, value] of weights) expect(ALLOWED_WEIGHTS).toContain(value)
  })

  it.each(['fast', 'exit'])('keeps --%s at 120 ms or less', (name) => {
    expect(millisecondsOf(tokenOf(tokens, name))).toBeLessThanOrEqual(MAX_MOTION_MS)
  })

  it('sets --fast to 90 ms', () => {
    expect(tokenOf(tokens, 'fast')).toBe('90ms')
  })
})
