import { ContractVersion, IconName, NotificationTone, PromptMode } from '@openmemorykit/ui/contract'
import type { ConfirmRequest, Notification, Prompt, RadialEntry } from '@openmemorykit/ui/contract'
import { deepFrozen } from './frozen'

export const HOLD_PROMPT_MS = 1200

export const REMOVE_CONFIRM: ConfirmRequest = deepFrozen({
  version: ContractVersion.V1,
  id: 'remove-player-1',
  title: 'Remove Alex?',
  text: 'Alex will no longer join the server.',
  confirmLabel: 'Remove',
  danger: true,
})

export const HOLD_PROMPT: Prompt = deepFrozen({ version: ContractVersion.V1, id: 'open-door', label: 'Open the garage', mode: PromptMode.Hold, holdMs: HOLD_PROMPT_MS })

export const PRESS_PROMPT: Prompt = deepFrozen({ version: ContractVersion.V1, id: 'talk', label: 'Talk to the guard', mode: PromptMode.Press })

export const WHITELIST_RADIAL_ENTRY: RadialEntry = deepFrozen({
  version: ContractVersion.V1,
  id: 'main',
  label: 'Whitelist',
  description: 'Manage allowed players',
  icon: IconName.Shield,
  children: [
    { id: 'list', label: 'Players', description: 'Allowed players', icon: IconName.Users },
    { id: 'add', label: 'Add', description: 'Allow a player', icon: IconName.Plus },
  ],
})

export const GARAGE_RADIAL_ENTRY: RadialEntry = deepFrozen({
  version: ContractVersion.V1,
  id: 'main',
  label: 'Garage',
  description: 'Take out a vehicle',
  icon: IconName.List,
})

export const KEYED_NOTIFICATION: Notification = deepFrozen({
  version: ContractVersion.V1,
  tone: NotificationTone.Success,
  title: 'Player added',
  text: 'Alex can join the server.',
  key: 'player-added',
})

export const PLAIN_NOTIFICATION: Notification = deepFrozen({ version: ContractVersion.V1, tone: NotificationTone.Info, title: 'Garage ready' })
