import { describe, expect, it } from 'vitest'
import * as schema from '../../../src/shared/config/config-schema'
import { contrastRatio, parseHexChannels } from '../../../src/shared/config/contrast'
import { FontFamily, PANEL_BACKGROUND, PanelSide, THEME_DEFAULTS } from '../../../src/shared/config/theme-defaults'
import { readSource } from '../../page/theme/read-source'

const IMPORT_STATEMENT = /^\s*import\s/m
const themeDefaultsSource = readSource('src/shared/config/theme-defaults.ts')

describe('theme defaults', () => {
  it('uses O as the default monogram', () => {
    expect(THEME_DEFAULTS.monogram).toBe('O')
  })

  it('imports nothing, so the page reads it without valibot', () => {
    expect(themeDefaultsSource).not.toMatch(IMPORT_STATEMENT)
    expect(themeDefaultsSource).not.toContain('valibot')
  })

  it('is re-exported by the config schema without being redefined', () => {
    expect(schema.THEME_DEFAULTS).toBe(THEME_DEFAULTS)
    expect(schema.PANEL_BACKGROUND).toBe(PANEL_BACKGROUND)
    expect(schema.PanelSide).toBe(PanelSide)
    expect(schema.FontFamily).toBe(FontFamily)
  })

  it('gives a #RRGGBB panel background', () => {
    expect(parseHexChannels(PANEL_BACKGROUND)).not.toBeNull()
  })

  it('keeps the default accent at the focus contrast on the panel', () => {
    expect(contrastRatio(THEME_DEFAULTS.accent, PANEL_BACKGROUND)).toBeGreaterThanOrEqual(schema.MIN_FOCUS_CONTRAST)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(THEME_DEFAULTS)).toBe(true)
  })
})
