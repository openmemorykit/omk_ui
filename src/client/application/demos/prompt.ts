import { ScenarioId } from '../../../../preview/runtime/types'
import { DemoName } from '../../../shared/net/net-events'
import type { Demo } from './demo'

export const promptDemo: Demo = {
  name: DemoName.Prompt,
  scenario: ScenarioId.PromptHold,
  scenarioOnRadialSelected: null,
}
