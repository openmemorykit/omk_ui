import { ScenarioId } from '../../../../preview/runtime/types'
import { DemoName } from '../../../shared/net/net-events'
import type { Demo } from './demo'

export const toastsDemo: Demo = {
  name: DemoName.Toasts,
  scenario: ScenarioId.Toasts,
  scenarioOnRadialSelected: null,
}
