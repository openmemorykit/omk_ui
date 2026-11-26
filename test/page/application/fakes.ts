import type { FromPageMessage } from '../../../src/protocol/from-page'
import type { ToPageMessage } from '../../../src/protocol/to-page'
import type { LocaleBundle } from '../../../src/protocol/to-page'
import type { TimerKind } from '../../../src/page/domain/page-commands'
import type { AnnounceUrgency, UiPorts } from '../../../src/page/application/ports'
import type { MessageKey, MessageParams } from '../../../src/page/i18n/messages'

export interface FakeTimer { readonly delayMs: number; readonly fire: () => void }

export interface Fakes {
  readonly ports: UiPorts
  readonly sent: FromPageMessage[]
  readonly timers: Map<TimerKind, FakeTimer>
  readonly scheduled: { readonly timer: TimerKind; readonly delayMs: number }[]
  readonly cancelled: TimerKind[]
  readonly frames: (() => void)[]
  readonly announced: { readonly text: string; readonly urgency: AnnounceUrgency }[]
  readonly paints: ((paintedAt: number) => void)[]
  readonly focused: string[]
  readonly loaded: LocaleBundle[]
  readonly time: { now: number }
  hostListeners(): number
  emit(message: ToPageMessage): void
}

export function createFakes(): Fakes {
  const sent: FromPageMessage[] = []
  const timers = new Map<TimerKind, FakeTimer>()
  const scheduled: { timer: TimerKind; delayMs: number }[] = []
  const cancelled: TimerKind[] = []
  const frames: (() => void)[] = []
  const announced: { text: string; urgency: AnnounceUrgency }[] = []
  const paints: ((paintedAt: number) => void)[] = []
  const focused: string[] = []
  const loaded: LocaleBundle[] = []
  const hostListeners = new Set<(message: ToPageMessage) => void>()
  const time = { now: 0 }
  const ports: UiPorts = {
    host: {
      send: (message) => void sent.push(message),
      listen: (listener) => {
        hostListeners.add(listener)
        return () => void hostListeners.delete(listener)
      },
    },
    scheduler: {
      schedule: (timer, delayMs, fire) => {
        scheduled.push({ timer, delayMs })
        timers.set(timer, { delayMs, fire })
      },
      cancel: (timer) => {
        cancelled.push(timer)
        timers.delete(timer)
      },
    },
    frames: { request: (callback) => void frames.push(callback) },
    clock: { now: () => time.now },
    announcer: { announce: (text, urgency) => void announced.push({ text, urgency }) },
    translator: {
      load: (bundle) => void loaded.push(bundle),
      translate: (key: MessageKey, params?: MessageParams) => `${key}|${JSON.stringify(params ?? {})}`,
    },
    paint: { afterPaint: (callback) => void paints.push(callback) },
    textFocus: { focus: (itemId) => void focused.push(itemId) },
  }
  return {
    ports,
    sent,
    timers,
    scheduled,
    cancelled,
    frames,
    announced,
    paints,
    focused,
    loaded,
    time,
    hostListeners: () => hostListeners.size,
    emit: (message) => hostListeners.forEach((listener) => listener(message)),
  }
}
