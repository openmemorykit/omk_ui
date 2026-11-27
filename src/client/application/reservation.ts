import { radialSelected, waitingEnded } from '../domain/open-blockers'
import { updateBookkeeping, type UseCaseContext } from './use-case-context'

export const RESERVATION_MS = 1000

export function reserveForSelectedOwner(context: UseCaseContext, owner: string): void {
  const session = context.store.read()
  context.store.write({ ...session, gate: radialSelected(session.gate, owner) })
  updateBookkeeping(context, { reservedAt: context.ports.clock.now() })
}

export function endReservation(context: UseCaseContext): void {
  const session = context.store.read()
  context.store.write({ ...session, gate: waitingEnded(session.gate) })
  updateBookkeeping(context, { reservedAt: null })
}

export function endExpiredReservation(context: UseCaseContext): void {
  const { reservedAt } = context.bookkeeping.read()
  if (reservedAt !== null && context.ports.clock.now() - reservedAt >= RESERVATION_MS) endReservation(context)
}
