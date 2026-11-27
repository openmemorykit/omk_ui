import type { LocaleWarning } from '../../shared/locales/locale-warning'
import { createMergedLocaleSource } from '../../shared/locales/merged-locale-source'
import type { LocaleSource } from '../../shared/ports'

export type LocaleFailureHandler = (operation: string, failure: unknown) => void

function readResourceFile(path: string, onFailure: LocaleFailureHandler): string | null {
  try {
    const content: unknown = LoadResourceFile(GetCurrentResourceName(), path)
    return typeof content === 'string' ? content : null
  } catch (failure) {
    try {
      onFailure(`LoadResourceFile ${path}`, failure)
    } catch {
      return null
    }
    return null
  }
}

export function createServerLocaleSource(onWarning: (warning: LocaleWarning) => void, onFailure: LocaleFailureHandler): LocaleSource {
  return createMergedLocaleSource({ readFile: (path) => readResourceFile(path, onFailure), onWarning })
}
