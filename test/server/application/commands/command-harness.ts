import { runSubcommand } from '../../../../src/server/application/commands/run-subcommand'
import type { OmkSubcommand } from '../../../../src/server/application/omk-subcommand'
import type { ServerHarness } from '../server-harness'

export { AFTER_TIMEOUT_MS, createServerHarness, LOG_PREFIX, OTHER_PLAYER, PLAYER } from '../server-harness'

export function run(harness: ServerHarness, subcommand: OmkSubcommand, ...args: string[]): readonly string[] {
  const lines: string[] = []
  runSubcommand(harness.context, subcommand, args, (line) => lines.push(line))
  return lines
}
