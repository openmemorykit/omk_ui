import { CONFIRMS_PER_OWNER, PROMPTS_PER_OWNER, RADIAL_ENTRIES_PER_OWNER } from '@openmemorykit/ui/contract'
import { OmkSubcommand } from '../omk-subcommand'
import type { ServerContext } from '../server-context'
import type { SnapshotPayload } from '../snapshot-requests'
import type { SubcommandHandler } from './command-arguments'
import { requestSnapshot } from './request-snapshot'

export function ownersLines(context: ServerContext, player: number, snapshot: SnapshotPayload): readonly string[] {
  const { translate } = context.log
  if (snapshot.owners.length === 0) return [translate('log.command.ownersEmpty', { player })]
  return snapshot.owners.map((usage) =>
    translate('log.command.owners', {
      owner: usage.owner,
      radialEntries: usage.radialEntries,
      radialQuota: RADIAL_ENTRIES_PER_OWNER,
      panels: usage.panels,
      prompts: usage.prompts,
      promptQuota: PROMPTS_PER_OWNER,
      confirms: usage.confirms,
      confirmQuota: CONFIRMS_PER_OWNER,
    }),
  )
}

export const ownersCommand: SubcommandHandler = (context, args, reply) =>
  requestSnapshot(context, OmkSubcommand.Owners, args, reply, (player) => (snapshot) => ownersLines(context, player, snapshot))
