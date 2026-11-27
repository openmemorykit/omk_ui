import { namespaceId } from '../../protocol/namespaced-id'
import { toPagePrompt } from '../../protocol/owned'
import { ToPage } from '../../protocol/to-page'
import { visiblePrompt, type RegistryState } from '../domain/owner-registry'
import { startOrStopPump } from './pump-switch'
import { sendToReadyPage } from './registry-commit'
import type { UseCaseContext } from './use-case-context'

function showVisiblePrompt(context: UseCaseContext, previous: RegistryState, current: RegistryState): void {
  const shown = visiblePrompt(previous)
  const next = visiblePrompt(current)
  if (next === shown) return
  if (next !== null) sendToReadyPage(context, { type: ToPage.ShowPrompt, prompt: toPagePrompt(next.owner, next.prompt) })
  else if (shown !== null) sendToReadyPage(context, { type: ToPage.HidePrompt, promptId: namespaceId(shown.owner, shown.prompt.id) })
}

export function afterPromptsChanged(context: UseCaseContext, previous: RegistryState): void {
  const session = context.store.read()
  if (session.registry.prompts === previous.prompts) return
  showVisiblePrompt(context, previous, session.registry)
  startOrStopPump(context.ports, context.store)
}
