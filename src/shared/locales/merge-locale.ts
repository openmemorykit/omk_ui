import type { LocaleBundle } from '../../protocol/to-page'
import { BASE_LANGUAGE, isLocaleName, LocalePath } from './locale-name'
import { LOCALE_WARNINGS_MAX, LocaleWarningKind, type LocaleWarning } from './locale-warning'
import { haveSamePlaceholders } from './placeholders'
import { LocaleFileStatus, readLocaleFile, type LocaleFile, type LocaleFileReader } from './read-locale-file'

export type { LocaleFileReader } from './read-locale-file'

export interface MergedLocale {
  readonly bundle: LocaleBundle | null
  readonly warnings: readonly LocaleWarning[]
}

type Messages = Map<string, string>

const REQUESTED_NAME_SHOWN_CHARS = 32

function overlay(messages: Messages, base: ReadonlyMap<string, string>, file: string, entries: ReadonlyMap<string, unknown>, warnings: LocaleWarning[]): void {
  for (const [key, text] of entries) {
    const baseText = base.get(key)
    if (baseText === undefined) warnings.push({ kind: LocaleWarningKind.UnknownKey, file, key })
    else if (typeof text !== 'string') warnings.push({ kind: LocaleWarningKind.NotText, file, key })
    else if (!haveSamePlaceholders(baseText, text)) warnings.push({ kind: LocaleWarningKind.ParameterMismatch, file, key })
    else messages.set(key, text)
  }
}

function textsOf(file: Extract<LocaleFile, { readonly status: typeof LocaleFileStatus.Read }>): ReadonlyMap<string, string> {
  return new Map([...file.entries].filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

function capped(warnings: readonly LocaleWarning[]): readonly LocaleWarning[] {
  if (warnings.length <= LOCALE_WARNINGS_MAX) return warnings
  const last = warnings[LOCALE_WARNINGS_MAX] as LocaleWarning
  return [...warnings.slice(0, LOCALE_WARNINGS_MAX), { kind: LocaleWarningKind.Truncated, file: last.file }]
}

function chosenLanguage(readFile: LocaleFileReader, requested: string, warnings: LocaleWarning[]): { readonly language: string; readonly file: LocaleFile | null } {
  const path = LocalePath.language(requested.slice(0, REQUESTED_NAME_SHOWN_CHARS))
  if (requested === BASE_LANGUAGE || !isLocaleName(requested)) {
    if (requested !== BASE_LANGUAGE) warnings.push({ kind: LocaleWarningKind.LanguageUnavailable, file: path })
    return { language: BASE_LANGUAGE, file: null }
  }
  const file = readLocaleFile(readFile, path)
  if (file.status === LocaleFileStatus.Read) return { language: requested, file }
  warnings.push(...file.warnings.filter((warning) => warning.kind !== LocaleWarningKind.FileUnreadable), { kind: LocaleWarningKind.LanguageUnavailable, file: path })
  return { language: BASE_LANGUAGE, file: null }
}

export function mergeLocale(readFile: LocaleFileReader, requested: string): MergedLocale {
  const english = readLocaleFile(readFile, LocalePath.language(BASE_LANGUAGE))
  if (english.status !== LocaleFileStatus.Read) return { bundle: null, warnings: english.warnings }
  const base = textsOf(english)
  const messages: Messages = new Map(base)
  const warnings: LocaleWarning[] = []
  const { language, file } = chosenLanguage(readFile, requested, warnings)
  if (file !== null && file.status === LocaleFileStatus.Read) overlay(messages, base, LocalePath.language(language), file.entries, warnings)
  const overrides = readLocaleFile(readFile, LocalePath.overrides(language))
  if (overrides.status === LocaleFileStatus.Read) overlay(messages, base, LocalePath.overrides(language), overrides.entries, warnings)
  else if (overrides.status === LocaleFileStatus.Unusable) warnings.push(...overrides.warnings)
  return { bundle: { language, messages: Object.fromEntries(messages) }, warnings: capped(warnings) }
}
