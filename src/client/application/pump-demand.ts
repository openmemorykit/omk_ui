import { UiMode } from '../../protocol/page-vocabulary'
import { GesturePhase } from '../domain/open-gesture'
import { GuardKind } from '../domain/release-guard'
import type { ClientSession } from './session-state'

export function isPumpNeeded(session: ClientSession): boolean {
  const menuOpen = session.mode !== UiMode.Idle
  const gestureHeld = session.gesture.phase !== GesturePhase.Idle
  const guardActive = session.guard.kind !== GuardKind.None
  const promptShown = session.registry.prompts.length > 0
  return menuOpen || gestureHeld || guardActive || promptShown
}
