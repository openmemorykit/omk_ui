import { UiMode } from '../../protocol/page-vocabulary'
import { issueCommand, StackCommandKind } from '../domain/registry-stack'
import { cleanupOwner } from './cleanup-owner'
import { DEMO_OWNERS } from './demos/demo-catalog'
import { sendStackCommand } from './stack-messages'
import type { UseCaseContext } from './use-case-context'

const NO_PANEL_LEFT = Object.freeze([])

function closeOpenSurfaces(context: UseCaseContext): void {
  const session = context.store.read()
  if (session.mode === UiMode.Idle) return
  const { registry, command } = issueCommand(session.registry, NO_PANEL_LEFT, { kind: StackCommandKind.CloseAll })
  context.store.write({ ...session, registry })
  sendStackCommand(context, session.registry, command)
}

export function closeEverything(context: UseCaseContext): void {
  closeOpenSurfaces(context)
  DEMO_OWNERS.forEach((owner) => cleanupOwner(context, owner))
}
