import type { ScenarioCatalog, ScenarioEntry } from '../runtime/types'
import { FORM_SCENARIOS } from './form'
import { KEYBOARD_SCENARIOS } from './keyboard'
import { LIST_SCENARIOS } from './list'
import { RADIAL_SCENARIOS } from './radial'
import { SURFACE_SCENARIOS } from './surfaces'

const ENTRIES: readonly ScenarioEntry[] = [...RADIAL_SCENARIOS, ...LIST_SCENARIOS, ...FORM_SCENARIOS, ...KEYBOARD_SCENARIOS, ...SURFACE_SCENARIOS]

export const SCENARIO_CATALOG: ScenarioCatalog = new Map(ENTRIES.map((scenarioEntry) => [scenarioEntry.scenario.id, scenarioEntry] as const))
