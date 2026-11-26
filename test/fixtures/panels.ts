import { ContractVersion, PanelKind } from '@openmemorykit/ui/contract'
import type { FormPanel, MenuPanel } from '@openmemorykit/ui/contract'
import { deepFrozen } from './frozen'
import {
  ADD_ACTION,
  COUNT_INFO,
  ENABLED_TOGGLE,
  IDENTIFIER_TEXT,
  NOTIFY_TOGGLE,
  PLAYER_LINK,
  PLAYERS_SECTION,
  PURGE_ACTION,
  REMOVE_ALL_ACTION,
  ROLE_CYCLE,
} from './items'

export const LIST_PANEL: MenuPanel = deepFrozen({
  version: ContractVersion.V1,
  kind: PanelKind.Menu,
  id: 'list',
  title: 'Whitelist',
  subtitle: 'Page 1 of 1',
  items: [ENABLED_TOGGLE, ADD_ACTION, PLAYERS_SECTION, PLAYER_LINK, COUNT_INFO, PURGE_ACTION, REMOVE_ALL_ACTION],
  emptyText: 'No player yet',
})

export const ADD_PANEL: FormPanel = deepFrozen({
  version: ContractVersion.V1,
  kind: PanelKind.Form,
  id: 'add',
  title: 'Add a player',
  submitLabel: 'Add',
  items: [IDENTIFIER_TEXT, ROLE_CYCLE, NOTIFY_TOGGLE],
})
