import { CALL_MAX_BYTES, PanelSchema, PANEL_MAX_ITEMS } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { ScenarioId, StepKind } from '../../../preview/runtime/types'
import { SCENARIO_CATALOG } from '../../../preview/scenarios'
import { validateContract, ValidationStatus } from '@openmemorykit/ui/validation'

const KILOBYTE = 1024
const BUDGET_KILOBYTES = 256
const BUDGET_BYTES = BUDGET_KILOBYTES * KILOBYTE

describe('long-list', () => {
  const [step] = SCENARIO_CATALOG.get(ScenarioId.LongList)?.scenario.steps ?? []

  it('is a single call carrying one thousand rows', () => {
    expect(step?.kind).toBe(StepKind.Call)
    const panel = step?.kind === StepKind.Call ? step.args[0] : undefined
    const result = validateContract(PanelSchema, panel)
    expect(result.status).toBe(ValidationStatus.Accepted)
    expect(result.status === ValidationStatus.Accepted ? result.value.items.length : 0).toBe(PANEL_MAX_ITEMS)
  })

  it('stays under the 256 KB payload limit of the contract', () => {
    expect(CALL_MAX_BYTES).toBe(BUDGET_BYTES)
    const bytes = new TextEncoder().encode(JSON.stringify(step?.kind === StepKind.Call ? step.args : [])).length
    expect(bytes).toBeGreaterThan(0)
    expect(bytes).toBeLessThan(BUDGET_BYTES)
  })
})
