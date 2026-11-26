import { KitExport } from '@openmemorykit/ui/contract'
import { Intent, Modality } from '../../src/protocol/intents'
import { ToPage } from '../../src/protocol/to-page'
import { WHITELIST_OWNER } from '../runtime/fake-whitelist'
import { ScenarioId, type ScenarioEntry } from '../runtime/types'
import { newPlayerForm } from './form'
import { call, client, entry, presses } from './steps'

const PARTIAL = { identifier: 'license:3fa09c', alias: '' }

const opened = [
  client({ type: ToPage.Modality, modality: Modality.Gamepad }),
  call(WHITELIST_OWNER, KitExport.OpenPanel, newPlayerForm(PARTIAL)),
  ...presses(Intent.Confirm),
]

export const KEYBOARD_SCENARIOS: readonly ScenarioEntry[] = [
  entry(ScenarioId.KeyboardLetters, opened),
  entry(ScenarioId.KeyboardAccents, [...opened, ...presses(Intent.TabNext)]),
  entry(ScenarioId.KeyboardSymbols, [...opened, ...presses(Intent.TabNext, Intent.TabNext)]),
]
