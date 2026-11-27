import { NOTIFICATION_QUEUE_LENGTH, type Notification } from '@openmemorykit/ui/contract'
import { toPageNotification } from '../../protocol/owned'
import { ToPage } from '../../protocol/to-page'
import { ONE_LINE_PER_SECOND_MS, printLimited } from './limited-console'
import type { UseCaseContext } from './use-case-context'

const QUEUE_FULL_KEY = 'notificationQueueFull'

export function deliverNotification(context: UseCaseContext, owner: string, notification: Notification): void {
  const owned = toPageNotification(owner, notification)
  const session = context.store.read()
  if (session.link.ready) {
    context.ports.nui.send({ type: ToPage.Notify, notification: owned })
    return
  }
  const queued = [...session.link.queuedNotifications, owned]
  const dropped = queued.length - NOTIFICATION_QUEUE_LENGTH
  if (dropped > 0) printLimited(context, QUEUE_FULL_KEY, `page not ready, oldest notification dropped (queue of ${NOTIFICATION_QUEUE_LENGTH})`, ONE_LINE_PER_SECOND_MS)
  context.store.write({ ...session, link: { ...session.link, queuedNotifications: queued.slice(-NOTIFICATION_QUEUE_LENGTH) } })
}
