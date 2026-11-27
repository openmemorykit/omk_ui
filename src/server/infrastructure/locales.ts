import { guardedCall, type FailureHandler } from '../../shared/guarded-call'
import type { LocaleWarning } from '../../shared/locales/locale-warning'
import { createMergedLocaleSource } from '../../shared/locales/merged-locale-source'
import type { LocaleSource } from '../../shared/ports'

function readResourceFile(path: string, onFailure: FailureHandler): string | null {
  const content: unknown = guardedCall(onFailure, `LoadResourceFile ${path}`, () => LoadResourceFile(GetCurrentResourceName(), path), null)
  return typeof content === 'string' ? content : null
}

export function createServerLocaleSource(onWarning: (warning: LocaleWarning) => void, onFailure: FailureHandler): LocaleSource {
  return createMergedLocaleSource({ readFile: (path) => readResourceFile(path, onFailure), onWarning })
}
