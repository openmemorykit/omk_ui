import { CALL_DONE, type CallResult } from '@openmemorykit/ui/contract'
import type { ToPageMessage } from '../../protocol/to-page'
import type { RegistryOutcome, RegistryState } from '../domain/owner-registry'
import { refuseCall, type ContractCall } from './call-refusals'
import { sendStackCommand } from './stack-messages'
import type { UseCaseContext } from './use-case-context'

export function commitToRegistry(context: UseCaseContext, call: ContractCall, change: (registry: RegistryState) => RegistryOutcome): CallResult {
  const session = context.store.read()
  const outcome = change(session.registry)
  if (!outcome.ok) return refuseCall(context, call, [outcome.error])
  context.store.write({ ...session, registry: outcome.registry })
  sendStackCommand(context, session.registry, outcome.command)
  return CALL_DONE
}

export function sendToReadyPage(context: UseCaseContext, message: ToPageMessage): void {
  if (context.store.read().link.ready) context.ports.nui.send(message)
}
