import { describe, expect, expectTypeOf, it } from 'vitest'
import { FromPage, PAGE_ERROR_STACK_MAX_BYTES } from '../../src/protocol/from-page'
import type { FromPageMessage, FromPageMessageOf } from '../../src/protocol/from-page'
import type { OwnedConfirm, OwnedPrompt } from '../../src/protocol/owned'
import type { UiMode } from '../../src/protocol/page-vocabulary'
import { ToPage } from '../../src/protocol/to-page'
import type { ToPageMessage, ToPageMessageOf } from '../../src/protocol/to-page'
import type { JsonObject } from '../../src/shared/report/json-value'
import { EMPTY_STACK_EVENT, ESCAPE_HELD_MODE_CHANGED, FROM_PAGE_SAMPLES, TO_PAGE_SAMPLES } from '../fixtures/messages'

const KILOBYTE = 1024

const throughJson = <Message>(message: Message): Message => JSON.parse(JSON.stringify(message)) as Message
const hasOwn = (target: object, key: string): boolean => Object.prototype.hasOwnProperty.call(target, key)
const toPageSamples: readonly ToPageMessage[] = Object.values(TO_PAGE_SAMPLES)
const fromPageSamples: readonly FromPageMessage[] = Object.values(FROM_PAGE_SAMPLES)

describe('message types', () => {
  it('keeps every value of ToPage and FromPage distinct from all the others', () => {
    const values = [...Object.values(ToPage), ...Object.values(FromPage)]
    expect(new Set(values).size).toBe(values.length)
  })

  it('has one sample of each type, under its own type', () => {
    expect(Object.keys(TO_PAGE_SAMPLES).sort()).toStrictEqual(Object.values(ToPage).sort())
    expect(Object.keys(FROM_PAGE_SAMPLES).sort()).toStrictEqual(Object.values(FromPage).sort())
    Object.entries(TO_PAGE_SAMPLES).forEach(([type, message]) => expect(message.type).toBe(type))
    Object.entries(FROM_PAGE_SAMPLES).forEach(([type, message]) => expect(message.type).toBe(type))
  })

  it('discriminates each union on type', () => {
    expectTypeOf<ToPageMessage['type']>().toEqualTypeOf<ToPage>()
    expectTypeOf<FromPageMessage['type']>().toEqualTypeOf<FromPage>()
    expectTypeOf<ToPageMessageOf<typeof ToPage.Boot>['confirm']>().toEqualTypeOf<OwnedConfirm | null>()
    expectTypeOf<ToPageMessageOf<typeof ToPage.Boot>['prompt']>().toEqualTypeOf<OwnedPrompt | null>()
    expectTypeOf<FromPageMessageOf<typeof FromPage.Trace>['data']>().toEqualTypeOf<JsonObject>()
    expectTypeOf<FromPageMessageOf<typeof FromPage.ModeChanged>['escapeHeld']>().toEqualTypeOf<true | undefined>()
  })

  it('refuses a message with a missing field, a foreign field or a false escapeHeld', () => {
    expectTypeOf<{ readonly type: typeof ToPage.Stick; readonly x: number }>().not.toExtend<ToPageMessage>()
    expectTypeOf<{ readonly type: typeof ToPage.Stick; readonly x: number; readonly y: number }>().toExtend<ToPageMessage>()
    expectTypeOf<{ readonly type: typeof FromPage.Ack; readonly seq: number }>().not.toExtend<FromPageMessage>()
    expectTypeOf<{ readonly type: typeof FromPage.ModeChanged; readonly mode: typeof UiMode.Idle; readonly escapeHeld: false }>().not.toExtend<FromPageMessage>()
  })

  it('bounds the page error stack to one kilobyte', () => {
    expect(PAGE_ERROR_STACK_MAX_BYTES).toBe(KILOBYTE)
  })
})

describe('round trip through JSON', () => {
  it.each(toPageSamples.map((message) => [message.type, message]))('keeps the %s message whole', (_type, message) => {
    expect(throughJson(message)).toStrictEqual(message)
  })

  it.each(fromPageSamples.map((message) => [message.type, message]))('keeps the %s answer whole', (_type, message) => {
    expect(throughJson(message)).toStrictEqual(message)
  })

  it('keeps an absent escapeHeld absent, neither undefined nor null', () => {
    const parsed = throughJson(FROM_PAGE_SAMPLES[FromPage.ModeChanged])
    expect(hasOwn(parsed, 'escapeHeld')).toBe(false)
    expect(throughJson(ESCAPE_HELD_MODE_CHANGED).escapeHeld).toBe(true)
  })

  it('keeps the null confirm and prompt of Boot null', () => {
    const parsed = throughJson(TO_PAGE_SAMPLES[ToPage.Boot])
    expect(hasOwn(parsed, 'confirm') && parsed.confirm === null).toBe(true)
    expect(hasOwn(parsed, 'prompt') && parsed.prompt === null).toBe(true)
  })

  it('keeps an empty data an object', () => {
    const parsed = throughJson(FROM_PAGE_SAMPLES[FromPage.Trace])
    expect(parsed.data).toStrictEqual({})
    expect(Array.isArray(parsed.data)).toBe(false)
  })

  it('keeps a null stack and empty replies of an Event', () => {
    expect(throughJson(EMPTY_STACK_EVENT)).toStrictEqual({ type: FromPage.Event, event: { stack: null, replies: [] } })
  })
})
