import { type FromPageMessage } from '../../protocol/from-page'
import { pageErrorMessage } from '../application/page-errors'
import type { Detach } from './window-events'

export const MAX_CAPTURED_ERRORS = 50

interface Described { readonly message: string; readonly stack: string }

function textOf(value: unknown): string {
  try {
    return String(value)
  } catch {
    return ''
  }
}

function describe(value: unknown, fallback: string): Described {
  if (value instanceof Error) return { message: value.message, stack: value.stack ?? '' }
  return { message: fallback.length === 0 ? textOf(value) : fallback, stack: '' }
}

export type ErrorReporter = (value: unknown, fallback?: string) => void

export function createErrorReporter(report: (message: FromPageMessage) => void): ErrorReporter {
  let sent = 0
  return (value, fallback = '') => {
    if (sent >= MAX_CAPTURED_ERRORS) return
    sent += 1
    try {
      const described = describe(value, fallback)
      report(pageErrorMessage(described.message, described.stack))
    } catch {
      return
    }
  }
}

export function installErrorCapture(target: Window, report: (message: FromPageMessage) => void): Detach {
  const send = createErrorReporter(report)
  const onError = (event: ErrorEvent): void => send(event.error, textOf(event.message))
  const onRejection = (event: PromiseRejectionEvent): void => send(event.reason)
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
