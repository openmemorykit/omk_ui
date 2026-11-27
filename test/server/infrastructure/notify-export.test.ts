import { createExportsFake, createSerializationFake, EmptyTableShape, installNatives, type ExportsFake, type NativeRecorder } from '@openmemorykit/core/testing'
import { CALL_DONE, CallStatus, ContractErrorCode, NotificationTone, type CallResult } from '@openmemorykit/ui/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ALL_CLIENTS } from '../../../src/server/application/ports'
import { notifyFromResource } from '../../../src/server/application/server-notify'
import { CommandKind } from '../../../src/shared/net/net-events'
import { NOTIFY_EXPORT_NAME, registerNotifyExport } from '../../../src/server/infrastructure/notify-export'
import { KIT_RESOURCE_NAME } from '../../../src/server/infrastructure/resource-name'
import { createServerHarness, PLAYER } from '../application/server-harness'

const CALLER = 'garage'
const NOTIFICATION = { version: 1, tone: NotificationTone.Info, title: 'Bienvenue' }
const NOT_A_NUMBER_TARGET = '2'

interface Notified {
  readonly target: number
  readonly notification: unknown
  readonly caller: string | null
}

let recorder: NativeRecorder | null = null

function installExport(invoker: unknown, notify: (target: number, notification: unknown, caller: string | null) => CallResult, failures: unknown[] = []): ExportsFake {
  recorder = installNatives({ GetInvokingResource: () => invoker })
  const fake = createExportsFake(createSerializationFake(EmptyTableShape.List), KIT_RESOURCE_NAME)
  vi.stubGlobal('exports', fake.exports)
  registerNotifyExport(notify, (error) => failures.push(error))
  return fake
}

function callNotify(fake: ExportsFake, target: unknown, notification: unknown): unknown {
  return fake.exports[KIT_RESOURCE_NAME]?.[NOTIFY_EXPORT_NAME]?.(target, notification)
}

afterEach(() => {
  recorder?.restore()
  recorder = null
  vi.unstubAllGlobals()
})

describe('server export notify', () => {
  it('takes GetInvokingResource as the caller of the export, read inside the call', () => {
    const notified: Notified[] = []
    const fake = installExport(CALLER, (target, notification, caller) => {
      notified.push({ target, notification, caller })
      return CALL_DONE
    })
    expect(recorder?.callsOf('GetInvokingResource')).toStrictEqual([])
    expect(callNotify(fake, PLAYER, NOTIFICATION)).toStrictEqual(CALL_DONE)
    expect(notified).toStrictEqual([{ target: PLAYER, notification: NOTIFICATION, caller: CALLER }])
  })

  it.each([null, undefined, ''])('passes a null caller when GetInvokingResource gives %s', (invoker) => {
    const notified: Notified[] = []
    const fake = installExport(invoker, (target, notification, caller) => {
      notified.push({ target, notification, caller })
      return CALL_DONE
    })
    callNotify(fake, ALL_CLIENTS, NOTIFICATION)
    expect(notified.map((entry) => entry.caller)).toStrictEqual([null])
  })

  it('accepts notify called by another server resource, journals the caller and relays the notification', () => {
    const { ports, context } = createServerHarness()
    const fake = installExport(CALLER, (target, notification, caller) => notifyFromResource(context, target, notification, caller))
    expect(callNotify(fake, PLAYER, NOTIFICATION)).toStrictEqual(CALL_DONE)
    expect(ports.console.lines.some((line) => line.includes(CALLER))).toBe(true)
    expect(ports.clients.sent).toStrictEqual([{ target: PLAYER, command: { kind: CommandKind.Notify, notification: NOTIFICATION } }])
  })

  it('hands a target that is not a number as an unknown target, which the application refuses', () => {
    const { ports, context } = createServerHarness()
    const fake = installExport(CALLER, (target, notification, caller) => notifyFromResource(context, target, notification, caller))
    const result = callNotify(fake, NOT_A_NUMBER_TARGET, NOTIFICATION)
    expect(result).toStrictEqual({ status: CallStatus.Refused, errors: [{ path: 'target', code: ContractErrorCode.UnknownValue }] })
    expect(ports.clients.sent).toStrictEqual([])
  })

  it('returns a refusal and reports the failure when the handler fails, without throwing to the caller', () => {
    const failure = new Error('notify failed')
    const failures: unknown[] = []
    const fake = installExport(CALLER, () => {
      throw failure
    }, failures)
    expect(callNotify(fake, PLAYER, NOTIFICATION)).toStrictEqual({ status: CallStatus.Refused, errors: [] })
    expect(failures).toStrictEqual([failure])
  })
})
