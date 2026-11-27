import type { KitExport } from '@openmemorykit/ui/contract'
import { InputSource, type Intent, IntentPhase } from '../../src/protocol/intents'
import { ToPage } from '../../src/protocol/to-page'
import { StepKind, type CallStep, type ClientStep, type FakeResourceFactory, type ScenarioEntry, type ScenarioId, type ScenarioStep } from '../runtime/types'

export const Owner = { Whitelist: 'whitelist', Garage: 'garage', Phone: 'phone', Jobs: 'jobs', Settings: 'settings' } as const

export const call = (owner: string, name: KitExport, ...args: readonly unknown[]): CallStep => ({ kind: StepKind.Call, owner, name, args })

export const client = (message: ClientStep['message']): ClientStep => ({ kind: StepKind.Client, message })

export const press = (intent: Intent): readonly ClientStep[] => [
  client({ type: ToPage.Intent, intent, phase: IntentPhase.Press, source: InputSource.Pad }),
  client({ type: ToPage.Intent, intent, phase: IntentPhase.Release, source: InputSource.Pad }),
]

export const presses = (...intents: readonly Intent[]): readonly ClientStep[] => intents.flatMap(press)

export function entry(id: ScenarioId, steps: readonly (ScenarioStep | readonly ScenarioStep[])[], resources: ReadonlyMap<string, FakeResourceFactory> = new Map()): ScenarioEntry {
  return { scenario: { id, steps: steps.flat() }, resources }
}
