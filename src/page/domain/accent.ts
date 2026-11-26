import { contrastRatio } from '../../shared/config/contrast'

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
const HEX_COLOR = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
const HEX_RADIX = 16
const CHANNEL_DIGITS = 2
const LIGHTEN_STEP = 0.05
const LIGHTEN_STEPS = 20
const DIM_SHARE = 0.5

type Channels = readonly [number, number, number]

function parseChannels(color: string): Channels {
  const match = HEX_COLOR.exec(color)
  if (match === null) return [0, 0, 0]
  const [, red, green, blue] = match as unknown as readonly [string, string, string, string]
  return [parseInt(red, HEX_RADIX), parseInt(green, HEX_RADIX), parseInt(blue, HEX_RADIX)]
}

function formatChannels(channels: Channels): string {
  const pairs = channels.map((channel) => channel.toString(HEX_RADIX).toUpperCase().padStart(CHANNEL_DIGITS, '0'))
  return `#${pairs.join('')}`
}

function mix(from: string, to: string, share: number): string {
  const start = parseChannels(from)
  const end = parseChannels(to)
  const mixed = start.map((channel, index) => Math.round(channel + ((end[index] ?? 0) - channel) * share))
  return formatChannels(mixed as unknown as Channels)
}

function pickInk(accent: string): string {
  return contrastRatio(INK_DARK, accent) >= contrastRatio(INK_LIGHT, accent) ? INK_DARK : INK_LIGHT
}

function lightenUntilReadable(accent: string, background: string): string {
  let candidate = formatChannels(parseChannels(accent))
  for (let step = 1; step <= LIGHTEN_STEPS && contrastRatio(candidate, background) < ACCENT_TEXT_MIN_CONTRAST; step += 1) {
    candidate = mix(accent, INK_LIGHT, step * LIGHTEN_STEP)
  }
  return candidate
}

export function deriveAccent(accent: string, panelBackground: string): AccentTokens {
  const normalized = formatChannels(parseChannels(accent))
  const accentInk = pickInk(normalized)
  return {
    accentInk,
    accentDim: mix(normalized, panelBackground, DIM_SHARE),
    accentText: lightenUntilReadable(normalized, panelBackground),
    focusBackground: normalized,
    focusInk: accentInk,
  }
}
