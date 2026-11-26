import { NOTIFICATION_QUEUE_LENGTH, NOTIFICATIONS_VISIBLE, NotificationTone } from '@openmemorykit/ui/contract'
import type { OwnedNotification } from '../../protocol/owned'

export const DEFAULT_TOAST_DURATION_MS: Readonly<Record<NotificationTone, number>> = Object.freeze({
  [NotificationTone.Info]: 5_000,
  [NotificationTone.Success]: 5_000,
  [NotificationTone.Warning]: 8_000,
  [NotificationTone.Error]: 8_000,
})

export interface Toast { readonly owned: OwnedNotification; readonly shownAt: number | null; readonly durationMs: number }
export interface ToastQueue { readonly visible: readonly Toast[]; readonly waiting: readonly Toast[]; readonly dropped: number }

export const EMPTY_TOASTS: ToastQueue = Object.freeze({ visible: Object.freeze([]), waiting: Object.freeze([]), dropped: 0 })

const endOf = (toast: Toast): number => (toast.shownAt ?? 0) + toast.durationMs

function sameSlot(toast: Toast, owned: OwnedNotification): boolean {
  const { key } = owned.notification
  return key !== undefined && toast.owned.owner === owned.owner && toast.owned.notification.key === key
}

function createToast(owned: OwnedNotification, shownAt: number | null): Toast {
  return { owned, shownAt, durationMs: owned.notification.durationMs ?? DEFAULT_TOAST_DURATION_MS[owned.notification.tone] }
}

function replaceSlot(toasts: readonly Toast[], owned: OwnedNotification, shownAt: number | null): readonly Toast[] | null {
  const index = toasts.findIndex((toast) => sameSlot(toast, owned))
  return index === -1 ? null : toasts.map((toast, position) => (position === index ? createToast(owned, shownAt) : toast))
}

function enqueue(queue: ToastQueue, owned: OwnedNotification, now: number): ToastQueue {
  if (queue.visible.length < NOTIFICATIONS_VISIBLE) return { ...queue, visible: queue.visible.concat(createToast(owned, now)) }
  const waiting = queue.waiting.concat(createToast(owned, null))
  const overflow = waiting.length - NOTIFICATION_QUEUE_LENGTH
  return overflow > 0 ? { ...queue, waiting: waiting.slice(overflow), dropped: queue.dropped + overflow } : { ...queue, waiting }
}

export function pushToast(queue: ToastQueue, owned: OwnedNotification, now: number): ToastQueue {
  const visible = replaceSlot(queue.visible, owned, now)
  if (visible !== null) return { ...queue, visible }
  const waiting = replaceSlot(queue.waiting, owned, null)
  return waiting === null ? enqueue(queue, owned, now) : { ...queue, waiting }
}

export function expireToasts(queue: ToastQueue, now: number): ToastQueue {
  const alive = queue.visible.filter((toast) => endOf(toast) > now)
  if (alive.length === queue.visible.length) return queue
  const promoted = queue.waiting.slice(0, NOTIFICATIONS_VISIBLE - alive.length).map((toast) => ({ ...toast, shownAt: now }))
  return { ...queue, visible: alive.concat(promoted), waiting: queue.waiting.slice(promoted.length) }
}

export function nextToastExpiry(queue: ToastQueue): number | null {
  return queue.visible.length === 0 ? null : Math.min(...queue.visible.map(endOf))
}
