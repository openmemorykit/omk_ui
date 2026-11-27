import { ActionVariant, ContractVersion, IconName, ItemKind, KitExport, PanelKind, type MenuPanel } from '@openmemorykit/ui/contract'
import { Intent, Modality } from '../../src/protocol/intents'
import { ToPage } from '../../src/protocol/to-page'
import { createFakeWhitelist, createPlayers, DEFAULT_PLAYER_COUNT, listPanel, playerItem, WHITELIST_OWNER, WHITELIST_RADIAL_ENTRY } from '../runtime/fake-whitelist'
import { ScenarioId, type ScenarioEntry } from '../runtime/types'
import { call, client, entry, Owner, press } from './steps'

const LONG_LIST_ROWS = 1000
const FIRST_PAGE = 1

const whitelistResources = (): ReadonlyMap<string, ReturnType<typeof createFakeWhitelist>> => new Map([[WHITELIST_OWNER, createFakeWhitelist()]])

const longList: MenuPanel = {
  version: ContractVersion.V1,
  kind: PanelKind.Menu,
  id: 'all-players',
  title: 'Tous les joueurs',
  subtitle: `${LONG_LIST_ROWS} joueurs`,
  items: createPlayers(LONG_LIST_ROWS).map(playerItem),
}

const toolsPanel: MenuPanel = {
  version: ContractVersion.V1,
  kind: PanelKind.Menu,
  id: 'tools',
  title: 'Outils',
  items: [
    { kind: ItemKind.Action, id: 'add', label: 'Ajouter un joueur', icon: IconName.Plus, variant: ActionVariant.Primary },
    { kind: ItemKind.Action, id: 'purge', label: 'Purger les inactifs', icon: IconName.Trash, disabled: { reason: 'Aucun joueur inactif à purger' } },
    { kind: ItemKind.Action, id: 'export', label: 'Exporter la liste', icon: IconName.List, disabled: { reason: 'Réservé aux administrateurs' } },
  ],
}

const registrations = [
  call(Owner.Garage, KitExport.AddRadialEntry, { version: ContractVersion.V1, id: Owner.Garage, label: 'Garage', description: 'Sortir un véhicule', icon: IconName.List }),
  call(Owner.Phone, KitExport.AddRadialEntry, { version: ContractVersion.V1, id: Owner.Phone, label: 'Téléphone', description: 'Ouvrir les contacts', icon: IconName.User }),
  call(WHITELIST_OWNER, KitExport.AddRadialEntry, WHITELIST_RADIAL_ENTRY),
]

export const LIST_SCENARIOS: readonly ScenarioEntry[] = [
  entry(ScenarioId.WhitelistList, [call(WHITELIST_OWNER, KitExport.OpenPanel, listPanel(createPlayers(DEFAULT_PLAYER_COUNT), true, FIRST_PAGE))], whitelistResources()),
  entry(
    ScenarioId.Whitelist,
    [registrations, client({ type: ToPage.Modality, modality: Modality.Gamepad }), client({ type: ToPage.OpenRadial })],
    whitelistResources(),
  ),
  entry(ScenarioId.LongList, [call(WHITELIST_OWNER, KitExport.OpenPanel, longList)]),
  entry(ScenarioId.DisabledFocused, [call(WHITELIST_OWNER, KitExport.OpenPanel, toolsPanel), press(Intent.Down)]),
]
