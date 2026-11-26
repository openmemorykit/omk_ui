import { InputSource, Intent, IntentPhase } from '../../src/protocol/intents'
import { ToPage } from '../../src/protocol/to-page'
import type { ClientIntentMessage } from '../runtime/types'

export interface ConsoleStickMessage {
  readonly type: typeof ToPage.Stick
  readonly x: number
  readonly y: number
}

export type ConsoleMessage = ClientIntentMessage | ConsoleStickMessage

export interface ConsoleApi {
  dispatch(intent: Intent, phase?: IntentPhase): void
  stick(x: number, y: number): void
}

export interface ConsoleHost {
  ui?: ConsoleApi
}

const INTENTS: ReadonlySet<unknown> = new Set(Object.values(Intent))
const PHASES: ReadonlySet<unknown> = new Set(Object.values(IntentPhase))
const STICK_LIMIT = 1
const HOST_KEY = 'ui'

function intentMessage(intent: Intent, phase: IntentPhase): ClientIntentMessage {
  return { type: ToPage.Intent, intent, phase, source: InputSource.Console }
}

function clamp(value: number): number {
  return Math.min(STICK_LIMIT, Math.max(-STICK_LIMIT, value))
}

export function installConsoleApi(host: ConsoleHost, dispatch: (message: ConsoleMessage) => void): () => void {
  const api: ConsoleApi = {
    dispatch(intent, phase) {
      const known = INTENTS.has(intent) && (phase === undefined || PHASES.has(phase))
      if (!known) return
      const phases = phase === undefined ? [IntentPhase.Press, IntentPhase.Release] : [phase]
      phases.forEach((each) => dispatch(intentMessage(intent, each)))
    },
    stick(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      dispatch({ type: ToPage.Stick, x: clamp(x), y: clamp(y) })
    },
  }
  Reflect.set(host, HOST_KEY, api)
  return () => {
    if (host.ui === api) Reflect.deleteProperty(host, HOST_KEY)
  }
}
