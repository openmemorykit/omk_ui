import { ContractErrorCode, KitExport, LABEL_MAX_LENGTH } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { validateScenario, WAIT_MAX_MS } from '../../../preview/runtime/scenario-runner'
import { ScenarioId, StepKind, type Scenario, type ScenarioStep } from '../../../preview/runtime/types'
import { InputSource, Intent, IntentPhase } from '../../../src/protocol/intents'
import { ToPage } from '../../../src/protocol/to-page'
import { LIST_PANEL } from '../../fixtures/panels'

const OPEN_LIST: ScenarioStep = { kind: StepKind.Call, owner: 'whitelist', name: KitExport.OpenPanel, args: [LIST_PANEL] }
const WAIT_STEP_MS = 300

function scenarioOf(steps: readonly unknown[]): Scenario {
  return { id: ScenarioId.WhitelistList, steps: steps as readonly ScenarioStep[] }
}

describe('scenario validation', () => {
  it('accepts calls, client messages and waits that respect the contract', () => {
    const scenario = scenarioOf([
      OPEN_LIST,
      { kind: StepKind.Client, message: { type: ToPage.Intent, intent: Intent.Down, phase: IntentPhase.Press, source: InputSource.Pad } },
      { kind: StepKind.Client, message: { type: ToPage.OpenRadial } },
      { kind: StepKind.Wait, delayMs: WAIT_STEP_MS },
    ])
    expect(validateScenario(scenario)).toEqual([])
  })

  it('points each contract error at its step and argument', () => {
    const scenario = scenarioOf([OPEN_LIST, { ...OPEN_LIST, args: [{ ...LIST_PANEL, title: 'x'.repeat(LABEL_MAX_LENGTH + 1) }] }])
    expect(validateScenario(scenario)).toEqual([expect.objectContaining({ path: 'steps.1.args.0.title' })])
  })

  it('refuses an owner that cannot be namespaced', () => {
    expect(validateScenario(scenarioOf([{ ...OPEN_LIST, owner: 'white/list' }]))).toEqual([{ path: 'steps.0.owner', code: ContractErrorCode.BadIdentifier }])
  })

  it('refuses an unknown export with its name in the detail', () => {
    expect(validateScenario(scenarioOf([{ ...OPEN_LIST, name: 'openAll' }]))).toEqual([{ path: 'steps.0.args', code: ContractErrorCode.UnknownValue, detail: 'openAll' }])
  })

  it('refuses an export name that is not a string, and a client step without a message', () => {
    expect(validateScenario(scenarioOf([{ ...OPEN_LIST, name: 7 }, { kind: StepKind.Client, message: null }]))).toEqual([
      { path: 'steps.0.args', code: ContractErrorCode.UnknownValue, detail: '7' },
      { path: 'steps.1.message.type', code: ContractErrorCode.UnknownValue, detail: 'undefined' },
    ])
  })

  it('refuses a client message the client never sends', () => {
    const errors = validateScenario(scenarioOf([{ kind: StepKind.Client, message: { type: ToPage.OpenPanel } }]))
    expect(errors).toEqual([{ path: 'steps.0.message.type', code: ContractErrorCode.UnknownValue, detail: ToPage.OpenPanel }])
  })

  it('refuses a wait outside 0 to the maximum, or not an integer', () => {
    const errors = validateScenario(scenarioOf([
      { kind: StepKind.Wait, delayMs: -1 },
      { kind: StepKind.Wait, delayMs: WAIT_MAX_MS + 1 },
      { kind: StepKind.Wait, delayMs: 0.5 },
      { kind: StepKind.Wait, delayMs: WAIT_MAX_MS },
    ]))
    expect(errors.map((error) => error.path)).toEqual(['steps.0.delayMs', 'steps.1.delayMs', 'steps.2.delayMs'])
    expect(errors.every((error) => error.code === ContractErrorCode.OutOfRange)).toBe(true)
  })

  it('refuses an unknown step kind and a step that is not an object', () => {
    expect(validateScenario(scenarioOf([{ kind: 'jump' }, null]))).toEqual([
      { path: 'steps.0.kind', code: ContractErrorCode.UnknownValue },
      { path: 'steps.1.kind', code: ContractErrorCode.UnknownValue },
    ])
  })

  it('refuses steps that are not a list', () => {
    expect(validateScenario({ id: ScenarioId.Radial, steps: {} } as unknown as Scenario)).toEqual([{ path: 'steps', code: ContractErrorCode.WrongType }])
  })
})
