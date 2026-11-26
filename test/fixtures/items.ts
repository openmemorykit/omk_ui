import { ActionVariant, BadgeTone, IconName, ItemKind, RuleKind, TextFormat } from '@openmemorykit/ui/contract'
import type { Item } from '@openmemorykit/ui/contract'
import { deepFrozen } from './frozen'

export type ItemOf<Kind extends ItemKind> = Extract<Item, { readonly kind: Kind }>

export const IDENTIFIER_FIELD_MAX_LENGTH = 64

export const ENABLED_TOGGLE: ItemOf<typeof ItemKind.Toggle> = deepFrozen({
  kind: ItemKind.Toggle,
  id: 'enabled',
  label: 'Whitelist enabled',
  value: true,
})

export const ADD_ACTION: ItemOf<typeof ItemKind.Action> = deepFrozen({
  kind: ItemKind.Action,
  id: 'add',
  label: 'Add a player',
  icon: IconName.Plus,
  variant: ActionVariant.Primary,
})

export const PLAYERS_SECTION: ItemOf<typeof ItemKind.Section> = deepFrozen({ kind: ItemKind.Section, id: 'players', label: 'Players' })

export const PLAYER_LINK: ItemOf<typeof ItemKind.Link> = deepFrozen({
  kind: ItemKind.Link,
  id: 'player-1',
  label: 'Alex',
  description: 'license:0123abcd',
  value: 'Online',
  badge: { tone: BadgeTone.Success, label: 'Staff' },
})

export const COUNT_INFO: ItemOf<typeof ItemKind.Info> = deepFrozen({ kind: ItemKind.Info, id: 'count', label: 'Allowed players', value: '1' })

export const PURGE_ACTION: ItemOf<typeof ItemKind.Action> = deepFrozen({
  kind: ItemKind.Action,
  id: 'purge',
  label: 'Purge inactive players',
  icon: IconName.Trash,
  disabled: { reason: 'No inactive player' },
})

export const REMOVE_ALL_ACTION: ItemOf<typeof ItemKind.Action> = deepFrozen({
  kind: ItemKind.Action,
  id: 'remove-all',
  label: 'Remove every player',
  variant: ActionVariant.Danger,
  confirm: { title: 'Remove every player?', text: 'The whitelist will be empty.', confirmLabel: 'Remove', cancelLabel: 'Keep', danger: true },
})

export const IDENTIFIER_TEXT: ItemOf<typeof ItemKind.Text> = deepFrozen({
  kind: ItemKind.Text,
  id: 'identifier',
  label: 'Identifier',
  value: '',
  maxLength: IDENTIFIER_FIELD_MAX_LENGTH,
  placeholder: 'license:0123abcd',
  rules: [{ kind: RuleKind.Required }, { kind: RuleKind.Format, format: TextFormat.PlayerIdentifier }],
})

export const ROLE_CYCLE: ItemOf<typeof ItemKind.Cycle> = deepFrozen({
  kind: ItemKind.Cycle,
  id: 'role',
  label: 'Role',
  options: [{ id: 'member', label: 'Member' }, { id: 'staff', label: 'Staff' }],
  value: 'member',
})

export const NOTIFY_TOGGLE: ItemOf<typeof ItemKind.Toggle> = deepFrozen({ kind: ItemKind.Toggle, id: 'notify', label: 'Notify the player', value: false })

export const ITEM_BY_KIND: Readonly<{ [Kind in ItemKind]: ItemOf<Kind> }> = deepFrozen({
  [ItemKind.Action]: ADD_ACTION,
  [ItemKind.Link]: PLAYER_LINK,
  [ItemKind.Info]: COUNT_INFO,
  [ItemKind.Cycle]: ROLE_CYCLE,
  [ItemKind.Toggle]: ENABLED_TOGGLE,
  [ItemKind.Text]: IDENTIFIER_TEXT,
  [ItemKind.Section]: PLAYERS_SECTION,
})
