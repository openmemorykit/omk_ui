import type { LocaleWarning } from '../../shared/locales/locale-warning'
import { CONSOLE_PREFIX } from './limited-console'

export function localeWarningLine(warning: LocaleWarning): string {
  const key = warning.key === undefined ? '' : `, key ${warning.key}`
  return `${CONSOLE_PREFIX} language file ${warning.file}: ${warning.kind}${key}`
}
