import { parseHexChannels } from '../../../src/shared/config/contrast'

const DECLARATION = /--([a-z0-9-]+)\s*:\s*([^;]+);/g
const KEYFRAMES = /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g
const HEX = /^#[0-9a-fA-F]{6}$/
const TRIPLET = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/
const SURFACE_COLOR = /^rgb\(var\(--([a-z0-9-]+)\) \/ var\(--panel-alpha\)\)$/
const ALIAS = /^var\(--([a-z0-9-]+)\)$/
const REM = /^(\d+(?:\.\d+)?)rem$/
const MILLISECONDS = /^(\d+)ms$/
const HEX_RADIX = 16
const CHANNEL_DIGITS = 2
const NAME_GROUP = 1
const VALUE_GROUP = 2

export type TokenMap = ReadonlyMap<string, string>

export function readTokens(css: string): TokenMap {
  return new Map(Array.from(css.matchAll(DECLARATION), (match) => [match[NAME_GROUP] ?? '', (match[VALUE_GROUP] ?? '').trim()]))
}

export function tokenOf(tokens: TokenMap, name: string): string {
  const value = tokens.get(name)
  if (value === undefined) throw new Error(`missing token --${name}`)
  return value
}

export function tripletChannels(triplet: string): readonly number[] | null {
  const match = TRIPLET.exec(triplet)
  return match === null ? null : match.slice(1).map(Number)
}

function hexOfTriplet(triplet: string): string {
  const channels = tripletChannels(triplet)
  if (channels === null) throw new Error(`not an rgb triplet: ${triplet}`)
  return `#${channels.map((channel) => channel.toString(HEX_RADIX).toUpperCase().padStart(CHANNEL_DIGITS, '0')).join('')}`
}

export function colorOf(tokens: TokenMap, name: string): string {
  const value = tokenOf(tokens, name)
  if (HEX.test(value)) return value.toUpperCase()
  const surface = SURFACE_COLOR.exec(value)
  if (surface !== null) return hexOfTriplet(tokenOf(tokens, surface[1] ?? ''))
  const alias = ALIAS.exec(value)
  if (alias !== null) return colorOf(tokens, alias[1] ?? '')
  throw new Error(`--${name} is not an opaque color: ${value}`)
}

export function remOf(value: string): number | null {
  const match = REM.exec(value)
  return match === null ? null : Number(match[1])
}

export function millisecondsOf(value: string): number | null {
  const match = MILLISECONDS.exec(value)
  return match === null ? null : Number(match[1])
}

export function withoutKeyframes(css: string): string {
  return css.replace(KEYFRAMES, '')
}

export function declarationValues(css: string, property: string): readonly string[] {
  const pattern = new RegExp(`(?:^|[\\s;{])${property}\\s*:\\s*([^;}]+)`, 'g')
  return Array.from(css.matchAll(pattern), (match) => (match[1] ?? '').trim())
}

export function isHexColor(value: string): boolean {
  return parseHexChannels(value) !== null
}
