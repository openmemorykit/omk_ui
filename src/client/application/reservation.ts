import { radialSelected, waitingEnded } from '../domain/open-blockers'
import { rememberLink, type UseCaseContext } from './use-case-context'

export const RESERVATION_MS = 1000

export function reserveForSelectedOwner(context: UseCaseContext, owner: string): void {
  const session = context.store.read()
  context.store.write({ ...session, gate: radialSelected(session.gate, owner) })
  rememberLink(context, { reservedAt: context.ports.clock.now() })
}

export function endReservation(context: UseCaseContext): void {
  const session = context.store.read()
  context.store.write({ ...session, gate: waitingEnded(session.gate) })
  rememberLink(context, { reservedAt: null })
}

export function endExpiredReservation(context: UseCaseContext): void {
  const { reservedAt } = context.memory.read()
  if (reservedAt !== null && context.ports.clock.now() - reservedAt >= RESERVATION_MS) endReservation(context)
}
