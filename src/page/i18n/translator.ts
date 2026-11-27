import type { LocaleBundle } from '../../protocol/to-page'
import type { MessageKey, MessageParams, Translator } from './messages'

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g
const COUNT_PARAM = 'count'
const FALLBACK_LANGUAGE = 'en'
const PluralForm = { One: 'one', Other: 'other' } as const

function pluralRules(language: string): Intl.PluralRules {
  try {
    return new Intl.PluralRules(language)
  } catch {
    return new Intl.PluralRules(FALLBACK_LANGUAGE)
  }
}

function interpolate(template: string, params: MessageParams | undefined): string {
  if (params === undefined) return template
  const own = new Map(Object.entries(params))
  return template.replace(PLACEHOLDER, (placeholder, name: string) => String(own.get(name) ?? placeholder))
}

export function createTranslator(onMissing: (key: string) => void): Translator {
  let messages: ReadonlyMap<string, string> = new Map()
  let rules = pluralRules(FALLBACK_LANGUAGE)
  const reported = new Set<string>()

  const pluralText = (key: string, count: number): string | undefined => {
    const category = rules.select(count)
    const form = category === PluralForm.One ? PluralForm.One : PluralForm.Other
    return messages.get(`${key}.${form}`) ?? messages.get(`${key}.${PluralForm.Other}`)
  }

  const find = (key: string, params: MessageParams | undefined): string | undefined => {
    const count = params === undefined ? undefined : new Map(Object.entries(params)).get(COUNT_PARAM)
    return typeof count === 'number' ? (pluralText(key, count) ?? messages.get(key)) : messages.get(key)
  }

  return {
    load(bundle: LocaleBundle): void {
      messages = new Map(Object.entries(bundle.messages))
      rules = pluralRules(bundle.language)
      reported.clear()
    },
    translate(key: MessageKey, params?: MessageParams): string {
      const text = find(key, params)
      if (text !== undefined) return interpolate(text, params)
      if (!reported.has(key)) {
        reported.add(key)
        onMissing(key)
      }
      return key
    },
  }
}
