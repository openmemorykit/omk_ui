const HEX_COLOR = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
const HEX_RADIX = 16
const CHANNEL_MAX = 255
const LINEAR_THRESHOLD = 0.04045
const LINEAR_DIVISOR = 12.92
const GAMMA_OFFSET = 0.055
const GAMMA_DIVISOR = 1.055
const GAMMA_EXPONENT = 2.4
const RED_WEIGHT = 0.2126
const GREEN_WEIGHT = 0.7152
const BLUE_WEIGHT = 0.0722
const CONTRAST_OFFSET = 0.05

function linearChannel(channelValue: number): number {
  const channel = channelValue / CHANNEL_MAX
  return channel <= LINEAR_THRESHOLD ? channel / LINEAR_DIVISOR : ((channel + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT
}

export type HexChannels = readonly [number, number, number]

export function parseHexChannels(hexColor: string): HexChannels | null {
  const match = HEX_COLOR.exec(hexColor)
  if (match === null) return null
  const [, red, green, blue] = match as unknown as readonly [string, string, string, string]
  return [parseInt(red, HEX_RADIX), parseInt(green, HEX_RADIX), parseInt(blue, HEX_RADIX)]
}

export function relativeLuminance(hexColor: string): number {
  const channels = parseHexChannels(hexColor)
  if (channels === null) return 0
  const [red, green, blue] = channels
  return RED_WEIGHT * linearChannel(red) + GREEN_WEIGHT * linearChannel(green) + BLUE_WEIGHT * linearChannel(blue)
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  return (Math.max(firstLuminance, secondLuminance) + CONTRAST_OFFSET) / (Math.min(firstLuminance, secondLuminance) + CONTRAST_OFFSET)
}
