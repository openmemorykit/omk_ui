import { CommandKind } from '../../../shared/net/net-events'
import { OmkSubcommand } from '../omk-subcommand'
import { ALL_CLIENTS } from '../ports'
import type { ServerContext } from '../server-context'
import { isPlayerId, resolvePlayer, usageLines, type SubcommandHandler } from './command-arguments'

const TraceSwitch = { On: 'on', Off: 'off' } as const
const EVERYBODY = 'all'
const SWITCH_STATES = new Map<string, boolean>([
  [TraceSwitch.On, true],
  [TraceSwitch.Off, false],
])
const MAX_ARGUMENTS = 2

function applyTrace(context: ServerContext, active: boolean, player: number | null): string {
  const { traces, ports, log } = context
  if (player === null) {
    if (active) traces.activateAll()
    else traces.deactivateAll()
  } else if (active) traces.activate(player)
  else traces.deactivate(player)
  ports.clients.send(player ?? ALL_CLIENTS, { kind: CommandKind.Trace, active })
  const target = player === null ? log.translate('log.trace.allPlayers') : String(player)
  return log.translate('log.command.trace', { state: log.translate(active ? 'log.word.on' : 'log.word.off'), target })
}

export const traceCommand: SubcommandHandler = (context, args) => {
  const [switchName = '', rawTarget = EVERYBODY] = args
  const active = SWITCH_STATES.get(switchName)
  const isEverybody = rawTarget === EVERYBODY
  if (active === undefined || args.length > MAX_ARGUMENTS || (!isEverybody && !isPlayerId(rawTarget))) return usageLines(context, OmkSubcommand.Trace)
  if (isEverybody) return [applyTrace(context, active, null)]
  const target = resolvePlayer(context, OmkSubcommand.Trace, rawTarget)
  return target.player === undefined ? target.refusal : [applyTrace(context, active, target.player)]
}
