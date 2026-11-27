import { hasOwnKey } from '@openmemorykit/core/shared'
import type { ClientPorts } from './ports'
import { FALLBACK_LOCALE, requestedLocale } from './requested-locale'

export const KeyBindingTextKey = { Radial: 'keybind.radial', Interact: 'keybind.interact', GlyphsSuggestion: 'glyphs.suggestion' } as const

const ENGLISH_TEXTS = {
  [KeyBindingTextKey.Radial]: 'Open the radial menu (omk_ui)',
  [KeyBindingTextKey.Interact]: 'Interact with a prompt (omk_ui)',
  [KeyBindingTextKey.GlyphsSuggestion]: 'Choose the icons of your controller',
} as const

export interface KeyBindingTexts {
  readonly radial: string
  readonly interact: string
  readonly glyphsSuggestion: string
}

export function keyBindingTexts(ports: ClientPorts): KeyBindingTexts {
  const messages = ports.locales.read(requestedLocale(ports))?.messages ?? ports.locales.read(FALLBACK_LOCALE)?.messages ?? {}
  const textOf = (key: keyof typeof ENGLISH_TEXTS): string => (hasOwnKey(messages, key) ? messages[key] : undefined) ?? ENGLISH_TEXTS[key]
  return {
    radial: textOf(KeyBindingTextKey.Radial),
    interact: textOf(KeyBindingTextKey.Interact),
    glyphsSuggestion: textOf(KeyBindingTextKey.GlyphsSuggestion),
  }
}
