import { contrastRatio, parseHexChannels, type HexChannels } from '../../shared/config/contrast'
import { PANEL_BACKGROUND, THEME_DEFAULTS } from '../../shared/config/theme-defaults'

export interface AccentTokens {
  readonly accentInk: string
  readonly accentDim: string
  readonly accentText: string
  readonly focusBackground: string
  readonly focusInk: string
}

export const ACCENT_TEXT_MIN_CONTRAST = 4.5

const INK_DARK = '#000000'
const INK_LIGHT = '#FFFFFF'
const CHANNEL_MAX = 255
const WHITE_CHANNELS: HexChannels = [CHANNEL_MAX, CHANNEL_MAX, CHANNEL_MAX]
const HEX_RADIX = 16
const CHANNEL_DIGITS = 2
const LIGHTEN_STEP = 0.05
const LIGHTEN_STEPS = 20
const DIM_BACKGROUND_SHARE = 0.75

function formatChannels(channels: HexChannels): string {
  const pairs = channels.map((channel) => channel.toString(HEX_RADIX).toUpperCase().padStart(CHANNEL_DIGITS, '0'))
  return `#${pairs.join('')}`
}

function mix(from: HexChannels, to: HexChannels, share: number): HexChannels {
  const blend = (start: number, end: number): number => Math.round(start + (end - start) * share)
  const [fromRed, fromGreen, fromBlue] = from
  const [toRed, toGreen, toBlue] = to
  return [blend(fromRed, toRed), blend(fromGreen, toGreen), blend(fromBlue, toBlue)]
}

function pickInk(accent: string): string {
  return contrastRatio(INK_DARK, accent) >= contrastRatio(INK_LIGHT, accent) ? INK_DARK : INK_LIGHT
}

function lightenUntilReadable(accent: HexChannels, background: string): string {
  let candidate = formatChannels(accent)
  for (let step = 1; step <= LIGHTEN_STEPS && contrastRatio(candidate, background) < ACCENT_TEXT_MIN_CONTRAST; step += 1) {
    candidate = formatChannels(mix(accent, WHITE_CHANNELS, step * LIGHTEN_STEP))
  }
  return candidate
}

export function deriveAccent(accent: string, panelBackground: string): AccentTokens {
  const accentChannels = parseHexChannels(accent)
  if (accentChannels === null) return deriveAccent(THEME_DEFAULTS.accent, panelBackground)
  const backgroundChannels = parseHexChannels(panelBackground)
  if (backgroundChannels === null) return deriveAccent(accent, PANEL_BACKGROUND)
  const normalized = formatChannels(accentChannels)
  const background = formatChannels(backgroundChannels)
  const accentInk = pickInk(normalized)
  return {
    accentInk,
    accentDim: formatChannels(mix(accentChannels, backgroundChannels, DIM_BACKGROUND_SHARE)),
    accentText: lightenUntilReadable(accentChannels, background),
    focusBackground: normalized,
    focusInk: accentInk,
  }
}
