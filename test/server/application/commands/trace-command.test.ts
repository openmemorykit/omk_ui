import { describe, expect, it } from 'vitest'
import { OmkSubcommand } from '../../../../src/server/application/omk-subcommand'
import { ALL_CLIENTS } from '../../../../src/server/application/ports'
import { CommandKind } from '../../../../src/shared/net/net-events'
import { createServerHarness, LOG_PREFIX, OTHER_PLAYER, PLAYER, run } from './command-harness'

const USAGE = `${LOG_PREFIX} omk_ui trace on|off [id|all]`

describe('omk_ui trace', () => {
  it('turns the journal on for everybody, by default, and tells every client', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Trace, 'on')).toStrictEqual([`${LOG_PREFIX} Journal activé pour tous les joueurs`])
    expect(harness.context.traces.isEveryoneTraced).toBe(true)
    expect(harness.ports.clients.sent).toStrictEqual([{ target: ALL_CLIENTS, command: { kind: CommandKind.Trace, active: true } }])
  })

  it('turns it on for one player only', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Trace, 'on', String(PLAYER))).toStrictEqual([`${LOG_PREFIX} Journal activé pour ${PLAYER}`])
    expect([harness.context.traces.isActive(PLAYER), harness.context.traces.isActive(OTHER_PLAYER)]).toStrictEqual([true, false])
    expect(harness.ports.clients.sent).toStrictEqual([{ target: PLAYER, command: { kind: CommandKind.Trace, active: true } }])
  })

  it('turns it off for one player, then for everybody', () => {
    const harness = createServerHarness()
    run(harness, OmkSubcommand.Trace, 'on', 'all')
    expect(run(harness, OmkSubcommand.Trace, 'off', String(PLAYER))).toStrictEqual([`${LOG_PREFIX} Journal coupé pour ${PLAYER}`])
    expect(harness.context.traces.isActive(PLAYER)).toBe(false)
    expect(run(harness, OmkSubcommand.Trace, 'off', 'all')).toStrictEqual([`${LOG_PREFIX} Journal coupé pour tous les joueurs`])
    expect(harness.context.traces.isEveryoneTraced).toBe(false)
    expect(harness.ports.clients.sent.at(-1)).toStrictEqual({ target: ALL_CLIENTS, command: { kind: CommandKind.Trace, active: false } })
  })

  it('names a player who is not there and changes nothing', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Trace, 'on', '99')).toStrictEqual([`${LOG_PREFIX} Joueur 99 introuvable`])
    expect(harness.ports.clients.sent).toStrictEqual([])
  })

  it.each([[[]], [['maybe']], [['on', 'someone']], [['on', '2x']], [['on', '-1']], [['on', '2', 'extra']]])('shows the usage for %j', (args) => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Trace, ...args)).toStrictEqual([USAGE])
    expect(harness.ports.clients.sent).toStrictEqual([])
  })
})
