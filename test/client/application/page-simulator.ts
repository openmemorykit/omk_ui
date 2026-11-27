import { applyPageEvent } from '../../../src/client/application/page-event'
import { SESSION_TOKEN_FIELD } from '../../../src/client/application/page-link'
import { FromPage, type FromPageMessage } from '../../../src/protocol/from-page'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import type { ToPageMessage } from '../../../src/protocol/to-page'
import { transition } from '../../../src/page/domain/intent-engine'
import { PageCommandType, type UiCommand } from '../../../src/page/domain/page-commands'
import { UiEffectType, type UiEffect } from '../../../src/page/domain/ui-effects'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import type { UseCaseHarness } from './use-case-harness'

interface Delivery { readonly message: ToPageMessage; readonly sessionToken: string | null }

export interface PageSimulator {
  receive(): void
  process(): void
  pressBack(): void
  crash(): void
  isAlive(): boolean
  panelCount(): number
}

const PortMethod = { Send: 'send', SendBoot: 'sendBoot' } as const

const isSentMessage = (effect: UiEffect): effect is Extract<UiEffect, { readonly type: typeof UiEffectType.SendToHost }> => effect.type === UiEffectType.SendToHost

export function createPageSimulator(harness: UseCaseHarness): PageSimulator {
  let state: UiState = createInitialState()
  let token: string | null = null
  let inbox: Delivery[] = []
  let readCalls = 0
  let alive = true

  const post = (message: FromPageMessage): void => {
    if (token !== null && message.type === FromPage.Event) applyPageEvent(harness.context, { ...message, [SESSION_TOKEN_FIELD]: token })
  }
  const run = (command: UiCommand): void => {
    const next = transition(state, command, harness.ports.clock.now())
    state = next.state
    next.effects.filter(isSentMessage).forEach((effect) => post(effect.message))
  }
  return {
    receive() {
      const calls = harness.ports.nui.calls.slice(readCalls)
      readCalls = harness.ports.nui.calls.length
      calls.forEach((portCall) => {
        if (portCall.method === PortMethod.SendBoot) {
          alive = true
          inbox.push({ message: portCall.args[0], sessionToken: portCall.args[1] })
        }
        if (alive && portCall.method === PortMethod.Send) inbox.push({ message: portCall.args[0], sessionToken: null })
      })
    },
    process() {
      const pending = inbox
      inbox = []
      pending.forEach((delivery) => {
        if (delivery.sessionToken !== null) token = delivery.sessionToken
        run(delivery.message)
      })
    },
    pressBack() {
      run({ type: PageCommandType.LocalIntent, intent: Intent.Back, phase: IntentPhase.Press, fromEscape: false })
      run({ type: PageCommandType.LocalIntent, intent: Intent.Back, phase: IntentPhase.Release, fromEscape: false })
    },
    crash() {
      state = createInitialState()
      token = null
      inbox = []
      alive = false
    },
    isAlive: () => alive,
    panelCount: () => state.stack.length,
  }
}
