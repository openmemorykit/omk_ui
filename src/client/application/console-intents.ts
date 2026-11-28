import { InputSource, IntentPhase, type Intent } from '../../protocol/intents'
import { sendIntent } from './pump-inputs'
import type { UseCaseContext } from './use-case-context'

const PHASES_OF_ONE_PRESS: readonly IntentPhase[] = Object.freeze([IntentPhase.Press, IntentPhase.Release])

export function sendConsoleIntents(context: UseCaseContext, intent: Intent, count: number): void {
  const { ports, store } = context
  const session = store.read()
  const phases = Array.from({ length: count }, () => PHASES_OF_ONE_PRESS).flat()
  const link = phases.reduce((current, phase) => sendIntent(ports, current, { intent, phase, source: InputSource.Console }), session.link)
  store.write({ ...session, link })
}
