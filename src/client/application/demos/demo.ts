import type { ScenarioId } from '../../../../preview/runtime/types'
import type { DemoName } from '../../../shared/net/net-events'

export interface Demo {
  readonly name: DemoName
  readonly scenario: ScenarioId
  readonly scenarioOnRadialSelected: ScenarioId | null
}
