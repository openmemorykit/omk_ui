import { ScenarioId } from '../../../../preview/runtime/types'
import { DemoName } from '../../../shared/net/net-events'
import type { Demo } from './demo'

export const formDemo: Demo = {
  name: DemoName.Form,
  scenario: ScenarioId.FormErrors,
  scenarioOnRadialSelected: null,
}
