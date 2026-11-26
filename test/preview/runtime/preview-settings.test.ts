import { describe, expect, it } from 'vitest'
import englishMessages from '../../../omk_ui/locales/en.json'
import frenchMessages from '../../../omk_ui/locales/fr.json'
import {
  DEFAULT_PREVIEW_SETTINGS,
  PREVIEW_BINDINGS,
  PreviewLanguage,
  PreviewScene,
  previewLocale,
  previewTheme,
} from '../../../preview/runtime/preview-settings'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { PanelSide, THEME_DEFAULTS } from '../../../src/shared/config/theme-defaults'

const FULL_HD = { width: 1920, height: 1080 }
const LARGER_SCALE = 1.1
const BRIGHT_ACCENT = '#FFD166'

describe('preview settings', () => {
  it('defaults to a night street in full HD, French, Xbox glyphs and the theme defaults', () => {
    expect(DEFAULT_PREVIEW_SETTINGS).toEqual({
      resolution: FULL_HD,
      scene: PreviewScene.Night,
      glyphSet: GlyphSet.Xbox,
      side: THEME_DEFAULTS.side,
      accent: THEME_DEFAULTS.accent,
      scale: THEME_DEFAULTS.scale,
      language: PreviewLanguage.French,
      capture: false,
    })
    expect(Object.isFrozen(DEFAULT_PREVIEW_SETTINGS)).toBe(true)
  })

  it('labels the bindings F1, E and N', () => {
    expect(PREVIEW_BINDINGS).toEqual({ radial: 'F1', interact: 'E', pushToTalk: 'N' })
  })

  it('builds the theme from the side, the accent and the scale over the theme defaults', () => {
    const theme = previewTheme({ ...DEFAULT_PREVIEW_SETTINGS, side: PanelSide.Right, accent: BRIGHT_ACCENT, scale: LARGER_SCALE })
    expect(theme).toEqual({ ...THEME_DEFAULTS, side: PanelSide.Right, accent: BRIGHT_ACCENT, scale: LARGER_SCALE })
  })

  it('reads the locale bundles from omk_ui/locales', () => {
    expect(previewLocale(PreviewLanguage.French)).toEqual({ language: 'fr', messages: frenchMessages })
    expect(previewLocale(PreviewLanguage.English)).toEqual({ language: 'en', messages: englishMessages })
  })

  it('falls back to French for a language outside the vocabulary', () => {
    expect(previewLocale('de' as PreviewLanguage)).toEqual({ language: 'fr', messages: frenchMessages })
  })
})
