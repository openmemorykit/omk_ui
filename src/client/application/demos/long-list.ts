import { ScenarioId } from '../../../../preview/runtime/types'
import { DemoName } from '../../../shared/net/net-events'
import type { Demo } from './demo'

export const longListDemo: Demo = {
  name: DemoName.LongList,
  scenario: ScenarioId.LongList,
  scenarioOnRadialSelected: null,
}
