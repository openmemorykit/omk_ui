import type { NativeRecorder } from '@openmemorykit/core/testing'
import { installNatives } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OmkSubcommand } from '../../../src/server/application/omk-subcommand'
import { ADMIN_PERMISSION, KIT_COMMAND_NAME, KitCommandOperation, registerKitCommand, type CommandReply, type KitCommandHandlers } from '../../../src/server/infrastructure/kit-command'

const CONSOLE = 0
const ADMIN = 3
const PLAYER = 4
const REPLY_LINE = '[omk_ui] kit 1.0.0'
const CHAT_EVENT = 'chat:addMessage'
const BOGUS = 'bogus'

type CommandHandler = (source: number, args: string[]) => void

interface Ran {
  readonly subcommand: OmkSubcommand
  readonly args: readonly string[]
}

interface CommandHarness {
  readonly recorder: NativeRecorder
  readonly ran: Ran[]
  readonly unknown: string[]
  readonly denied: number[]
  readonly failures: unknown[][]
  type(source: number, args: string[]): void
}

let restore: (() => void) | null = null

function installCommand(aceAllowed: boolean, overrides: Partial<KitCommandHandlers> = {}, natives: Readonly<Record<string, (...args: never[]) => unknown>> = {}): CommandHarness {
  let registered: CommandHandler | null = null
  const recorder = installNatives({
    RegisterCommand: (_name: string, handler: CommandHandler) => {
      registered = handler
    },
    IsPlayerAceAllowed: () => aceAllowed,
    TriggerClientEvent: () => undefined,
    ...natives,
  })
  restore = () => recorder.restore()
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  const harness: CommandHarness = {
    recorder,
    ran: [],
    unknown: [],
    denied: [],
    failures: [],
    type: (source, args) => registered?.(source, args),
  }
  registerKitCommand({
    run: (subcommand, args) => harness.ran.push({ subcommand, args }),
    unknownSubcommand: (name) => harness.unknown.push(name),
    denied: (source) => harness.denied.push(source),
    ...overrides,
  }, (operation, failure) => harness.failures.push([operation, failure]))
  return harness
}

afterEach(() => {
  restore?.()
  restore = null
  vi.restoreAllMocks()
})

describe('kit command omk_ui', () => {
  it('registers the omk_ui command unrestricted: the ACE check is the kit\'s own', () => {
    const { recorder } = installCommand(true)
    expect(recorder.callsOf('RegisterCommand')).toStrictEqual([[KIT_COMMAND_NAME, expect.any(Function), false]])
  })

  it('runs a subcommand typed at the server console without asking for an ACE', () => {
    const harness = installCommand(false)
    harness.type(CONSOLE, [OmkSubcommand.Trace, 'on', 'all'])
    expect(harness.ran).toStrictEqual([{ subcommand: OmkSubcommand.Trace, args: ['on', 'all'] }])
    expect(harness.recorder.callsOf('IsPlayerAceAllowed')).toStrictEqual([])
  })

  it('runs a subcommand typed in game by a player holding the ACE omk_ui.admin', () => {
    const harness = installCommand(true)
    harness.type(ADMIN, [OmkSubcommand.Version])
    expect(harness.recorder.callsOf('IsPlayerAceAllowed')).toStrictEqual([[String(ADMIN), ADMIN_PERMISSION]])
    expect(harness.ran).toStrictEqual([{ subcommand: OmkSubcommand.Version, args: [] }])
  })

  it('calls onDenied when the ACE is refused, and runs nothing', () => {
    const harness = installCommand(false)
    harness.type(PLAYER, [OmkSubcommand.Close, String(PLAYER)])
    expect(harness.denied).toStrictEqual([PLAYER])
    expect(harness.ran).toStrictEqual([])
  })

  it('hands an unknown or missing subcommand name to the usage handler', () => {
    const harness = installCommand(true)
    harness.type(CONSOLE, [BOGUS, 'x'])
    harness.type(CONSOLE, [])
    expect(harness.unknown).toStrictEqual([BOGUS, ''])
    expect(harness.ran).toStrictEqual([])
  })

  it('replies on the server console, and in the chat of the player who typed it', () => {
    const reply: { current: CommandReply | null } = { current: null }
    const harness = installCommand(true, {
      run: (_subcommand, _args, given) => {
        reply.current = given
      },
    })
    harness.type(ADMIN, [OmkSubcommand.Version])
    reply.current?.(REPLY_LINE)
    expect(console.log).toHaveBeenCalledWith(REPLY_LINE)
    expect(harness.recorder.callsOf('TriggerClientEvent')).toStrictEqual([[CHAT_EVENT, ADMIN, { args: [REPLY_LINE] }]])
  })

  it('keeps a failing subcommand inside the command handler and reports it', () => {
    const failure = new Error('subcommand failed')
    const harness = installCommand(true, {
      run: () => {
        throw failure
      },
    })
    expect(() => harness.type(CONSOLE, [OmkSubcommand.Config])).not.toThrow()
    expect(harness.failures).toStrictEqual([['omk_ui config', failure]])
  })

  it('keeps a failing usage or denial handler inside the command handler', () => {
    const harness = installCommand(false, {
      unknownSubcommand: () => {
        throw new Error('usage failed')
      },
      denied: () => {
        throw new Error('denial failed')
      },
    })
    expect(() => harness.type(CONSOLE, [BOGUS])).not.toThrow()
    expect(() => harness.type(PLAYER, [OmkSubcommand.Version])).not.toThrow()
    expect(harness.failures.map(([operation]) => operation)).toStrictEqual([KitCommandOperation.Usage, KitCommandOperation.Denied])
  })

  it('keeps a late reply that fails (the player left) from breaking whoever calls it', () => {
    const failure = new Error('player gone')
    const reply: { current: CommandReply | null } = { current: null }
    const harness = installCommand(true, {
      run: (_subcommand, _args, given) => {
        reply.current = given
      },
    }, {
      TriggerClientEvent: () => {
        throw failure
      },
    })
    harness.type(ADMIN, [OmkSubcommand.Debug, String(PLAYER)])
    expect(() => reply.current?.(REPLY_LINE)).not.toThrow()
    expect(harness.failures).toStrictEqual([[KitCommandOperation.Reply, failure]])
  })

  it('survives a failure handler that fails too', () => {
    let registered: CommandHandler | null = null
    const recorder = installNatives({
      RegisterCommand: (_name: string, handler: CommandHandler) => {
        registered = handler
      },
      IsPlayerAceAllowed: () => true,
    })
    restore = () => recorder.restore()
    registerKitCommand({
      run: () => {
        throw new Error('subcommand failed')
      },
      unknownSubcommand: () => undefined,
      denied: () => undefined,
    }, () => {
      throw new Error('journal failed')
    })
    expect(() => registered?.(CONSOLE, [OmkSubcommand.Config])).not.toThrow()
  })
})
