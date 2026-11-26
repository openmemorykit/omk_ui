import { ContractVersion, IconName, KitExport, type RadialEntry } from '@openmemorykit/ui/contract'
import { Intent, Modality } from '../../src/protocol/intents'
import { ToPage } from '../../src/protocol/to-page'
import { createFakeWhitelist, WHITELIST_OWNER, WHITELIST_RADIAL_ENTRY } from '../runtime/fake-whitelist'
import { ScenarioId, type ScenarioEntry } from '../runtime/types'
import { call, client, entry, Owner, press } from './steps'

function sector(id: string, label: string, description: string, icon: IconName): RadialEntry {
  return { version: ContractVersion.V1, id, label, description, icon }
}

const OTHER_ENTRIES: readonly (readonly [string, RadialEntry])[] = [
  [Owner.Garage, sector(Owner.Garage, 'Garage', 'Sortir un véhicule', IconName.List)],
  [Owner.Phone, sector(Owner.Phone, 'Téléphone', 'Ouvrir les contacts', IconName.User)],
  [Owner.Jobs, sector(Owner.Jobs, 'Métiers', 'Choisir un service', IconName.Users)],
  [Owner.Settings, sector(Owner.Settings, 'Réglages', 'Modifier les options', IconName.Settings)],
]

const registrations = [
  ...OTHER_ENTRIES.map(([owner, radial]) => call(owner, KitExport.AddRadialEntry, radial)),
  call(WHITELIST_OWNER, KitExport.AddRadialEntry, WHITELIST_RADIAL_ENTRY),
]

const opening = [client({ type: ToPage.Modality, modality: Modality.Gamepad }), client({ type: ToPage.OpenRadial })]
const resources = (): ReadonlyMap<string, ReturnType<typeof createFakeWhitelist>> => new Map([[WHITELIST_OWNER, createFakeWhitelist()]])

export const RADIAL_SCENARIOS: readonly ScenarioEntry[] = [
  entry(ScenarioId.Radial, [registrations, opening], resources()),
  entry(ScenarioId.RadialChildren, [registrations, opening, press(Intent.Left), press(Intent.Confirm)], resources()),
]
