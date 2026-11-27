import { StepKind, type CallStep, type ScenarioId, type ScenarioStep } from '../../../../preview/runtime/types'
import { SCENARIO_CATALOG } from '../../../../preview/scenarios'
import type { DemoName } from '../../../shared/net/net-events'
import { confirmDemo } from './confirm'
import type { Demo } from './demo'
import { formDemo } from './form'
import { keyboardDemo } from './keyboard'
import { listDemo } from './list'
import { longListDemo } from './long-list'
import { promptDemo } from './prompt'
import { radialDemo } from './radial'
import { toastsDemo } from './toasts'

export const DEMO_OWNER_PREFIX = 'omk_ui_demo_'
const ASK_SCENARIO_OWNER = 'ask'

export const DEMOS: ReadonlyMap<DemoName, Demo> = new Map(
  [radialDemo, listDemo, longListDemo, formDemo, confirmDemo, keyboardDemo, toastsDemo, promptDemo].map((demo) => [demo.name, demo] as const),
)

export function demoOwnerOf(scenarioOwner: string): string {
  return `${DEMO_OWNER_PREFIX}${scenarioOwner}`
}

export const ASK_OWNER = demoOwnerOf(ASK_SCENARIO_OWNER)

function isCallStep(step: ScenarioStep): step is CallStep {
  return step.kind === StepKind.Call
}

export function scenarioCalls(scenario: ScenarioId): readonly CallStep[] {
  return SCENARIO_CATALOG.get(scenario)?.scenario.steps.filter(isCallStep) ?? []
}

function scenariosOf(demo: Demo): readonly ScenarioId[] {
  return demo.scenarioOnRadialSelected === null ? [demo.scenario] : [demo.scenario, demo.scenarioOnRadialSelected]
}

const SCENARIO_OWNERS = [...DEMOS.values()].flatMap(scenariosOf).flatMap(scenarioCalls).map((step) => demoOwnerOf(step.owner))

export const DEMO_OWNERS: ReadonlySet<string> = new Set([ASK_OWNER, ...SCENARIO_OWNERS])

export function claimsDemoOwnerName(owner: string): boolean {
  return owner.startsWith(DEMO_OWNER_PREFIX)
}
