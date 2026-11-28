import { CloseReason } from '@openmemorykit/ui/contract'
import { toPageConfirm } from '../../protocol/owned'
import { ToPage, type ToPageMessage } from '../../protocol/to-page'
import { StackCommandKind, type RegistryState, type StackCommand } from '../domain/owner-registry'
import { UNAPPLIED_COMMANDS_MAX, type ShowConfirmCommand } from '../domain/registry-stack'
import { declinedConfirmReply, deliverReplies, panelClosedReply } from './owner-replies'
import { withPanelsSentBy } from './panels-on-page'
import { forceBoot } from './page-link'
import { updateBookkeeping, type UseCaseContext } from './use-case-context'

function confirmMessage(command: ShowConfirmCommand, registry: RegistryState): ToPageMessage | null {
  const kept = registry.confirms.find((registered) => registered.seq === command.seq)
  return kept === undefined ? null : { type: ToPage.ShowConfirm, commandSeq: command.seq, confirm: toPageConfirm(kept.owner, kept.confirm) }
}

function stackMessage(command: StackCommand, registry: RegistryState): ToPageMessage | null {
  switch (command.kind) {
    case StackCommandKind.Open:
      return { type: ToPage.OpenPanel, commandSeq: command.seq, panel: command.panel }
    case StackCommandKind.Push:
      return { type: ToPage.PushPanel, commandSeq: command.seq, panel: command.panel, parentId: command.parentId }
    case StackCommandKind.Close:
      return { type: ToPage.ClosePanel, commandSeq: command.seq, panelId: command.panelId }
    case StackCommandKind.DropOwner:
      return { type: ToPage.DropOwner, commandSeq: command.seq, owner: command.owner }
    case StackCommandKind.CloseAll:
      return { type: ToPage.CloseAll, commandSeq: command.seq }
    case StackCommandKind.ShowConfirm:
      return confirmMessage(command, registry)
  }
}

function answerForUnreadyPage(context: UseCaseContext, previous: RegistryState, current: RegistryState, command: StackCommand): void {
  if (command.kind === StackCommandKind.DropOwner) return
  const reason = command.kind === StackCommandKind.CloseAll ? CloseReason.CloseAll : CloseReason.ClosedByOwner
  const declined = previous.confirms.filter((registered) => !current.confirms.includes(registered)).map(({ owner, confirm }) => declinedConfirmReply(owner, confirm.id))
  const closed = previous.stack.filter((registered) => !current.stack.includes(registered)).map(({ owner, panel }) => panelClosedReply(owner, panel.id, reason))
  deliverReplies(context, [...declined, ...closed.reverse()])
}

export function sendStackCommand(context: UseCaseContext, previous: RegistryState, command: StackCommand | null): void {
  if (command === null) return
  const { registry, link } = context.store.read()
  if (!link.ready) {
    answerForUnreadyPage(context, previous, registry, command)
    return
  }
  if (previous.unapplied.length >= UNAPPLIED_COMMANDS_MAX) {
    forceBoot(context)
    return
  }
  updateBookkeeping(context, { panelsOnPage: withPanelsSentBy(context.bookkeeping.read().panelsOnPage, registry, command) })
  const message = stackMessage(command, registry)
  if (message !== null) context.ports.nui.send(message)
}
