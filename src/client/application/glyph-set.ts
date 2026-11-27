import { GlyphSet } from '../../protocol/page-vocabulary'
import { ToPage } from '../../protocol/to-page'
import type { ClientPorts } from './ports'

export const LOCALE_CONVAR = 'omk_ui_locale'
export const FALLBACK_LOCALE = 'en'
export const GlyphMessageKey = { Usage: 'glyphs.usage', Changed: 'glyphs.changed' } as const

const GLYPH_NAME_KEY_PREFIX = 'glyphs.set.'
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g
const NO_PARAMS: ReadonlyMap<string, string> = new Map()

export function parseGlyphSet(word: string | undefined): GlyphSet | null {
  const wanted = word?.toLowerCase()
  return Object.values(GlyphSet).find((glyphSet) => glyphSet.toLowerCase() === wanted) ?? null
}

function playerMessages(ports: ClientPorts): ReadonlyMap<string, string> {
  const locale = ports.convars.read(LOCALE_CONVAR) ?? FALLBACK_LOCALE
  const bundle = ports.locales.read(locale) ?? ports.locales.read(FALLBACK_LOCALE)
  return new Map(bundle === null ? [] : Object.entries(bundle.messages))
}

function translate(messages: ReadonlyMap<string, string>, key: string, params: ReadonlyMap<string, string> = NO_PARAMS): string {
  const template = messages.get(key) ?? key
  return template.replace(PLACEHOLDER, (placeholder, name: string) => params.get(name) ?? placeholder)
}

export function changeGlyphSet(ports: ClientPorts, args: readonly string[]): void {
  const messages = playerMessages(ports)
  const glyphSet = parseGlyphSet(args[0])
  if (glyphSet === null) {
    ports.console.print(translate(messages, GlyphMessageKey.Usage))
    return
  }
  ports.glyphs.write(glyphSet)
  ports.nui.send({ type: ToPage.GlyphSet, glyphSet })
  const glyphSetName = translate(messages, `${GLYPH_NAME_KEY_PREFIX}${glyphSet}`)
  ports.console.print(translate(messages, GlyphMessageKey.Changed, new Map([['glyphSet', glyphSetName]])))
}
