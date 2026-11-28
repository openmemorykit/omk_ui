import { ScenarioId } from '../../../../preview/runtime/types'
import { DemoName } from '../../../shared/net/net-events'
import type { Demo } from './demo'

export const radialDemo: Demo = {
  name: DemoName.Radial,
  scenario: ScenarioId.Radial,
  scenarioOnRadialSelected: ScenarioId.WhitelistList,
}
