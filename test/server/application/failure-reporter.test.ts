import { createManualClock } from '@openmemorykit/core/testing'
import { describe, expect, it } from 'vitest'
import { createFailureReporter } from '../../../src/server/application/failure-reporter'
import { PRINTABLE_MAX_LENGTH } from '../../../src/server/application/server-log'
import { ONE_LINE_PER_OPERATION_INTERVAL_MS } from '../../../src/shared/rate-limit/operation-limiter'
import { createServerConsoleFake } from '../fakes/server-console-fake'

const OPERATION = 'omk_ui:report'
const TWO_LINES = 2
const DOUBLE = 2

describe('server failure reporter', () => {
  it('prints one line with the operation and the message, behind the kit prefix', () => {
    const console = createServerConsoleFake()
    createFailureReporter(console, createManualClock(0))(OPERATION, new Error('handler broke'))
    expect(console.lines).toStrictEqual(['[omk_ui] omk_ui:report failed: handler broke'])
  })

  it('prints a failing operation once per minute, however often a client makes it fail', () => {
    const console = createServerConsoleFake()
    const clock = createManualClock(0)
    const report = createFailureReporter(console, clock)
    for (let attempt = 0; attempt < ONE_LINE_PER_OPERATION_INTERVAL_MS; attempt += 1) {
      report(OPERATION, new Error('handler broke'))
      clock.advance(1)
    }
    report(OPERATION, new Error('handler broke'))
    expect(console.lines).toHaveLength(TWO_LINES)
  })

  it('keeps control characters and colour codes of the message out of the console', () => {
    const console = createServerConsoleFake()
    createFailureReporter(console, createManualClock(0))(OPERATION, new Error('line one\nline two ^1red'))
    expect(console.lines).toStrictEqual(['[omk_ui] omk_ui:report failed: line one line two ^ 1red'])
  })

  it('cuts a very long message', () => {
    const console = createServerConsoleFake()
    createFailureReporter(console, createManualClock(0))(OPERATION, new Error('x'.repeat(PRINTABLE_MAX_LENGTH * DOUBLE)))
    expect(console.lines[0]?.length).toBeLessThanOrEqual('[omk_ui] '.length + PRINTABLE_MAX_LENGTH)
  })
})
