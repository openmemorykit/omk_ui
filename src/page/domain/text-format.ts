import { TextFormat } from '@openmemorykit/ui/contract'

export const TEXT_FORMAT_PATTERNS: Readonly<Record<TextFormat, RegExp>> = Object.freeze({
  [TextFormat.Digits]: /^[0-9]+$/,
  [TextFormat.Hex]: /^[0-9a-fA-F]+$/,
  [TextFormat.Slug]: /^[a-z0-9][a-z0-9_-]*$/,
  [TextFormat.PlayerIdentifier]: /^[a-z0-9]{2,16}:[0-9A-Za-z._-]{1,64}$/,
})

const LOWERCASED_FORMATS: ReadonlySet<TextFormat> = new Set([TextFormat.Hex, TextFormat.PlayerIdentifier])

export function matchesFormat(format: TextFormat, value: string): boolean {
  return TEXT_FORMAT_PATTERNS[format].test(value)
}

export function normalizeFormatted(format: TextFormat, value: string): string {
  return LOWERCASED_FORMATS.has(format) ? value.toLowerCase() : value
}
