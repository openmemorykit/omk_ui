import type { ValueOf } from '@openmemorykit/core/shared'
import {
  DEFAULT_PREVIEW_SETTINGS,
  PreviewLanguage,
  PreviewScene,
  type PreviewResolution,
  type PreviewSettings,
} from '../runtime/preview-settings'
import { ScenarioId } from '../runtime/types'
import { GlyphSet } from '../../src/protocol/page-vocabulary'
import { contrastRatio } from '../../src/shared/config/contrast'
import { MIN_FOCUS_CONTRAST } from '../../src/shared/config/config-schema'
import { PANEL_BACKGROUND, PanelSide } from '../../src/shared/config/theme-defaults'

export const UrlParam = {
  Scenario: 'scenario',
  Resolution: 'res',
  Scene: 'scene',
  Glyphs: 'glyphs',
  Side: 'side',
  Accent: 'accent',
  Scale: 'scale',
  Language: 'lang',
  Capture: 'capture',
} as const

export type UrlParam = ValueOf<typeof UrlParam>

export const MIN_SCALE = 0.9
export const MAX_SCALE = 1.1
export const MIN_WIDTH = 640
export const MAX_WIDTH = 7680
export const MIN_HEIGHT = 360
export const MAX_HEIGHT = 4320
export const DEFAULT_SCENARIO: ScenarioId = ScenarioId.Radial

const CAPTURE_ON = '1'
const RESOLUTION_PATTERN = /^(\d{1,5})x(\d{1,5})$/
const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/
const SCALE_PATTERN = /^\d(\.\d{1,3})?$/

function oneOf<Member extends string>(members: Readonly<Record<string, Member>>, raw: string | null, fallback: Member): Member {
  const match = Object.values(members).find((member) => member === raw)
  return match ?? fallback
}

function readResolution(raw: string | null, fallback: PreviewResolution): PreviewResolution {
  const match = RESOLUTION_PATTERN.exec(raw ?? '')
  const [, rawWidth, rawHeight] = match ?? []
  const width = Number(rawWidth)
  const height = Number(rawHeight)
  const inside = width >= MIN_WIDTH && width <= MAX_WIDTH && height >= MIN_HEIGHT && height <= MAX_HEIGHT
  return match !== null && inside ? { width, height } : fallback
}

function readAccent(raw: string | null, fallback: string): string {
  const readable = raw !== null && ACCENT_PATTERN.test(raw) && contrastRatio(raw, PANEL_BACKGROUND) >= MIN_FOCUS_CONTRAST
  return readable ? raw : fallback
}

function readScale(raw: string | null, fallback: number): number {
  const scale = Number(raw)
  const inside = raw !== null && SCALE_PATTERN.test(raw) && scale >= MIN_SCALE && scale <= MAX_SCALE
  return inside ? scale : fallback
}

export function readUrlScenario(search: string): ScenarioId {
  return oneOf<ScenarioId>(ScenarioId, new URLSearchParams(search).get(UrlParam.Scenario), DEFAULT_SCENARIO)
}

export function readUrlSettings(search: string): PreviewSettings {
  const params = new URLSearchParams(search)
  const defaults = DEFAULT_PREVIEW_SETTINGS
  return {
    resolution: readResolution(params.get(UrlParam.Resolution), defaults.resolution),
    scene: oneOf<PreviewScene>(PreviewScene, params.get(UrlParam.Scene), defaults.scene),
    glyphSet: oneOf<GlyphSet>(GlyphSet, params.get(UrlParam.Glyphs), defaults.glyphSet),
    side: oneOf<ValueOf<typeof PanelSide>>(PanelSide, params.get(UrlParam.Side), defaults.side),
    accent: readAccent(params.get(UrlParam.Accent), defaults.accent),
    scale: readScale(params.get(UrlParam.Scale), defaults.scale),
    language: oneOf<PreviewLanguage>(PreviewLanguage, params.get(UrlParam.Language), defaults.language),
    capture: params.get(UrlParam.Capture) === CAPTURE_ON,
  }
}

export function toSearch(scenario: ScenarioId, settings: PreviewSettings): string {
  const params = new URLSearchParams()
  params.set(UrlParam.Scenario, scenario)
  params.set(UrlParam.Resolution, `${settings.resolution.width}x${settings.resolution.height}`)
  params.set(UrlParam.Scene, settings.scene)
  params.set(UrlParam.Glyphs, settings.glyphSet)
  params.set(UrlParam.Side, settings.side)
  params.set(UrlParam.Accent, settings.accent)
  params.set(UrlParam.Scale, String(settings.scale))
  params.set(UrlParam.Language, settings.language)
  if (settings.capture) params.set(UrlParam.Capture, CAPTURE_ON)
  return `?${params.toString()}`
}
