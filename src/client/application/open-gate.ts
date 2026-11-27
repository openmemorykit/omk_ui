import type { OpenBlocker } from '@openmemorykit/ui/contract'
import { UiMode } from '../../protocol/page-vocabulary'
import { firstOpenBlocker, openConditionsFrom, OpenPurpose } from '../domain/open-blockers'
import { GuardKind } from '../domain/release-guard'
import { endExpiredReservation } from './reservation'
import type { UseCaseContext } from './use-case-context'

const STANDING_STILL = 0

function holdsOtherNuiFocus(context: UseCaseContext): boolean {
  const { mode, guard } = context.store.read()
  return mode === UiMode.Idle && guard.kind !== GuardKind.Escape && context.ports.game.isNuiFocused()
}

export function ownerCallBlocker(context: UseCaseContext, owner: string): OpenBlocker | null {
  endExpiredReservation(context)
  const { ports } = context
  const session = context.store.read()
  const speed = ports.game.drivenVehicleSpeed()
  const situation = {
    pauseMenuActive: ports.game.isPauseMenuActive(),
    otherNuiFocus: holdsOtherNuiFocus(context),
    screenFaded: ports.game.isScreenFaded(),
    driving: speed !== null,
    vehicleSpeedMetersPerSecond: speed ?? STANDING_STILL,
    vehicleSpeedLimitKmh: ports.config.read().config.input.vehicleSpeedLimit,
    radialEntryCount: session.registry.radialEntries.length,
    caller: owner,
    now: ports.clock.now(),
  }
  return firstOpenBlocker(openConditionsFrom(session.gate, situation), OpenPurpose.OwnerCall)
}
