import { describe, expect, it } from 'vitest'
import { OmkSubcommand } from '../../../src/server/application/omk-subcommand'

describe('omk_ui subcommands', () => {
  it('lists the commands of 7.3 plus ask, each under its own lowercase word', () => {
    const words = Object.values(OmkSubcommand)
    expect(words).toStrictEqual(['version', 'config', 'trace', 'debug', 'owners', 'demo', 'intent', 'notify', 'close', 'ask'])
    expect(new Set(words).size).toBe(words.length)
  })
})
