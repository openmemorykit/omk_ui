import { afterEach, describe, expect, it } from 'vitest'
import { FRAME_STEP_FAILED_LINE, FrameStep, ONCE_PER_KIT_LIFETIME, printLimited, runGuardedStep } from '../../../src/client/application/limited-console'
import { LIMITED_TRACE_KEYS_MAX, ONE_LINE_PER_MINUTE_MS } from '../../../src/client/application/trace'
import { expectKeepInputNeverTurnedOn, storeWith, watchedPorts } from './watched-ports'

const LINE = 'something happened'
const KEY = 'something'
const STEP_RESULT = 7
const FALLBACK = 3

afterEach(expectKeepInputNeverTurnedOn)

describe('printLimited', () => {
  it('prints the first line for a key', () => {
    const ports = watchedPorts()
    printLimited(ports, storeWith(), KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    expect(ports.console.printed).toStrictEqual([LINE])
  })

  it('prints again only once the interval has passed', () => {
    const ports = watchedPorts()
    const store = storeWith()
    printLimited(ports, store, KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    ports.clock.advance(ONE_LINE_PER_MINUTE_MS - 1)
    printLimited(ports, store, KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    ports.clock.advance(1)
    printLimited(ports, store, KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    expect(ports.console.printed).toStrictEqual([LINE, LINE])
  })

  it('prints a once-per-lifetime line a single time', () => {
    const ports = watchedPorts()
    const store = storeWith()
    printLimited(ports, store, KEY, ONCE_PER_KIT_LIFETIME, LINE)
    ports.clock.advance(Number.MAX_SAFE_INTEGER)
    printLimited(ports, store, KEY, ONCE_PER_KIT_LIFETIME, LINE)
    expect(ports.console.printed).toStrictEqual([LINE])
  })

  it('keeps console keys apart from trace keys and sends nothing to the server', () => {
    const ports = watchedPorts()
    const store = storeWith()
    printLimited(ports, store, KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    expect([...store.read().trace.lastLimitedAt.keys()]).not.toContain(KEY)
    expect(ports.server.reports).toStrictEqual([])
  })

  it('forgets the oldest key beyond the bound', () => {
    const ports = watchedPorts()
    const store = storeWith()
    Array.from({ length: LIMITED_TRACE_KEYS_MAX + 1 }, (_unused, index) => printLimited(ports, store, `key-${index}`, ONCE_PER_KIT_LIFETIME, LINE))
    expect(store.read().trace.lastLimitedAt.size).toBe(LIMITED_TRACE_KEYS_MAX)
    printLimited(ports, store, 'key-0', ONCE_PER_KIT_LIFETIME, LINE)
    expect(ports.console.printed).toHaveLength(LIMITED_TRACE_KEYS_MAX + 1 + 1)
  })
})

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
