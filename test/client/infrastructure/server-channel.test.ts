import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { RejectionReason, type RejectedEvent } from '@openmemorykit/core/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { createServerLink } from '../../../src/client/infrastructure/server-channel'
import { CommandKind, NetEvent } from '../../../src/shared/net/net-events'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { NET_COMMAND_SAMPLES } from '../../fixtures/net-commands'

type Handler = (payload: unknown) => void

let natives: NativeRecorder | null = null
let invoking = ''
const netHandlers = new Map<string, Handler>()
const rejected: RejectedEvent[] = []
const failures: unknown[][] = []

afterEach(() => {
  natives?.restore()
  natives = null
  invoking = ''
  netHandlers.clear()
  rejected.length = 0
  failures.length = 0
})

function setUp(overrides: Readonly<Record<string, (...args: never[]) => unknown>> = {}): ReturnType<typeof createServerLink> {
  natives = installNatives({
    GetInvokingResource: () => invoking,
    on: () => undefined,
    onNet: (name: string, handler: Handler) => { netHandlers.set(name, handler) },
    emit: () => undefined,
    emitNet: () => undefined,
    removeEventListener: () => undefined,
    ...overrides,
  })
  return createServerLink((event) => rejected.push(event), (operation, cause) => failures.push([operation, cause]))
}

describe('createServerLink', () => {
  it('sends a report to the server on the omk_ui:report event', () => {
    const link = setUp()
    const envelope = { kind: ReportKind.PageError, at: 5, data: { message: 'x', stack: 'y' } } as never
    link.channel.report(envelope)
    expect(natives?.callsOf('emitNet')).toEqual([[NetEvent.Report, envelope]])
  })

  it('reports a failing emitNet and lets nothing escape', () => {
    const link = setUp({ emitNet: () => { throw new Error('boom') } })
    link.channel.report({ kind: ReportKind.PageError, at: 5, data: {} } as never)
    expect(failures.map(([operation]) => operation)).toEqual(['emitNet omk_ui:report'])
  })

  it.each([
    [NetEvent.Notify, NET_COMMAND_SAMPLES[CommandKind.Notify]],
    [NetEvent.Command, NET_COMMAND_SAMPLES[CommandKind.Snapshot]],
  ])('hands %s from the server to its listener', (name, command) => {
    const link = setUp()
    const received: unknown[] = []
    link.events.onFromServer(name, (payload) => received.push(payload))
    netHandlers.get(name)?.(command)
    expect(received).toEqual([command])
    expect(rejected).toEqual([])
  })

  it.each([
    [NetEvent.Notify, NET_COMMAND_SAMPLES[CommandKind.Notify]],
    [NetEvent.Command, NET_COMMAND_SAMPLES[CommandKind.Close]],
    [NetEvent.Trace, NET_COMMAND_SAMPLES[CommandKind.Trace]],
  ])('sends %s triggered locally to the rejection handler, not to its listener', (name, command) => {
    const link = setUp()
    const received: unknown[] = []
    link.events.onFromServer(name, (payload) => received.push(payload))
    invoking = 'evil_resource'
    netHandlers.get(name)?.(command)
    expect(received).toEqual([])
    expect(rejected).toEqual([{ name, source: null, paths: [''], reason: RejectionReason.Source }])
  })

  it('sends a malformed payload from the server to the same rejection handler', () => {
    const link = setUp()
    link.events.onFromServer(NetEvent.Command, () => undefined)
    netHandlers.get(NetEvent.Command)?.({ kind: 'nothing' })
    expect(rejected.map((event) => event.reason)).toEqual([RejectionReason.Shape])
  })
})
