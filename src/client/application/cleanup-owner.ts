import { isNamespaceOwner } from '../../protocol/namespaced-id'
import { dropOwner } from '../domain/owner-registry'
import { afterPromptsChanged } from './prompt-sync'
import { endReservation } from './reservation'
import { sendStackCommand } from './stack-messages'
import { rememberLink, type UseCaseContext } from './use-case-context'

export function cleanupOwner(context: UseCaseContext, resourceName: string): void {
  if (!isNamespaceOwner(resourceName)) return
  context.limiter.forget(resourceName)
  const session = context.store.read()
  const { registry, command } = dropOwner(session.registry, resourceName)
  const queuedNotifications = session.link.queuedNotifications.filter(({ owner }) => owner !== resourceName)
  context.store.write({ ...session, registry, link: { ...session.link, queuedNotifications } })
  if (session.gate.reservedFor === resourceName) endReservation(context)
  rememberLink(context, { panelsOnPage: context.memory.read().panelsOnPage.filter(({ registered }) => registered.owner !== resourceName) })
  sendStackCommand(context, session.registry, command)
  afterPromptsChanged(context, session.registry)
}
