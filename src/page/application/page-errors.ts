import { FromPage, PAGE_ERROR_STACK_MAX_BYTES, type FromPageMessage } from '../../protocol/from-page'

export const PAGE_ERROR_MESSAGE_MAX_UNITS = 256

const HIGH_SURROGATE_FIRST = 0xd800
const HIGH_SURROGATE_LAST = 0xdbff
const ONE_BYTE_LAST = 0x7f
const TWO_BYTES_LAST = 0x7ff
const BYTES = { One: 1, Two: 2, Three: 3, Four: 4 } as const
const START = 0

function endsInHighSurrogate(text: string): boolean {
  const last = text.charCodeAt(text.length - 1)
  return last >= HIGH_SURROGATE_FIRST && last <= HIGH_SURROGATE_LAST
}

function truncateUnits(text: string, maxUnits: number): string {
  if (text.length <= maxUnits) return text
  const cut = text.slice(START, maxUnits)
  return endsInHighSurrogate(cut) ? cut.slice(START, cut.length - 1) : cut
}

function utf8Size(character: string): number {
  if (character.length > BYTES.One) return BYTES.Four
  const code = character.charCodeAt(START)
  if (code <= ONE_BYTE_LAST) return BYTES.One
  return code <= TWO_BYTES_LAST ? BYTES.Two : BYTES.Three
}

function truncateBytes(text: string, maxBytes: number): string {
  let used = 0
  let end = 0
  for (const character of text) {
    const size = utf8Size(character)
    if (used + size > maxBytes) break
    used += size
    end += character.length
  }
  return text.slice(START, end)
}

export function pageErrorMessage(message: string, stack: string): FromPageMessage {
  return {
    type: FromPage.PageError,
    message: truncateUnits(message, PAGE_ERROR_MESSAGE_MAX_UNITS),
    stack: truncateBytes(stack, PAGE_ERROR_STACK_MAX_BYTES),
  }
}
