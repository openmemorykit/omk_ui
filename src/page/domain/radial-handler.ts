import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { InputSource, Intent, IntentPhase } from '../../protocol/intents'
import type { OwnedRadialEntry } from '../../protocol/owned'
import { UiMode } from '../../protocol/page-vocabulary'
import type { OwnedReply } from '../../protocol/stack'
import { ToPage } from '../../protocol/to-page'
import type { InputCommand } from './input-routing'
import { closeAllFrames } from './navigation'
import { PageCommandType, TimerKind, WAITING_TIMEOUT_MS, type LocalIntentCommand, type UiCommandOf } from './page-commands'
import { aimRadial, childrenOf, enterChildren, leaveChildren, stepRadial, withRadialEntries } from './radial-navigation'
import { schedule, stackEvent, unchanged, withEffects, type CommandHandler, type Transition } from './ui-effects'
import { RadialLevel, type RadialState, type UiState } from './ui-state'

const PREVIOUS = -1
const NEXT = 1

export const handleOpenRadial: CommandHandler<UiCommandOf<typeof ToPage.OpenRadial>> = (state) =>
  unchanged(state.mode === UiMode.Radial ? state : { ...state, mode: UiMode.Radial })

export const handleRadialEntries: CommandHandler<UiCommandOf<typeof ToPage.RadialEntries>> = (state, message) =>
  unchanged({ ...state, radial: withRadialEntries(state.radial, message.entries) })

function withRadial(state: UiState, radial: RadialState): Transition {
  return unchanged(radial === state.radial ? state : { ...state, radial })
}

export function closeRadial(state: UiState, fromEscape: boolean): Transition {
  return unchanged({ ...state, mode: UiMode.Idle, escapeHeld: fromEscape })
}

function select(state: UiState, owned: OwnedRadialEntry, childId: string | undefined): Transition {
  const closed = closeAllFrames(state, CloseReason.RadialSelection)
  const entryId = owned.entry.id
  const selected: OwnedReply = { owner: owned.owner, reply: { kind: ReplyKind.RadialSelected, entryId, ...(childId === undefined ? {} : { childId }) } }
  const waiting = { ...closed.state, mode: UiMode.Waiting }
  return withEffects(waiting, [stackEvent(waiting, closed.replies.concat(selected)), schedule(TimerKind.WaitingTimeout, WAITING_TIMEOUT_MS)])
}

function confirm(state: UiState): Transition {
  const { radial } = state
  const owned = radial.entries[radial.sectorIndex]
  if (owned === undefined) return unchanged(state)
  const children = childrenOf(owned)
  if (radial.level === RadialLevel.Sectors) return children.length > 0 ? withRadial(state, enterChildren(radial)) : select(state, owned, undefined)
  const child = children[radial.childIndex ?? PREVIOUS]
  return child === undefined ? unchanged(state) : select(state, owned, child.id)
}

function back(state: UiState, fromEscape: boolean): Transition {
  return state.radial.level === RadialLevel.Children ? withRadial(state, leaveChildren(state.radial)) : closeRadial(state, fromEscape)
}

function radialIntent(state: UiState, command: LocalIntentCommand): Transition {
  if (command.phase !== IntentPhase.Press) return unchanged(state)
  switch (command.intent) {
    case Intent.Left:
      return withRadial(state, stepRadial(state.radial, PREVIOUS))
    case Intent.Right:
      return withRadial(state, stepRadial(state.radial, NEXT))
    case Intent.Up:
      return withRadial(state, enterChildren(state.radial))
    case Intent.Down:
      return withRadial(state, leaveChildren(state.radial))
    case Intent.Confirm:
      return confirm(state)
    case Intent.Back:
      return back(state, command.fromEscape)
    case Intent.Radial:
      return closeRadial(state, false)
    default:
      return unchanged(state)
  }
}

export const handleRadial: CommandHandler<InputCommand> = (state, command) => {
  switch (command.type) {
    case ToPage.Stick:
      return withRadial(state, aimRadial(state.radial, command, InputSource.Pad))
    case PageCommandType.PointerAim:
      return command.vector === null ? unchanged(state) : withRadial(state, aimRadial(state.radial, command.vector, InputSource.Pointer))
    case PageCommandType.LocalIntent:
      return radialIntent(state, command)
    default:
      return unchanged(state)
  }
}
