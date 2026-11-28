import { afterEach, describe, expect, it } from 'vitest'
import { FRAME_STEP_FAILED_LINE, FrameStep, runGuardedStep } from '../../../src/client/application/guarded-frame-step'
import { ONE_LINE_PER_MINUTE_MS } from '../../../src/client/application/trace'
import { expectKeepInputNeverTurnedOn, storeWith, watchedPorts } from './watched-ports'

const STEP_RESULT = 7
const FALLBACK = 3

afterEach(expectKeepInputNeverTurnedOn)

describe('runGuardedStep', () => {
  it('returns what the step returns', () => {
    const ports = watchedPorts()
    expect(runGuardedStep(ports, storeWith(), FrameStep.Pad, () => STEP_RESULT, 0)).toBe(STEP_RESULT)
    expect(ports.console.printed).toStrictEqual([])
  })

  it('prints the failure with its step and returns the fallback', () => {
    const ports = watchedPorts()
    const result = runGuardedStep(ports, storeWith(), FrameStep.Guard, () => {
      throw new Error('broken domain')
    }, false)
    expect(result).toBe(false)
    expect(ports.console.printed).toStrictEqual([`${FRAME_STEP_FAILED_LINE} (${FrameStep.Guard}): broken domain`])
  })

  it('prints a step failure at most once per minute and per step', () => {
    const ports = watchedPorts()
    const store = storeWith()
    const failing = (): never => {
      throw new Error('again')
    }
    runGuardedStep(ports, store, FrameStep.Pad, failing, null)
    runGuardedStep(ports, store, FrameStep.Pad, failing, null)
    runGuardedStep(ports, store, FrameStep.Prompt, failing, null)
    ports.clock.advance(ONE_LINE_PER_MINUTE_MS)
    runGuardedStep(ports, store, FrameStep.Pad, failing, null)
    expect(ports.console.printed.map((line) => line.split(':')[0])).toStrictEqual([FrameStep.Pad, FrameStep.Prompt, FrameStep.Pad].map((step) => `${FRAME_STEP_FAILED_LINE} (${step})`))
  })

  it('describes a thrown value that is not an error', () => {
    const ports = watchedPorts()
    const notAnError: unknown = 'plain text'
    runGuardedStep(ports, storeWith(), FrameStep.Pad, () => {
      throw notAnError
    }, null)
    expect(ports.console.printed).toStrictEqual([`${FRAME_STEP_FAILED_LINE} (${FrameStep.Pad}): plain text`])
  })

  it('survives a thrown value that cannot be printed', () => {
    const ports = watchedPorts()
    const unprintable: unknown = { toString: (): string => { throw new Error('no text') } }
    runGuardedStep(ports, storeWith(), FrameStep.Pad, () => {
      throw unprintable
    }, null)
    expect(ports.console.printed).toStrictEqual([`${FRAME_STEP_FAILED_LINE} (${FrameStep.Pad}): object`])
  })

  it('swallows a console that fails too', () => {
    const ports = watchedPorts()
    const store = storeWith()
    const brokenConsole = { ...ports, console: { print: (): never => { throw new Error('console down') } } }
    expect(runGuardedStep(brokenConsole, store, FrameStep.Pad, () => {
      throw new Error('broken')
    }, FALLBACK)).toBe(FALLBACK)
  })
})
