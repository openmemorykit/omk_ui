import { describe, expect, it } from 'vitest'
import { OmkSubcommand } from '../../../../src/server/application/omk-subcommand'
import { parseSubcommand, unknownSubcommandLines } from '../../../../src/server/application/commands/run-subcommand'
import { AFTER_TIMEOUT_MS, createServerHarness, LOG_PREFIX, PLAYER, run } from './command-harness'

const VERY_LONG_NAME = 500
const MAX_LINE_LENGTH = 250

describe('subcommand dispatch', () => {
  it.each(Object.values(OmkSubcommand))('reads %s', (name) => {
    expect(parseSubcommand(name)).toBe(name)
  })

  it.each(['', 'Version', 'toString', '__proto__', 'constructor', 'hasOwnProperty'])('does not read "%s"', (name) => {
    expect(parseSubcommand(name)).toBeNull()
  })

  it('lists the subcommands when one is unknown', () => {
    const { context } = createServerHarness()
    expect(unknownSubcommandLines(context, 'dance')).toStrictEqual([
      `${LOG_PREFIX} Sous-commande inconnue : dance · sous-commandes : ${Object.values(OmkSubcommand).join(', ')}`,
    ])
  })

  it('cuts a very long unknown name', () => {
    const { context } = createServerHarness()
    expect(unknownSubcommandLines(context, 'x'.repeat(VERY_LONG_NAME))[0]?.length).toBeLessThan(MAX_LINE_LENGTH)
  })

  it('writes the "no answer" of a request that timed out before running the subcommand', () => {
    const harness = createServerHarness()
    const first = run(harness, OmkSubcommand.Debug, String(PLAYER))
    harness.ports.clock.advance(AFTER_TIMEOUT_MS)
    run(harness, OmkSubcommand.Version)
    expect(first).toContain(`${LOG_PREFIX} Pas de réponse de joueur ${PLAYER} sous 3 s`)
  })
})
