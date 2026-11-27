import { CallStatus, ContractErrorCode, NotificationTone } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { ALL_CLIENTS } from '../../../src/server/application/ports'
import { notifyFromResource, relayNotification } from '../../../src/server/application/server-notify'
import { CommandKind } from '../../../src/shared/net/net-events'
import { PRINTABLE_MAX_LENGTH } from '../../../src/server/application/server-log'
import { ABSENT_PLAYER, createServerHarness, LOG_PREFIX, OTHER_PLAYER, PLAYER } from './server-harness'

const NOTIFICATION = { version: 1, tone: NotificationTone.Info, title: 'Bienvenue' }
const VERY_LONG_NAME = 500
const MAX_LINE_LENGTH = 150
const NOT_AN_INTEGER = 1.5
const JOURNAL = `${LOG_PREFIX} 01:00.000 · `

describe('server notify: relay', () => {
  it('sends a valid notification to one connected player', () => {
    const { ports, context } = createServerHarness()
    expect(relayNotification(context, PLAYER, NOTIFICATION)).toStrictEqual({ status: CallStatus.Done })
    expect(ports.clients.sent).toStrictEqual([{ target: PLAYER, command: { kind: CommandKind.Notify, notification: NOTIFICATION } }])
  })

  it('sends it to everybody with -1', () => {
    const { ports, context } = createServerHarness()
    relayNotification(context, ALL_CLIENTS, NOTIFICATION)
    expect(ports.clients.sent.map((entry) => entry.target)).toStrictEqual([ALL_CLIENTS])
  })

  it.each([ABSENT_PLAYER, 0, ALL_CLIENTS - 1, NOT_AN_INTEGER, Number.NaN, String(PLAYER), null])('refuses the target %s, which is not -1 or a connected player', (target) => {
    const { ports, context } = createServerHarness()
    const result = relayNotification(context, target, NOTIFICATION)
    expect(result).toStrictEqual({ status: CallStatus.Refused, errors: [{ path: 'target', code: ContractErrorCode.UnknownValue }] })
    expect(ports.clients.sent).toStrictEqual([])
  })

  it('refuses a notification that breaks the contract, with the errors of the contract', () => {
    const { ports, context } = createServerHarness()
    const result = relayNotification(context, PLAYER, { ...NOTIFICATION, tone: 'loud' })
    expect(result.status).toBe(CallStatus.Refused)
    expect(result.status === CallStatus.Refused ? result.errors.map((error) => error.path) : []).toStrictEqual(['tone'])
    expect(ports.clients.sent).toStrictEqual([])
  })

  it('refuses a notification that is not an object, and one with a function', () => {
    const { context } = createServerHarness()
    expect(relayNotification(context, PLAYER, 'hello').status).toBe(CallStatus.Refused)
    expect(relayNotification(context, PLAYER, { ...NOTIFICATION, title: () => 'x' }).status).toBe(CallStatus.Refused)
  })

  it('does not send what the contract did not keep', () => {
    const { ports, context } = createServerHarness()
    relayNotification(context, PLAYER, { ...NOTIFICATION, colour: 'red' })
    expect(JSON.stringify(ports.clients.sent)).not.toContain('colour')
  })
})

describe('server notify: call by another resource', () => {
  it('accepts the call of a server resource and writes who called, to whom', () => {
    const { ports, context } = createServerHarness()
    expect(notifyFromResource(context, OTHER_PLAYER, NOTIFICATION, 'garage')).toStrictEqual({ status: CallStatus.Done })
    expect(ports.clients.sentTo(OTHER_PLAYER)).toHaveLength(1)
    expect(ports.console.lines).toStrictEqual([`${JOURNAL}notify appelé par garage vers ${OTHER_PLAYER}`])
  })

  it('writes the call of everybody as "all players"', () => {
    const { ports, context } = createServerHarness()
    notifyFromResource(context, ALL_CLIENTS, NOTIFICATION, 'garage')
    expect(ports.console.lines).toStrictEqual([`${JOURNAL}notify appelé par garage vers tous les joueurs`])
  })

  it('writes a call that is refused with the codes, and still answers the caller', () => {
    const { ports, context } = createServerHarness()
    const result = notifyFromResource(context, PLAYER, { ...NOTIFICATION, tone: 'loud' }, 'garage')
    expect(result.status).toBe(CallStatus.Refused)
    expect(ports.console.lines).toStrictEqual([`${JOURNAL}notify de garage vers ${PLAYER} refusé : tone`])
  })

  it('writes a caller the engine could not name', () => {
    const { ports, context } = createServerHarness()
    notifyFromResource(context, PLAYER, NOTIFICATION, null)
    expect(ports.console.lines).toStrictEqual([`${JOURNAL}notify appelé par inconnu vers ${PLAYER}`])
  })

  it('never refuses the caller itself, whoever it is, and cuts a very long name', () => {
    const { ports, context } = createServerHarness()
    const result = notifyFromResource(context, PLAYER, NOTIFICATION, 'x'.repeat(VERY_LONG_NAME))
    expect(result.status).toBe(CallStatus.Done)
    expect(ports.console.lines[0]?.length).toBeLessThan(MAX_LINE_LENGTH)
  })
})

describe('server notify: target in the journal', () => {
  it('cuts and neutralises a target that is a long hostile string', () => {
    const { ports, context } = createServerHarness()
    notifyFromResource(context, `a\n${LOG_PREFIX} fake ${'b'.repeat(VERY_LONG_NAME)}`, NOTIFICATION, 'garage')
    expect(ports.console.lines).toHaveLength(1)
    expect(ports.console.lines[0]?.length).toBeLessThan(MAX_LINE_LENGTH + PRINTABLE_MAX_LENGTH)
  })
})
