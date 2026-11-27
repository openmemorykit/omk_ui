import { UiMode } from '../../protocol/page-vocabulary'
import { issueCommand, StackCommandKind } from '../domain/registry-stack'
import { sendStackCommand } from './stack-messages'
import type { UseCaseContext } from './use-case-context'

const NO_PANEL_LEFT = Object.freeze([])

export function closeEverything(context: UseCaseContext): void {
  const session = context.store.read()
  if (session.mode === UiMode.Idle) return
  const { registry, command } = issueCommand(session.registry, NO_PANEL_LEFT, { kind: StackCommandKind.CloseAll })
  context.store.write({ ...session, registry })
  sendStackCommand(context, session.registry, command)
}
