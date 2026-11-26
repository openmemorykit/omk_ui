import type { ThemeConfig } from '../../../shared/config/config-schema'
import { PANEL_BACKGROUND } from '../../../shared/config/theme-defaults'
import { computeScale } from '../../domain/scale'
import { deriveAccent } from '../../domain/accent'
import fonts from '../../theme/fonts.json'
import type { ViewportSize } from '../ports'

export const ROOT_FONT_BASE_PX = 16
const FONT_FALLBACK = "'Arial Narrow', sans-serif"

export interface ThemeView {
  readonly cssVariables: Readonly<Record<string, string>>
  readonly rootFontSizePx: number
  readonly fontFamily: ThemeConfig['font']
  readonly side: ThemeConfig['side']
  readonly monogram: string
  readonly logo: string | null
}

export function themeView(settings: ThemeConfig, viewport: ViewportSize): ThemeView {
  const accent = deriveAccent(settings.accent, PANEL_BACKGROUND)
  const font = `'${fonts[settings.font].cssName}', ${FONT_FALLBACK}`
  return {
    cssVariables: {
      '--accent': accent.focusBackground,
      '--accent-ink': accent.accentInk,
      '--accent-dim': accent.accentDim,
      '--accent-text': accent.accentText,
      '--focus-bg': accent.focusBackground,
      '--focus-ink': accent.focusInk,
      '--font-ui': font,
      '--font-head': font,
    },
    rootFontSizePx: ROOT_FONT_BASE_PX * computeScale(viewport.width, viewport.height, settings.scale),
    fontFamily: settings.font,
    side: settings.side,
    monogram: settings.monogram,
    logo: settings.logo,
  }
}
