import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { TEXT_MAX_LENGTH } from '@openmemorykit/ui/contract'
import { createSerializationFake, EmptyTableShape } from '@openmemorykit/core/testing'
import { CommandKind, DemoName, INTENT_COUNT_MAX, INTENT_COUNT_MIN, CLIENT_EVENT_SCHEMAS, SERVER_EVENT_SCHEMAS, NetEvent, netEventOf } from '../../../src/shared/net/net-events'
import type { ServerToClientCommand } from '../../../src/shared/net/net-events'
import { NET_COMMAND_SAMPLES } from '../../fixtures/net-commands'

const samples: readonly ServerToClientCommand[] = Object.values(NET_COMMAND_SAMPLES)
const FIRST_COMMAND_EVENT_KINDS: readonly CommandKind[] = [CommandKind.Snapshot, CommandKind.Demo, CommandKind.Intent, CommandKind.Close, CommandKind.Ask]
const UNKNOWN_KIND = 'teleport'
const SPEC_INTENT_COUNT_MAX = 50
const HALF = 0.5
const PROTOTYPE_NAMES = ['__proto__', 'constructor', 'toString', 'prototype']

const accepts = (event: NetEvent, payload: unknown): boolean => v.safeParse(CLIENT_EVENT_SCHEMAS[event], payload).success
const parseCommand = (command: ServerToClientCommand): boolean => accepts(netEventOf(command), command)
const withOwnKey = (command: ServerToClientCommand, key: string): unknown => JSON.parse(`{"${key}":{"polluted":true},${JSON.stringify(command).slice(1)}`)
const intentWithCount = (count: unknown): unknown => ({ ...NET_COMMAND_SAMPLES[CommandKind.Intent], count })

describe('net events', () => {
  it('names every event under the omk_ui prefix, each one once', () => {
    const names = Object.values(NetEvent)
    expect(new Set(names).size).toBe(names.length)
    expect(names.every((name) => name.startsWith('omk_ui:'))).toBe(true)
  })

  it('names the four events of 3.4 and D9, the seven command kinds and the eight demos of 7.3', () => {
    expect(Object.values(NetEvent)).toStrictEqual(['omk_ui:trace', 'omk_ui:report', 'omk_ui:notify', 'omk_ui:command'])
    expect(Object.values(CommandKind)).toStrictEqual(['trace', 'notify', 'snapshot', 'demo', 'intent', 'close', 'ask'])
    expect(Object.values(DemoName)).toStrictEqual(['radial', 'list', 'long-list', 'form', 'confirm', 'keyboard', 'toasts', 'prompt'])
  })

  it('has one sample per command kind', () => {
    expect(Object.keys(NET_COMMAND_SAMPLES).sort()).toStrictEqual(Object.values(CommandKind).sort())
  })

  it('routes trace and notify to their own event and the other kinds to omk_ui:command', () => {
    expect(netEventOf(NET_COMMAND_SAMPLES[CommandKind.Trace])).toBe(NetEvent.Trace)
    expect(netEventOf(NET_COMMAND_SAMPLES[CommandKind.Notify])).toBe(NetEvent.Notify)
    FIRST_COMMAND_EVENT_KINDS.forEach((kind) => expect(netEventOf(NET_COMMAND_SAMPLES[kind])).toBe(NetEvent.Command))
  })

  it.each(samples)('accepts the sample %o on its event', (command) => {
    expect(parseCommand(command)).toBe(true)
  })

  it.each(samples)('refuses %o on an event that is not its own', (command) => {
    const others = [NetEvent.Trace, NetEvent.Notify, NetEvent.Command].filter((event) => event !== netEventOf(command))
    others.forEach((event) => expect(accepts(event, command), event).toBe(false))
  })

  it.each(samples)('crosses the msgpack fake without loss: %o', (command) => {
    const crossed = createSerializationFake(EmptyTableShape.Object).cross(command)
    expect(crossed).toStrictEqual(command)
    expect(accepts(netEventOf(command), crossed)).toBe(true)
  })

  it.each(PROTOTYPE_NAMES)('refuses an own %s key at the root of every command', (key) => {
    samples.forEach((command) => expect(accepts(netEventOf(command), withOwnKey(command, key)), command.kind).toBe(false))
  })

  it('refuses an own __proto__ key inside the notification', () => {
    const payload: unknown = JSON.parse(`{"kind":"${CommandKind.Notify}","notification":{"__proto__":{"polluted":true},${JSON.stringify(NET_COMMAND_SAMPLES[CommandKind.Notify].notification).slice(1)}}`)
    expect(accepts(NetEvent.Notify, payload)).toBe(false)
  })

  it('refuses a payload nested deeper than any command, even under a key the schema would drop', () => {
    const notify = NET_COMMAND_SAMPLES[CommandKind.Notify]
    const nested = { ...notify, notification: { ...notify.notification, extra: { level: { deeper: {} } } } }
    expect(accepts(NetEvent.Notify, nested)).toBe(false)
  })

  it('refuses an unknown key at the root of every command', () => {
    samples.forEach((command) => expect(accepts(netEventOf(command), { ...command, extra: 1 }), command.kind).toBe(false))
  })

  it.each([NetEvent.Trace, NetEvent.Notify, NetEvent.Command])('refuses an unknown kind on %s', (event) => {
    expect(accepts(event, { kind: UNKNOWN_KIND })).toBe(false)
  })

  it.each([NetEvent.Trace, NetEvent.Notify, NetEvent.Command])('refuses a payload that is not an object on %s', (event) => {
    ;[null, undefined, 1, 'close', [], [CommandKind.Close]].forEach((payload) => expect(accepts(event, payload)).toBe(false))
  })

  it('bounds the intent count from 1 to 50', () => {
    expect([INTENT_COUNT_MIN, INTENT_COUNT_MAX]).toStrictEqual([1, SPEC_INTENT_COUNT_MAX])
    expect(accepts(NetEvent.Command, intentWithCount(INTENT_COUNT_MIN))).toBe(true)
    expect(accepts(NetEvent.Command, intentWithCount(INTENT_COUNT_MAX))).toBe(true)
    ;[INTENT_COUNT_MIN - 1, INTENT_COUNT_MAX + 1, 1 + HALF, Number.NaN, Number.POSITIVE_INFINITY, '5'].forEach((count) => expect(accepts(NetEvent.Command, intentWithCount(count)), String(count)).toBe(false))
  })

  it('refuses an unknown intent or demo name', () => {
    expect(accepts(NetEvent.Command, { ...NET_COMMAND_SAMPLES[CommandKind.Intent], intent: 'jump' })).toBe(false)
    expect(accepts(NetEvent.Command, { kind: CommandKind.Demo, demo: 'longList' })).toBe(false)
  })

  it('accepts every demo name in kebab-case', () => {
    Object.values(DemoName).forEach((demo) => {
      expect(demo).toMatch(/^[a-z]+(-[a-z]+)*$/)
      expect(accepts(NetEvent.Command, { kind: CommandKind.Demo, demo })).toBe(true)
    })
  })

  it('refuses a negative, fractional or unsafe request or ask identifier', () => {
    ;[-1, HALF, Number.MAX_SAFE_INTEGER + 1, '7'].forEach((identifier) => {
      expect(accepts(NetEvent.Command, { kind: CommandKind.Snapshot, requestId: identifier })).toBe(false)
      expect(accepts(NetEvent.Command, { ...NET_COMMAND_SAMPLES[CommandKind.Ask], askId: identifier })).toBe(false)
    })
  })

  it('bounds the ask text between one character and the contract text limit', () => {
    const ask = NET_COMMAND_SAMPLES[CommandKind.Ask]
    expect(accepts(NetEvent.Command, { ...ask, text: 'a'.repeat(TEXT_MAX_LENGTH) })).toBe(true)
    expect(accepts(NetEvent.Command, { ...ask, text: 'a'.repeat(TEXT_MAX_LENGTH + 1) })).toBe(false)
    expect(accepts(NetEvent.Command, { ...ask, text: '' })).toBe(false)
  })

  it('refuses a notification that breaks the contract', () => {
    const notify = NET_COMMAND_SAMPLES[CommandKind.Notify]
    expect(accepts(NetEvent.Notify, { ...notify, notification: { ...notify.notification, tone: 'loud' } })).toBe(false)
    expect(accepts(NetEvent.Trace, { kind: CommandKind.Trace, active: 'yes' })).toBe(false)
  })

  it('leaves the report out of the schemas the server listens with: it reads it raw, with ReportIntake then readReport', () => {
    expect(Object.keys(SERVER_EVENT_SCHEMAS)).toStrictEqual([NetEvent.Trace, NetEvent.Notify, NetEvent.Command])
    expect(Object.keys(SERVER_EVENT_SCHEMAS)).not.toContain(NetEvent.Report)
  })

  it('keeps the report in the schemas of the client, which only emits it, and leaves it open', () => {
    expect(Object.keys(CLIENT_EVENT_SCHEMAS)).toStrictEqual([NetEvent.Trace, NetEvent.Notify, NetEvent.Command, NetEvent.Report])
    ;[null, { kind: UNKNOWN_KIND }, JSON.parse('{"__proto__":1}') as unknown].forEach((payload) => expect(accepts(NetEvent.Report, payload)).toBe(true))
  })
})
