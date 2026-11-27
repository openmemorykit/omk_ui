import type { LocaleBundle } from '../../../src/protocol/to-page'
import type { LocaleSource } from '../../../src/shared/ports'

export interface LocaleSourceFake extends LocaleSource {
  readonly requested: readonly string[]
  setBundle(locale: string, bundle: LocaleBundle | null): void
}

export function createLocaleSourceFake(bundles: readonly LocaleBundle[] = []): LocaleSourceFake {
  const byLocale = new Map<string, LocaleBundle>(bundles.map((bundle) => [bundle.language, bundle]))
  const requested: string[] = []
  return {
    read(locale) {
      requested.push(locale)
      return byLocale.get(locale) ?? null
    },
    setBundle(locale, bundle) {
      if (bundle === null) byLocale.delete(locale)
      else byLocale.set(locale, bundle)
    },
    requested,
  }
}
