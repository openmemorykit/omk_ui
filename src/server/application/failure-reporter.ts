import { describeError } from '../../shared/describe-error'
import type { FailureHandler } from '../../shared/guarded-call'
import type { Clock } from '../../shared/ports'
import { createOperationLimiter } from '../../shared/rate-limit/operation-limiter'
import type { ServerConsole } from './ports'
import { LOG_PREFIX, printable } from './server-log'

export function createFailureReporter(console: ServerConsole, clock: Clock): FailureHandler {
  const allows = createOperationLimiter(clock)
  return (operation, failure) => {
    if (allows(operation)) console.line(`${LOG_PREFIX} ${printable(`${operation} failed: ${describeError(failure)}`)}`)
  }
}
