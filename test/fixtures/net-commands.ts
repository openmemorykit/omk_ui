import { CommandKind, DemoName } from '../../src/shared/net/net-events'
import type { ServerToClientCommand } from '../../src/shared/net/net-events'
import { Intent } from '../../src/protocol/intents'
import { deepFrozen } from './frozen'
import { KEYED_NOTIFICATION } from './surfaces'

export const SAMPLE_REQUEST_ID = 7
export const SAMPLE_ASK_ID = 3
export const SAMPLE_INTENT_COUNT = 5

type SamplesByKind = { readonly [Kind in CommandKind]: Extract<ServerToClientCommand, { readonly kind: Kind }> }

export const NET_COMMAND_SAMPLES: SamplesByKind = deepFrozen({
  [CommandKind.Trace]: { kind: CommandKind.Trace, active: true },
  [CommandKind.Notify]: { kind: CommandKind.Notify, notification: KEYED_NOTIFICATION },
  [CommandKind.Snapshot]: { kind: CommandKind.Snapshot, requestId: SAMPLE_REQUEST_ID },
  [CommandKind.Demo]: { kind: CommandKind.Demo, demo: DemoName.LongList },
  [CommandKind.Intent]: { kind: CommandKind.Intent, intent: Intent.Down, count: SAMPLE_INTENT_COUNT },
  [CommandKind.Close]: { kind: CommandKind.Close },
  [CommandKind.Ask]: { kind: CommandKind.Ask, askId: SAMPLE_ASK_ID, text: 'Is the radial readable?' },
})
