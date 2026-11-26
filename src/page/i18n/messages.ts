import type locale from '../../../omk_ui/locales/fr.json'
import type { LocaleBundle } from '../../protocol/to-page'

type PluralSuffix = 'one' | 'other'
type BaseKey<Key extends string> = Key extends `${infer Base}.${PluralSuffix}` ? Base : Key

export type MessageParams = Readonly<Record<string, string | number>>
export type MessageKey = BaseKey<keyof typeof locale>
export type Translate = (key: MessageKey, params?: MessageParams) => string

export interface Translator {
  load(bundle: LocaleBundle): void
  translate: Translate
}
