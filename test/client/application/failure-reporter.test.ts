import { createManualClock } from '@openmemorykit/core/testing'
import { describe, expect, it } from 'vitest'
import { createFailureReporter } from '../../../src/client/application/failure-reporter'
import { ONE_LINE_PER_OPERATION_INTERVAL_MS } from '../../../src/shared/rate-limit/operation-limiter'
import { createConsoleFake } from '../fakes/console-fake'

const OPERATION = 'controls.readPad'
const TWO_LINES = 2

describe('client failure reporter', () => {
  it('prints one line with the operation and the message, behind the kit prefix', () => {
    const console = createConsoleFake()
    createFailureReporter(console, createManualClock(0))(OPERATION, new Error('native broke'))
    expect(console.printed).toStrictEqual(['[omk_ui] controls.readPad failed: native broke'])
  })

  it('prints a failing operation once per minute, even when it fails on every frame', () => {
    const console = createConsoleFake()
    const clock = createManualClock(0)
    const report = createFailureReporter(console, clock)
    for (let frame = 0; frame < ONE_LINE_PER_OPERATION_INTERVAL_MS; frame += 1) {
      report(OPERATION, new Error('native broke'))
      clock.advance(1)
    }
    report(OPERATION, new Error('native broke'))
    expect(console.printed).toHaveLength(TWO_LINES)
  })

  it('prints two different operations at the same time', () => {
    const console = createConsoleFake()
    const report = createFailureReporter(console, createManualClock(0))
    report(OPERATION, new Error('one'))
    report('game.resolution', new Error('two'))
    expect(console.printed).toHaveLength(TWO_LINES)
  })
})
