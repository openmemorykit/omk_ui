import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostWarning, SESSION_TOKEN_KEY, SESSION_TOKEN_MAX_LENGTH } from '../../../../src/page/infrastructure/host/fivem-host'
import { ToPage } from '../../../../src/protocol/to-page'
import { TO_PAGE_SAMPLES } from '../../../fixtures/messages'
import { bootWith, createHarness, TOKEN, type Harness } from './fivem-host-harness'

const UNKNOWN_TYPE = 'unknownType'
const NUMERIC_TYPE = 42
const INHERITED_NAMES = ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'valueOf']
const TOKEN_UNIT = 'a'

function throwingAccessor(key: string): object {
  return Object.defineProperty({}, key, { enumerable: true, get: () => { throw new Error('accessor read') } })
}

const FOREIGN_MESSAGES: readonly (readonly [string, unknown])[] = [
  ['a string', ToPage.Boot],
  ['a JSON string', JSON.stringify(TO_PAGE_SAMPLES[ToPage.OpenRadial])],
  ['an array', [ToPage.OpenRadial]],
  ['an array carrying a type', Object.assign([], { type: ToPage.OpenRadial })],
  ['null', null],
  ['undefined', undefined],
  ['a number', NUMERIC_TYPE],
  ['an empty object', {}],
  ['an unknown type', { type: UNKNOWN_TYPE }],
  ['a numeric type', { type: NUMERIC_TYPE }],
  ['a boxed string type', { type: Object(ToPage.OpenRadial) as unknown }],
  ['an inherited type', Object.create({ type: ToPage.OpenRadial }) as unknown],
  ['a type under __proto__', JSON.parse(`{"__proto__":{"type":"${ToPage.OpenRadial}"}}`) as unknown],
  ['a class instance with an own type', Object.assign(new Date(), { type: ToPage.OpenRadial })],
  ['a Map', new Map([['type', ToPage.OpenRadial]])],
  ['a type behind a throwing accessor', throwingAccessor('type')],
  ...INHERITED_NAMES.map((name) => [`the Object.prototype name ${name}`, JSON.parse(`{"type":"${name}"}`) as unknown] as const),
]

let harness: Harness

beforeEach(() => {
  harness = createHarness()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('incoming messages', () => {
  it.each(FOREIGN_MESSAGES)('ignores %s without throwing or warning', (_label, data) => {
    harness.attach()
    expect(() => harness.deliver(data)).not.toThrow()
    expect(harness.received).toEqual([])
    expect(harness.warnings).toEqual([])
  })

  it('passes a known message to every listener', () => {
    const others: unknown[] = []
    harness.attach()
    harness.host.listen((message) => void others.push(message))
    harness.deliver(TO_PAGE_SAMPLES[ToPage.Notify])
    expect(harness.received).toEqual([TO_PAGE_SAMPLES[ToPage.Notify]])
    expect(others).toEqual([TO_PAGE_SAMPLES[ToPage.Notify]])
  })

  it.each(Object.values(ToPage).filter((type) => type !== ToPage.Boot))('accepts %s', (type) => {
    harness.attach()
    harness.deliver(TO_PAGE_SAMPLES[type])
    expect(harness.received).toEqual([TO_PAGE_SAMPLES[type]])
  })

  it('accepts a plain object without prototype', () => {
    harness.attach()
    harness.deliver(Object.assign(Object.create(null) as object, TO_PAGE_SAMPLES[ToPage.OpenRadial]))
    expect(harness.received).toEqual([{ ...TO_PAGE_SAMPLES[ToPage.OpenRadial] }])
  })

  it('strips a stray session token from a message other than boot', () => {
    harness.attach()
    harness.deliver({ ...TO_PAGE_SAMPLES[ToPage.Notify], [SESSION_TOKEN_KEY]: TOKEN })
    expect(harness.received).toEqual([TO_PAGE_SAMPLES[ToPage.Notify]])
    expect(Object.hasOwn(harness.received[0] ?? {}, SESSION_TOKEN_KEY)).toBe(false)
  })

  it('warns instead of throwing when a known message cannot be read', () => {
    harness.attach()
    const unreadable = Object.defineProperties({ type: ToPage.Notify, [SESSION_TOKEN_KEY]: TOKEN }, { notification: { enumerable: true, get: () => { throw new Error('accessor read') } } })
    expect(() => harness.deliver(unreadable)).not.toThrow()
    expect(harness.received).toEqual([])
    expect(harness.warnings[0]).toContain(HostWarning.MessageUnreadable)
  })

  it('keeps delivering to the other listeners when one throws, and warns', () => {
    harness.host.listen(() => {
      throw new Error('listener broke')
    })
    harness.attach()
    expect(() => harness.deliver(TO_PAGE_SAMPLES[ToPage.OpenRadial])).not.toThrow()
    expect(harness.received).toEqual([TO_PAGE_SAMPLES[ToPage.OpenRadial]])
    expect(harness.warnings).toHaveLength(1)
    expect(harness.warnings[0]).toContain(HostWarning.ListenerFailed)
  })
})

describe('boot', () => {
  it('hands boot to the store without the session token', () => {
    harness.attach()
    harness.boot(TOKEN)
    expect(harness.received).toEqual([TO_PAGE_SAMPLES[ToPage.Boot]])
    expect(Object.hasOwn(harness.received[0] ?? {}, SESSION_TOKEN_KEY)).toBe(false)
    expect(JSON.stringify(harness.received)).not.toContain(TOKEN)
  })

  it.each([1, SESSION_TOKEN_MAX_LENGTH])('accepts a token of %i units', (length) => {
    harness.attach()
    harness.boot(TOKEN_UNIT.repeat(length))
    expect(harness.received).toHaveLength(1)
  })

  const BAD_TOKENS: readonly (readonly [string, Record<string, unknown> | object])[] = [
    ['without token', TO_PAGE_SAMPLES[ToPage.Boot]],
    ['with an empty token', bootWith('')],
    ['with a token too long', bootWith(TOKEN_UNIT.repeat(SESSION_TOKEN_MAX_LENGTH + 1))],
    ['with a numeric token', bootWith(NUMERIC_TYPE)],
    ['with an object token', bootWith({ toString: () => TOKEN })],
    ['with a null token', bootWith(null)],
    ['with a token behind an accessor', Object.defineProperty({ ...TO_PAGE_SAMPLES[ToPage.Boot] }, SESSION_TOKEN_KEY, { enumerable: true, get: () => TOKEN })],
  ]

  it.each(BAD_TOKENS)('refuses a boot %s and warns once', (_label, data) => {
    harness.attach()
    expect(() => harness.deliver(data)).not.toThrow()
    harness.deliver(data)
    expect(harness.received).toEqual([])
    expect(harness.warnings).toHaveLength(1)
    expect(harness.warnings[0]).toContain(HostWarning.BootRefused)
  })

  it('never writes the token in a warning line', () => {
    harness.host.listen(() => {
      throw new Error(TOKEN)
    })
    harness.boot(TOKEN)
    harness.boot(TOKEN_UNIT.repeat(SESSION_TOKEN_MAX_LENGTH + 1))
    expect(harness.warnings.length).toBeGreaterThan(0)
    harness.warnings.forEach((line) => expect(line).not.toContain(TOKEN))
  })
})

describe('listening lifecycle', () => {
  it('stops delivering and detaches from the window once the last listener leaves', () => {
    const removed = vi.spyOn(window, 'removeEventListener')
    const stop = harness.attach()
    stop()
    stop()
    harness.deliver(TO_PAGE_SAMPLES[ToPage.OpenRadial])
    expect(harness.received).toEqual([])
    expect(removed).toHaveBeenCalledTimes(1)
  })

  it('keeps the window listener while another listener remains', () => {
    const stop = harness.attach()
    const later: unknown[] = []
    harness.host.listen((message) => void later.push(message))
    stop()
    harness.deliver(TO_PAGE_SAMPLES[ToPage.OpenRadial])
    expect(later).toEqual([TO_PAGE_SAMPLES[ToPage.OpenRadial]])
  })

  it('treats the same function listening twice as two registrations', () => {
    const seen: unknown[] = []
    const listener = (message: unknown): void => void seen.push(message)
    const stopFirst = harness.host.listen(listener)
    harness.host.listen(listener)
    stopFirst()
    harness.deliver(TO_PAGE_SAMPLES[ToPage.OpenRadial])
    expect(seen).toHaveLength(1)
  })
})
