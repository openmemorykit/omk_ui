import type { ContractError, Panel } from '@openmemorykit/ui/contract'
import { OWNER_MAX_LENGTH } from '../../../src/protocol/namespaced-id'
import type { RegistryOutcome, RegistryState, StackCommand } from '../../../src/client/domain/owner-registry'
import { LIST_PANEL } from '../../fixtures/panels'

export type AcceptedOutcome = Extract<RegistryOutcome, { readonly ok: true }>

export const HOSTILE_OWNERS: readonly string[] = ['toString', '__proto__', 'a'.repeat(OWNER_MAX_LENGTH + 1)]

export function accepted(outcome: RegistryOutcome): AcceptedOutcome {
  if (!outcome.ok) throw new Error(`Refused with ${outcome.error.code}`)
  return outcome
}

export function refusal(outcome: RegistryOutcome): ContractError {
  if (outcome.ok) throw new Error('Accepted')
  return outcome.error
}

export const registryAfter = (outcome: RegistryOutcome): RegistryState => accepted(outcome).registry

export function commandOf(outcome: RegistryOutcome): StackCommand {
  const { command } = accepted(outcome)
  if (command === null) throw new Error('No command')
  return command
}

export const panelAt = (level: number): Panel => ({ ...LIST_PANEL, id: `level-${level}` })
