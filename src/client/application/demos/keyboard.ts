import { ScenarioId } from '../../../../preview/runtime/types'
import { DemoName } from '../../../shared/net/net-events'
import type { Demo } from './demo'

export const keyboardDemo: Demo = {
  name: DemoName.Keyboard,
  scenario: ScenarioId.KeyboardLetters,
  scenarioOnRadialSelected: null,
}
