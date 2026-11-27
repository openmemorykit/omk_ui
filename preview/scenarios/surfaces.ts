import { ContractVersion, KitExport, NotificationTone, PromptMode, type Notification } from '@openmemorykit/ui/contract'
import { PromptState } from '../../src/protocol/page-vocabulary'
import { namespaceId } from '../../src/protocol/namespaced-id'
import { ToPage } from '../../src/protocol/to-page'
import { createFakeWhitelist, createPlayers, DEFAULT_PLAYER_COUNT, listPanel, removeConfirm, WHITELIST_OWNER, type Player } from '../runtime/fake-whitelist'
import { ScenarioId, type ScenarioEntry } from '../runtime/types'
import { call, client, entry, Owner } from './steps'

const TOAST_DURATION_MS = 15_000
const HOLD_MS = 1200
const FIRST_PAGE = 1
const PROMPT_ID = 'open-door'
const SECOND_PLAYER = createPlayers(DEFAULT_PLAYER_COUNT)[1] as Player

function toast(tone: NotificationTone, title: string, text?: string): Notification {
  const base = { version: ContractVersion.V1, tone, title, durationMs: TOAST_DURATION_MS }
  return text === undefined ? base : { ...base, text }
}

const toasts = [
  call(Owner.Phone, KitExport.Notify, toast(NotificationTone.Info, 'Connexion rétablie')),
  call(WHITELIST_OWNER, KitExport.Notify, toast(NotificationTone.Success, 'Joueur ajouté', 'Alex peut rejoindre le serveur.')),
  call(WHITELIST_OWNER, KitExport.Notify, toast(NotificationTone.Warning, 'Whitelist désactivée')),
  call(Owner.Garage, KitExport.Notify, toast(NotificationTone.Error, 'Synchronisation échouée', 'Le garage ne répond pas, réessaie plus tard.')),
  call(Owner.Phone, KitExport.Notify, toast(NotificationTone.Info, 'Nouveau message')),
  call(Owner.Jobs, KitExport.Notify, toast(NotificationTone.Success, 'Service pris')),
]

const holdPrompt = call(Owner.Garage, KitExport.ShowPrompt, { version: ContractVersion.V1, id: PROMPT_ID, label: 'Ouvrir le garage', mode: PromptMode.Hold, holdMs: HOLD_MS })

export const SURFACE_SCENARIOS: readonly ScenarioEntry[] = [
  entry(
    ScenarioId.ConfirmDanger,
    [
      call(WHITELIST_OWNER, KitExport.OpenPanel, listPanel(createPlayers(DEFAULT_PLAYER_COUNT), true, FIRST_PAGE)),
      call(WHITELIST_OWNER, KitExport.Confirm, removeConfirm(SECOND_PLAYER)),
    ],
    new Map([[WHITELIST_OWNER, createFakeWhitelist()]]),
  ),
  entry(ScenarioId.Toasts, toasts),
  entry(ScenarioId.PromptHold, [
    holdPrompt,
    client({ type: ToPage.PromptProgress, promptId: namespaceId(Owner.Garage, PROMPT_ID), state: PromptState.Holding, holdMs: HOLD_MS }),
  ]),
]
