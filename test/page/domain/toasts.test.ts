import { describe, expect, it } from 'vitest'
import { ContractVersion, NOTIFICATION_QUEUE_LENGTH, NOTIFICATIONS_VISIBLE, NotificationTone } from '@openmemorykit/ui/contract'
import type { Notification } from '@openmemorykit/ui/contract'
import type { OwnedNotification } from '../../../src/protocol/owned'
import {
  DEFAULT_TOAST_DURATION_MS,
  EMPTY_TOASTS,
  expireToasts,
  nextToastExpiry,
  pushToast,
} from '../../../src/page/domain/toasts'
import type { ToastQueue } from '../../../src/page/domain/toasts'
import { OWNED_KEYED_NOTIFICATION, OWNED_PLAIN_NOTIFICATION } from '../../fixtures/owned'

const NOW = 1_000
const FIXTURE_OWNER = 'whitelist'
const OTHER_OWNER = 'garage'
const SECOND_MS = 1_000
const EARLY_MS = 1_500
const MEDIUM_MS = 3_000
const LONG_MS = 9_000
const CUSTOM_MS = 1_234
const TINY_MS = 100
const FLOOD = 100_000
const FILL = NOTIFICATIONS_VISIBLE + NOTIFICATION_QUEUE_LENGTH
const SPILL = 30
const EXPIRING_FIRST = 2
const FEW = 3
const PLENTY_MS = 1_000_000
const SHARED_KEY = 'k'
const LIMITS = { visible: 4, waiting: 20 }

function owned(overrides: Partial<Notification> & { readonly owner?: string } = {}): OwnedNotification {
  const { owner = FIXTURE_OWNER, ...notification } = overrides
  return { owner, notification: { version: ContractVersion.V1, tone: NotificationTone.Info, title: 'title', ...notification } }
}

function pushAll(entries: readonly OwnedNotification[], now: number = NOW, from: ToastQueue = EMPTY_TOASTS): ToastQueue {
  return entries.reduce((queue, entry) => pushToast(queue, entry, now), from)
}

function numbered(count: number, start = 0, durationMs?: number): readonly OwnedNotification[] {
  return Array.from({ length: count }, (_unused, index) => owned({ title: `n${start + index}`, ...(durationMs === undefined ? {} : { durationMs }) }))
}

function titles(toasts: ToastQueue['visible']): readonly string[] {
  return toasts.map((toast) => toast.owned.notification.title)
}

describe('limits', () => {
  it('are 4 visible and 20 waiting', () => {
    expect({ visible: NOTIFICATIONS_VISIBLE, waiting: NOTIFICATION_QUEUE_LENGTH }).toEqual(LIMITS)
  })
})

describe('DEFAULT_TOAST_DURATION_MS', () => {
  it('gives 5 s to info and success, 8 s to warning and error', () => {
    expect(DEFAULT_TOAST_DURATION_MS).toEqual({ info: 5_000, success: 5_000, warning: 8_000, error: 8_000 })
  })
})

describe('pushToast', () => {
  it('shows a notification at once with the duration of its tone', () => {
    const queue = pushToast(EMPTY_TOASTS, owned({ tone: NotificationTone.Error }), NOW)
    expect(queue.visible).toHaveLength(1)
    expect(queue.visible[0]).toMatchObject({ shownAt: NOW, durationMs: DEFAULT_TOAST_DURATION_MS.error })
    expect(queue.waiting).toEqual([])
    expect(queue.dropped).toBe(0)
  })

  it('lets the notification duration win', () => {
    const queue = pushToast(EMPTY_TOASTS, owned({ durationMs: CUSTOM_MS }), NOW)
    expect(queue.visible[0]?.durationMs).toBe(CUSTOM_MS)
  })

  it('shows 4 and queues the 5th', () => {
    const queue = pushAll(numbered(NOTIFICATIONS_VISIBLE + 1))
    expect(titles(queue.visible)).toEqual(['n0', 'n1', 'n2', 'n3'])
    expect(titles(queue.waiting)).toEqual(['n4'])
    expect(queue.waiting[0]?.shownAt).toBeNull()
  })

  it('keeps 20 waiting and drops the oldest on the 21st', () => {
    const full = pushAll(numbered(FILL))
    expect(full.waiting).toHaveLength(NOTIFICATION_QUEUE_LENGTH)
    expect(full.dropped).toBe(0)
    const over = pushToast(full, owned({ title: 'late' }), NOW)
    expect(over.waiting).toHaveLength(NOTIFICATION_QUEUE_LENGTH)
    expect(over.dropped).toBe(1)
    expect(over.waiting[0]?.owned.notification.title).toBe(`n${NOTIFICATIONS_VISIBLE + 1}`)
    expect(over.waiting.at(-1)?.owned.notification.title).toBe('late')
  })

  it('stays bounded under a flood', () => {
    const queue = pushAll(numbered(FLOOD))
    expect(queue.visible).toHaveLength(NOTIFICATIONS_VISIBLE)
    expect(queue.waiting).toHaveLength(NOTIFICATION_QUEUE_LENGTH)
    expect(queue.dropped).toBe(FLOOD - FILL)
  })

  it('replaces a visible toast with the same owner and key, in place, and restarts its duration', () => {
    const queue = pushAll([owned({ title: 'a' }), owned({ key: SHARED_KEY, title: 'old' }), owned({ title: 'b' })], NOW)
    const later = pushToast(queue, owned({ key: SHARED_KEY, title: 'new', tone: NotificationTone.Warning }), NOW + MEDIUM_MS)
    expect(titles(later.visible)).toEqual(['a', 'new', 'b'])
    expect(later.visible[1]).toMatchObject({ shownAt: NOW + MEDIUM_MS, durationMs: DEFAULT_TOAST_DURATION_MS.warning })
    expect(later.visible[0]?.shownAt).toBe(NOW)
    expect(later.dropped).toBe(0)
  })

  it('replaces a waiting toast with the same owner and key, in place', () => {
    const queue = pushAll([...numbered(NOTIFICATIONS_VISIBLE), owned({ key: SHARED_KEY, title: 'old' }), owned({ title: 'after' })])
    const later = pushToast(queue, owned({ key: SHARED_KEY, title: 'new' }), NOW + TINY_MS)
    expect(titles(later.waiting)).toEqual(['new', 'after'])
    expect(later.waiting[0]?.shownAt).toBeNull()
  })

  it('does not merge the same key from two owners, nor toasts without key', () => {
    const queue = pushAll([owned({ key: SHARED_KEY }), owned({ key: SHARED_KEY, owner: OTHER_OWNER }), owned(), owned()])
    expect(queue.visible).toHaveLength(NOTIFICATIONS_VISIBLE)
  })

  it('treats hostile keys as plain text', () => {
    const queue = pushAll(['__proto__', 'constructor', 'toString'].map((key) => owned({ key })))
    expect(queue.visible).toHaveLength(FEW)
    expect(pushToast(queue, owned({ key: '__proto__' }), NOW).visible).toHaveLength(FEW)
  })

  it('does not mutate its inputs and returns a new queue', () => {
    const before = pushAll(numbered(NOTIFICATIONS_VISIBLE + FEW))
    const snapshot = JSON.stringify(before)
    const after = pushToast(before, owned({ title: 'x' }), NOW + 1)
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(after).not.toBe(before)
    expect(Object.isFrozen(EMPTY_TOASTS)).toBe(true)
    expect(EMPTY_TOASTS).toEqual({ visible: [], waiting: [], dropped: 0 })
  })

  it('accepts the shared notification fixtures', () => {
    const queue = pushAll([OWNED_KEYED_NOTIFICATION, OWNED_PLAIN_NOTIFICATION])
    expect(queue.visible).toHaveLength(EXPIRING_FIRST)
  })
})

describe('expireToasts', () => {
  it('expires at once a visible toast that has no start time', () => {
    const [shown] = pushToast(EMPTY_TOASTS, owned({ durationMs: CUSTOM_MS }), NOW).visible
    if (shown === undefined) throw new Error('toast expected')
    const unstarted: ToastQueue = { ...EMPTY_TOASTS, visible: [{ ...shown, shownAt: null }] }
    expect(expireToasts(unstarted, CUSTOM_MS).visible).toEqual([])
    expect(nextToastExpiry(unstarted)).toBe(CUSTOM_MS)
  })

  it('keeps toasts before their end and removes them at their end', () => {
    const queue = pushAll([owned({ durationMs: SECOND_MS })])
    expect(expireToasts(queue, NOW + SECOND_MS - 1).visible).toHaveLength(1)
    expect(expireToasts(queue, NOW + SECOND_MS).visible).toHaveLength(0)
  })

  it('returns the same queue when nothing expires', () => {
    const queue = pushAll(numbered(FEW))
    expect(expireToasts(queue, NOW + 1)).toBe(queue)
  })

  it('promotes the first waiting toast with shownAt = now', () => {
    const queue = pushAll([owned({ durationMs: SECOND_MS, title: 'short' }), ...numbered(FEW), owned({ title: 'w1' }), owned({ title: 'w2' })])
    const later = expireToasts(queue, NOW + SECOND_MS)
    expect(titles(later.visible)).toEqual(['n0', 'n1', 'n2', 'w1'])
    expect(later.visible.at(-1)?.shownAt).toBe(NOW + SECOND_MS)
    expect(titles(later.waiting)).toEqual(['w2'])
  })

  it('promotes several toasts when several expire, and keeps dropped', () => {
    const queue = pushAll([...numbered(EXPIRING_FIRST, 0, SECOND_MS), ...numbered(EXPIRING_FIRST, EXPIRING_FIRST), ...numbered(SPILL, NOTIFICATIONS_VISIBLE)])
    const dropped = EXPIRING_FIRST + EXPIRING_FIRST + SPILL - FILL
    expect(queue.dropped).toBe(dropped)
    const later = expireToasts(queue, NOW + SECOND_MS)
    expect(later.visible).toHaveLength(NOTIFICATIONS_VISIBLE)
    expect(later.visible.filter((toast) => toast.shownAt === NOW + SECOND_MS)).toHaveLength(EXPIRING_FIRST)
    expect(later.waiting).toHaveLength(NOTIFICATION_QUEUE_LENGTH - EXPIRING_FIRST)
    expect(later.dropped).toBe(dropped)
  })

  it('empties everything after enough time', () => {
    const final = Array.from({ length: FILL }).reduce<ToastQueue>((queue, _unused, step) => expireToasts(queue, NOW + PLENTY_MS * (step + 1)), pushAll(numbered(FILL)))
    expect(final.visible).toEqual([])
    expect(final.waiting).toEqual([])
  })

  it('does not mutate its input', () => {
    const queue = pushAll(numbered(NOTIFICATIONS_VISIBLE + FEW))
    const snapshot = JSON.stringify(queue)
    expireToasts(queue, NOW + PLENTY_MS)
    expect(JSON.stringify(queue)).toBe(snapshot)
  })
})

describe('nextToastExpiry', () => {
  it('is null without visible toast', () => {
    expect(nextToastExpiry(EMPTY_TOASTS)).toBeNull()
  })

  it('is the earliest end among visible toasts', () => {
    const queue = pushAll([owned({ durationMs: MEDIUM_MS }), owned({ durationMs: EARLY_MS }), owned({ durationMs: LONG_MS })])
    expect(nextToastExpiry(queue)).toBe(NOW + EARLY_MS)
  })

  it('ignores waiting toasts', () => {
    const queue = pushAll([...numbered(NOTIFICATIONS_VISIBLE, 0, LONG_MS), owned({ durationMs: TINY_MS })])
    expect(nextToastExpiry(queue)).toBe(NOW + LONG_MS)
  })
})
