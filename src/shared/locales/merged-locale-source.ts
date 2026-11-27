import type { LocaleSource } from '../ports'
import { isLocaleName } from './locale-name'
import type { LocaleWarning } from './locale-warning'
import { mergeLocale, type LocaleFileReader } from './merge-locale'
import type { LocaleBundle } from '../../protocol/to-page'

export interface MergedLocaleSourceOptions {
  readonly readFile: LocaleFileReader
  readonly onWarning: (warning: LocaleWarning) => void
  readonly includesKey?: (key: string) => boolean
}

const LOCALE_CACHE_MAX = 16
const INVALID_NAME_CACHE_KEY = ''

function everyKey(): boolean {
  return true
}

function filtered(bundle: LocaleBundle, includesKey: (key: string) => boolean): LocaleBundle {
  const kept = Object.entries(bundle.messages).filter(([key]) => includesKey(key))
  return { language: bundle.language, messages: Object.fromEntries(kept) }
}

function reportWarnings(options: MergedLocaleSourceOptions, warnings: readonly LocaleWarning[], includesKey: (key: string) => boolean): void {
  for (const warning of warnings) {
    if (warning.key !== undefined && !includesKey(warning.key)) continue
    try {
      options.onWarning(warning)
    } catch {
      return
    }
  }
}

export function createMergedLocaleSource(options: MergedLocaleSourceOptions): LocaleSource {
  const includesKey = options.includesKey ?? everyKey
  const cache = new Map<string, LocaleBundle | null>()

  const load = (requested: string): LocaleBundle | null => {
    try {
      const merged = mergeLocale(options.readFile, requested)
      reportWarnings(options, merged.warnings, includesKey)
      return merged.bundle === null ? null : filtered(merged.bundle, includesKey)
    } catch {
      return null
    }
  }

  return {
    read(locale) {
      const cacheKey = isLocaleName(locale) ? locale : INVALID_NAME_CACHE_KEY
      const cached = cache.get(cacheKey)
      if (cached !== undefined) return cached
      const bundle = load(locale)
      if (cache.size >= LOCALE_CACHE_MAX) cache.clear()
      cache.set(cacheKey, bundle)
      return bundle
    },
  }
}
