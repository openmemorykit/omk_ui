import { ScenarioId } from '../../../../preview/runtime/types'
import { DemoName } from '../../../shared/net/net-events'
import type { Demo } from './demo'

export const confirmDemo: Demo = {
  name: DemoName.Confirm,
  scenario: ScenarioId.ConfirmDanger,
  scenarioOnRadialSelected: null,
}
