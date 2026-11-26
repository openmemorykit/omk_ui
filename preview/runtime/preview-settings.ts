import type { ValueOf } from '@openmemorykit/core/shared'
import englishMessages from '../../omk_ui/locales/en.json'
import frenchMessages from '../../omk_ui/locales/fr.json'
import { GlyphSet } from '../../src/protocol/page-vocabulary'
import type { BindingLabels, LocaleBundle } from '../../src/protocol/to-page'
import type { ThemeConfig } from '../../src/shared/config/config-schema'
import { THEME_DEFAULTS, type PanelSide } from '../../src/shared/config/theme-defaults'

export const PreviewScene = { Day: 'day', Night: 'night' } as const
export type PreviewScene = ValueOf<typeof PreviewScene>

export const PreviewLanguage = { French: 'fr', English: 'en' } as const
export type PreviewLanguage = ValueOf<typeof PreviewLanguage>

export interface PreviewResolution {
  readonly width: number
  readonly height: number
}

export interface PreviewSettings {
  readonly resolution: PreviewResolution
  readonly scene: PreviewScene
  readonly glyphSet: GlyphSet
  readonly side: ValueOf<typeof PanelSide>
  readonly accent: string
  readonly scale: number
  readonly language: PreviewLanguage
  readonly capture: boolean
}

const FULL_HD: PreviewResolution = Object.freeze({ width: 1920, height: 1080 })

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = Object.freeze({
  resolution: FULL_HD,
  scene: PreviewScene.Night,
  glyphSet: GlyphSet.Xbox,
  side: THEME_DEFAULTS.side,
  accent: THEME_DEFAULTS.accent,
  scale: THEME_DEFAULTS.scale,
  language: PreviewLanguage.French,
  capture: false,
})

export const PREVIEW_BINDINGS: BindingLabels = Object.freeze({ radial: 'F1', interact: 'E', pushToTalk: 'N' })

const FRENCH_BUNDLE: LocaleBundle = Object.freeze({ language: PreviewLanguage.French, messages: frenchMessages })
const BUNDLES: ReadonlyMap<string, LocaleBundle> = new Map([
  [PreviewLanguage.French, FRENCH_BUNDLE],
  [PreviewLanguage.English, Object.freeze({ language: PreviewLanguage.English, messages: englishMessages })],
])

export function previewLocale(language: PreviewLanguage): LocaleBundle {
  return BUNDLES.get(language) ?? FRENCH_BUNDLE
}

export function previewTheme(settings: PreviewSettings): ThemeConfig {
  return { ...THEME_DEFAULTS, side: settings.side, accent: settings.accent, scale: settings.scale }
}
