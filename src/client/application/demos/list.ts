import { ScenarioId } from '../../../../preview/runtime/types'
import { DemoName } from '../../../shared/net/net-events'
import type { Demo } from './demo'

export const listDemo: Demo = {
  name: DemoName.List,
  scenario: ScenarioId.WhitelistList,
  scenarioOnRadialSelected: null,
}
