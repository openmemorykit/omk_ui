import type { LocaleSource } from '../../shared/ports'
import { createMergedLocaleSource } from '../../shared/locales/merged-locale-source'
import type { LocaleWarning } from '../../shared/locales/locale-warning'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

const SERVER_ONLY_KEY_PREFIX = 'log.'

function readResourceFile(path: string, onFailure: NativeFailureHandler): string | null {
  const content: unknown = guardedNativeCall(onFailure, `LoadResourceFile ${path}`, () => LoadResourceFile(GetCurrentResourceName(), path), null)
  return typeof content === 'string' ? content : null
}

export function createClientLocaleSource(onWarning: (warning: LocaleWarning) => void, onFailure: NativeFailureHandler): LocaleSource {
  return createMergedLocaleSource({
    readFile: (path) => readResourceFile(path, onFailure),
    onWarning,
    includesKey: (key) => !key.startsWith(SERVER_ONLY_KEY_PREFIX),
  })
}
