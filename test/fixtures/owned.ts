import { LOCAL_ID_MAX_LENGTH, OWNER_MAX_LENGTH } from '../../src/protocol/namespaced-id'
import type { OwnedConfirm, OwnedNotification, OwnedPanel, OwnedPrompt, OwnedRadialEntry } from '../../src/protocol/owned'
import { deepFrozen } from './frozen'
import { ADD_PANEL, LIST_PANEL } from './panels'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, KEYED_NOTIFICATION, PLAIN_NOTIFICATION, PRESS_PROMPT, REMOVE_CONFIRM, WHITELIST_RADIAL_ENTRY } from './surfaces'

export const FixtureOwner = Object.freeze({ Whitelist: 'whitelist', Garage: 'garage' } as const)

export const OWNED_LIST_PANEL: OwnedPanel = deepFrozen({ owner: FixtureOwner.Whitelist, panel: { ...LIST_PANEL, id: 'whitelist/list' } })

export const OWNED_ADD_PANEL: OwnedPanel = deepFrozen({ owner: FixtureOwner.Whitelist, panel: { ...ADD_PANEL, id: 'whitelist/add' } })

export const OWNED_REMOVE_CONFIRM: OwnedConfirm = deepFrozen({ owner: FixtureOwner.Whitelist, confirm: { ...REMOVE_CONFIRM, id: 'whitelist/remove-player-1' } })

export const OWNED_HOLD_PROMPT: OwnedPrompt = deepFrozen({ owner: FixtureOwner.Garage, prompt: { ...HOLD_PROMPT, id: 'garage/open-door' } })

export const OWNED_PRESS_PROMPT: OwnedPrompt = deepFrozen({ owner: FixtureOwner.Garage, prompt: { ...PRESS_PROMPT, id: 'garage/talk' } })

export const OWNED_WHITELIST_RADIAL_ENTRY: OwnedRadialEntry = deepFrozen({ owner: FixtureOwner.Whitelist, entry: { ...WHITELIST_RADIAL_ENTRY, id: 'whitelist/main' } })

export const OWNED_GARAGE_RADIAL_ENTRY: OwnedRadialEntry = deepFrozen({ owner: FixtureOwner.Garage, entry: { ...GARAGE_RADIAL_ENTRY, id: 'garage/main' } })

export const OWNED_KEYED_NOTIFICATION: OwnedNotification = deepFrozen({
  owner: FixtureOwner.Whitelist,
  notification: { ...KEYED_NOTIFICATION, key: 'whitelist/player-added' },
})

export const OWNED_PLAIN_NOTIFICATION: OwnedNotification = deepFrozen({ owner: FixtureOwner.Garage, notification: PLAIN_NOTIFICATION })

const TOO_LONG_OWNER = 'a'.repeat(OWNER_MAX_LENGTH + 1)
const TOO_LONG_LOCAL_ID = 'a'.repeat(LOCAL_ID_MAX_LENGTH + 1)

export const HOSTILE_NAMESPACED_IDS: readonly string[] = deepFrozen([
  '',
  '/',
  '//',
  'list',
  '/list',
  'whitelist/',
  'whitelist//list',
  'whitelist/list/',
  'whitelist/list/extra',
  'whitelist/List',
  'whitelist/__proto__',
  'whitelist/constructor',
  'whitelist/prototype',
  '__proto__/list',
  'constructor/list',
  'prototype/list',
  'toString/list',
  'hasOwnProperty/list',
  `${TOO_LONG_OWNER}/list`,
  `whitelist/${TOO_LONG_LOCAL_ID}`,
])
