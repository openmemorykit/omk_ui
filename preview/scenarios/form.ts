import { ContractVersion, ItemKind, KitExport, PanelKind, RuleKind, TextFormat, type FormPanel as FormPanelShape } from '@openmemorykit/ui/contract'
import { Intent } from '../../src/protocol/intents'
import { IDENTIFIER_MAX_LENGTH, WHITELIST_OWNER } from '../runtime/fake-whitelist'
import { ScenarioId, type ScenarioEntry } from '../runtime/types'
import { call, entry, presses } from './steps'

export interface FormValues { readonly identifier: string; readonly alias: string }

const ALIAS_MAX_LENGTH = 24
const ALIAS_MIN_LENGTH = 3
const BLANK: FormValues = { identifier: '', alias: '' }
const FILLED: FormValues = { identifier: 'license:3fa09c11d7', alias: 'Alex' }

export function newPlayerForm(values: FormValues): FormPanelShape {
  return {
    version: ContractVersion.V1,
    kind: PanelKind.Form,
    id: 'new-player',
    title: 'Nouveau joueur',
    submitLabel: 'Ajouter',
    items: [
      {
        kind: ItemKind.Text,
        id: 'identifier',
        label: 'Identifiant',
        value: values.identifier,
        maxLength: IDENTIFIER_MAX_LENGTH,
        placeholder: 'license:0123abcd',
        rules: [{ kind: RuleKind.Required }, { kind: RuleKind.Format, format: TextFormat.PlayerIdentifier }],
      },
      {
        kind: ItemKind.Text,
        id: 'alias',
        label: 'Pseudo',
        value: values.alias,
        maxLength: ALIAS_MAX_LENGTH,
        rules: [{ kind: RuleKind.Required }, { kind: RuleKind.MinLength, min: ALIAS_MIN_LENGTH }],
      },
      {
        kind: ItemKind.Cycle,
        id: 'role',
        label: 'Rôle',
        value: 'player',
        options: [{ id: 'player', label: 'Joueur' }, { id: 'vip', label: 'VIP' }, { id: 'staff', label: 'Équipe' }],
      },
    ],
  }
}

const submitFromTop = presses(Intent.Down, Intent.Down, Intent.Down, Intent.Confirm)

export const FORM_SCENARIOS: readonly ScenarioEntry[] = [
  entry(ScenarioId.FormErrors, [call(WHITELIST_OWNER, KitExport.OpenPanel, newPlayerForm(BLANK)), submitFromTop]),
  entry(ScenarioId.FormPending, [call(WHITELIST_OWNER, KitExport.OpenPanel, newPlayerForm(FILLED)), submitFromTop]),
]
