import { OmkSubcommand } from '../omk-subcommand'
import type { SubcommandHandler } from './command-arguments'
import { debugLines } from './debug-lines'
import { requestSnapshot } from './request-snapshot'

export const debugCommand: SubcommandHandler = (context, args, reply) =>
  requestSnapshot(context, OmkSubcommand.Debug, args, reply, (player) => (snapshot) => debugLines(context, player, snapshot))
