import { describeError } from '../../shared/describe-error'
import type { FailureHandler } from '../../shared/guarded-call'
import type { Clock } from '../../shared/ports'
import { createOperationLimiter } from '../../shared/rate-limit/operation-limiter'
import { CONSOLE_PREFIX } from './limited-console'
import type { ConsolePort } from './ports'

export function createFailureReporter(console: ConsolePort, clock: Clock): FailureHandler {
  const allows = createOperationLimiter(clock)
  return (operation, failure) => {
    if (allows(operation)) console.print(`${CONSOLE_PREFIX} ${operation} failed: ${describeError(failure)}`)
  }
}
