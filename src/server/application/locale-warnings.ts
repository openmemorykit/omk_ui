import type { LocaleWarning } from '../../shared/locales/locale-warning'
import type { ServerContext } from './server-context'
import { printable } from './server-log'

const PENDING_LOCALE_WARNINGS_MAX = 64
const NO_KEY = ''

export interface LocaleWarningQueue {
  add(warning: LocaleWarning): void
  printAll(): void
}

export function createLocaleWarningQueue(context: ServerContext): LocaleWarningQueue {
  const pending: LocaleWarning[] = []
  return {
    add(warning) {
      if (pending.length < PENDING_LOCALE_WARNINGS_MAX) pending.push(warning)
    },
    printAll() {
      for (let warning = pending.shift(); warning !== undefined; warning = pending.shift()) {
        const line = context.log.translate(`log.locale.${warning.kind}`, { file: printable(warning.file), key: printable(warning.key ?? NO_KEY) })
        context.log.printLine(line)
      }
    },
  }
}
