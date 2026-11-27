import { KitExport } from '@openmemorykit/ui/contract'
import type { ScenarioId } from '../../../../preview/runtime/types'
import type { DemoName } from '../../../shared/net/net-events'
import { handleContractCall } from '../contract-call'
import type { UseCaseContext } from '../use-case-context'
import type { Demo } from './demo'
import { DEMOS, demoOwnerOf, scenarioCalls } from './demo-catalog'

function replayScenarioCalls(context: UseCaseContext, scenario: ScenarioId, ownerOf: (scenarioOwner: string) => string): void {
  scenarioCalls(scenario).forEach((step) => handleContractCall(context, step.name, ownerOf(step.owner), step.args))
}

export function playDemo(context: UseCaseContext, name: DemoName): void {
  const demo = DEMOS.get(name)
  if (demo !== undefined) replayScenarioCalls(context, demo.scenario, demoOwnerOf)
}

function registersRadialEntryOf(demo: Demo, owner: string): boolean {
  return scenarioCalls(demo.scenario).some((step) => step.name === KitExport.AddRadialEntry && demoOwnerOf(step.owner) === owner)
}

export function openScenarioOfSelectedEntry(context: UseCaseContext, owner: string): void {
  const demo = [...DEMOS.values()].find((candidate) => registersRadialEntryOf(candidate, owner))
  const scenario = demo?.scenarioOnRadialSelected ?? null
  if (scenario !== null) replayScenarioCalls(context, scenario, () => owner)
}
