import { UiMode } from '../../protocol/page-vocabulary'
import { GesturePhase } from '../domain/open-gesture'
import { PromptPhase } from '../domain/hold-prompt'
import { GuardKind } from '../domain/release-guard'
import type { ClientSession } from './session-state'

export function isPumpNeeded(session: ClientSession): boolean {
  const menuOpen = session.mode !== UiMode.Idle
  const gestureHeld = session.gesture.phase !== GesturePhase.Idle
  const guardActive = session.guard.kind !== GuardKind.None
  const promptShown = session.registry.prompts.length > 0
  const holdRunning = session.prompt.phase === PromptPhase.Holding
  return menuOpen || gestureHeld || guardActive || promptShown || holdRunning
}
