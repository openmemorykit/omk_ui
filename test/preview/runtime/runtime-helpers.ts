import { ActionVariant, ContractVersion, ItemKind, PanelKind, type MenuPanel, type Reply } from '@openmemorykit/ui/contract'
import type { Clock, Scheduler } from '../../../src/page/application/ports'
import { transition } from '../../../src/page/domain/intent-engine'
import type { TimerKind, UiCommand } from '../../../src/page/domain/page-commands'
import { UiEffectType } from '../../../src/page/domain/ui-effects'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import { FromPage, type FromPageMessage } from '../../../src/protocol/from-page'
import { InputSource, IntentPhase, type Intent } from '../../../src/protocol/intents'
import { ToPage, type ToPageMessage, type ToPageMessageOf } from '../../../src/protocol/to-page'
import type { FakeKit, FakeResource } from '../../../preview/runtime/types'

export const PAGE_NOW = 10_000
export const READY: FromPageMessage = Object.freeze({ type: FromPage.Ready })

export interface PageDriver {
  dispatch(command: UiCommand): void
  state(): UiState
  readonly sent: FromPageMessage[]
}

export function createPageDriver(deliver: (message: FromPageMessage) => void): PageDriver {
  let state = createInitialState()
  const sent: FromPageMessage[] = []
  const queue: UiCommand[] = []
  let draining = false
  const apply = (command: UiCommand): void => {
    const next = transition(state, command, PAGE_NOW)
    state = next.state
    next.effects.forEach((effect) => {
      if (effect.type !== UiEffectType.SendToHost) return
      sent.push(effect.message)
      deliver(effect.message)
    })
  }
  return {
    dispatch(command) {
      queue.push(command)
      if (draining) return
      draining = true
      try {
        for (let next = queue.shift(); next !== undefined; next = queue.shift()) apply(next)
      } finally {
        draining = false
      }
    },
    state: () => state,
    sent,
  }
}

export interface FakeTimer { readonly delayMs: number; readonly fire: () => void }

export interface FakeTime {
  readonly clock: Clock
  readonly scheduler: Scheduler
  readonly timers: Map<TimerKind, FakeTimer>
  readonly cancelled: TimerKind[]
  readonly time: { now: number }
  fire(timer: TimerKind): void
}

export function createFakeTime(): FakeTime {
  const timers = new Map<TimerKind, FakeTimer>()
  const cancelled: TimerKind[] = []
  const time = { now: 0 }
  return {
    clock: { now: () => time.now },
    scheduler: {
      schedule: (timer, delayMs, fire) => void timers.set(timer, { delayMs, fire }),
      cancel: (timer) => {
        cancelled.push(timer)
        timers.delete(timer)
      },
    },
    timers,
    cancelled,
    time,
    fire(timer) {
      const pending = timers.get(timer)
      timers.delete(timer)
      pending?.fire()
    },
  }
}

export function clientIntent(seq: number, intent: Intent, phase: IntentPhase): ToPageMessageOf<typeof ToPage.Intent> {
  return { type: ToPage.Intent, seq, intent, phase, source: InputSource.Pad }
}

export function menu(id: string, title = 'Menu'): MenuPanel {
  return {
    version: ContractVersion.V1,
    kind: PanelKind.Menu,
    id,
    title,
    items: [
      { kind: ItemKind.Action, id: 'go', label: 'Go', variant: ActionVariant.Primary },
      { kind: ItemKind.Link, id: 'more', label: 'More' },
      { kind: ItemKind.Toggle, id: 'flag', label: 'Flag', value: false },
    ],
  }
}

export interface RecordingResource extends FakeResource {
  readonly replies: Reply[]
  readonly calls: { readonly name: string; readonly payload: unknown }[]
}

export function forwardingRecorder(kit: FakeKit, onReply: (reply: Reply) => void = () => undefined): RecordingResource {
  const replies: Reply[] = []
  const calls: { name: string; payload: unknown }[] = []
  return {
    replies,
    calls,
    call(name, payload) {
      calls.push({ name, payload })
      return kit.call(name, payload)
    },
    onReply(reply) {
      replies.push(reply)
      onReply(reply)
    },
  }
}

export function messagesOf<Type extends ToPage>(messages: readonly ToPageMessage[], type: Type): readonly ToPageMessageOf<Type>[] {
  return messages.filter((message): message is ToPageMessageOf<Type> => message.type === type)
}
