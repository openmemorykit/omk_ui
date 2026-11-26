import {
  ActionVariant,
  BadgeTone,
  ContractVersion,
  FormOutcome,
  IconName,
  ItemKind,
  KitExport,
  NotificationTone,
  PanelKind,
  ReplyKind,
  RuleKind,
  TextFormat,
  type ConfirmRequest,
  type FormPanel,
  type FormResult,
  type Item,
  type MenuPanel,
  type Notification,
  type RadialEntry,
  type Reply,
} from '@openmemorykit/ui/contract'
import type { FakeKit, FakeResource, FakeResourceFactory } from './types'

export const PAGE_SIZE = 50
export const DEFAULT_PLAYER_COUNT = 342
export const IDENTIFIER_MAX_LENGTH = 64
export const WHITELIST_OWNER = 'whitelist'

export const WhitelistPanel = { List: 'list', Add: 'add' } as const
export const WhitelistItem = { Enabled: 'enabled', Add: 'add', Players: 'players', PreviousPage: 'previous-page', NextPage: 'next-page' } as const
export const WhitelistField = { Identifier: 'identifier' } as const

export interface Player {
  readonly id: string
  readonly name: string
  readonly identifier: string
  readonly pending: boolean
}

interface WhitelistState {
  readonly players: readonly Player[]
  readonly enabled: boolean
  readonly page: number
  readonly nextIndex: number
}

export interface FakeWhitelistOptions { readonly playerCount?: number }

const FIRST_NAMES = ['Alex', 'Camille', 'Sasha', 'Noa', 'Eli', 'Maya', 'Lou', 'Jules', 'Inès', 'Rémi', 'Zoé', 'Nino']
const LAST_NAMES = ['Moreau', 'Laurent', 'Girard', 'Roux', 'Fabre', 'Perrin', 'Garnier', 'Chevalier', 'Masson']
const PLAYER_ID_PREFIX = 'player-'
const REMOVE_PREFIX = 'remove-'
const ID_DIGITS = 4
const HEX_RADIX = 16
const HEX_DIGITS = 8
const FIRST_HASH = 0x9e3779b1
const SECOND_HASH = 0x85ebca6b
const PENDING_EVERY = 7
const VALUE_LENGTH = 14
const PLAYER_IDENTIFIER = /^[a-z0-9]{2,16}:[0-9A-Za-z._-]{1,64}$/
const FIRST_PAGE = 1

const Label = {
  title: 'Whitelist',
  enabled: 'Whitelist active',
  add: 'Ajouter un joueur',
  players: 'Joueurs autorisés',
  next: 'Page suivante',
  previous: 'Page précédente',
  empty: 'Aucun joueur autorisé',
  duplicate: 'Cet identifiant est déjà autorisé',
  invalid: 'Identifiant invalide',
} as const

export const WHITELIST_RADIAL_ENTRY: RadialEntry = Object.freeze({
  version: ContractVersion.V1,
  id: WHITELIST_OWNER,
  label: 'Whitelist',
  description: 'Gérer les joueurs autorisés',
  icon: IconName.Shield,
  children: [
    { id: 'list', label: 'Joueurs', description: 'Joueurs autorisés', icon: IconName.Users },
    { id: 'add', label: 'Ajouter', description: 'Autoriser un joueur', icon: IconName.Plus },
  ],
})

const hex = (value: number): string => (value >>> 0).toString(HEX_RADIX).padStart(HEX_DIGITS, '0')

function playerAt(index: number): Player {
  const first = FIRST_NAMES[index % FIRST_NAMES.length] ?? ''
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length] ?? ''
  const id = `${PLAYER_ID_PREFIX}${String(index).padStart(ID_DIGITS, '0')}`
  return { id, name: `${first} ${last}`, identifier: `license:${hex(Math.imul(index, FIRST_HASH))}${hex(Math.imul(index, SECOND_HASH))}`, pending: index % PENDING_EVERY === 0 }
}

export function createPlayers(count: number): readonly Player[] {
  return Array.from({ length: count }, (_unused, position) => playerAt(position + 1))
}

export function playerItem(player: Player): Item {
  const badge = player.pending ? { tone: BadgeTone.Warning, label: 'En attente' } : { tone: BadgeTone.Success, label: 'Actif' }
  return { kind: ItemKind.Link, id: player.id, label: player.name, description: player.identifier, value: player.identifier.slice(0, VALUE_LENGTH), badge }
}

const pageCountOf = (count: number): number => Math.max(FIRST_PAGE, Math.ceil(count / PAGE_SIZE))
const plural = (count: number, word: string): string => `${count} ${word}${count > 1 ? 's' : ''}`

function pagingLink(id: string, label: string, value: string): Item {
  return { kind: ItemKind.Link, id, label, value }
}

export function listPanel(players: readonly Player[], enabled: boolean, requestedPage: number): MenuPanel {
  const pageCount = pageCountOf(players.length)
  const page = Math.min(Math.max(requestedPage, FIRST_PAGE), pageCount)
  const start = (page - FIRST_PAGE) * PAGE_SIZE
  const previous = page > FIRST_PAGE ? [pagingLink(WhitelistItem.PreviousPage, Label.previous, `${page - 1}/${pageCount}`)] : []
  const next = page < pageCount ? [pagingLink(WhitelistItem.NextPage, Label.next, `${page + 1}/${pageCount}`)] : []
  return {
    version: ContractVersion.V1,
    kind: PanelKind.Menu,
    id: WhitelistPanel.List,
    title: Label.title,
    subtitle: `Page ${page} sur ${pageCount} · ${plural(players.length, 'joueur')}`,
    items: [
      { kind: ItemKind.Toggle, id: WhitelistItem.Enabled, label: Label.enabled, icon: IconName.Power, value: enabled },
      { kind: ItemKind.Action, id: WhitelistItem.Add, label: Label.add, icon: IconName.Plus, variant: ActionVariant.Primary },
      { kind: ItemKind.Section, id: WhitelistItem.Players, label: Label.players },
      ...previous,
      ...players.slice(start, start + PAGE_SIZE).map(playerItem),
      ...next,
    ],
    emptyText: Label.empty,
  }
}

export function addPanel(): FormPanel {
  return {
    version: ContractVersion.V1,
    kind: PanelKind.Form,
    id: WhitelistPanel.Add,
    title: Label.add,
    submitLabel: 'Ajouter',
    items: [
      {
        kind: ItemKind.Text,
        id: WhitelistField.Identifier,
        label: 'Identifiant',
        value: '',
        maxLength: IDENTIFIER_MAX_LENGTH,
        placeholder: 'license:0123abcd',
        rules: [{ kind: RuleKind.Required }, { kind: RuleKind.Format, format: TextFormat.PlayerIdentifier }],
      },
    ],
  }
}

export function removeConfirm(player: Player): ConfirmRequest {
  return {
    version: ContractVersion.V1,
    id: `${REMOVE_PREFIX}${player.id}`,
    title: `Retirer ${player.name} ?`,
    text: `${player.name} ne pourra plus rejoindre le serveur.`,
    confirmLabel: 'Retirer',
    cancelLabel: 'Garder',
    danger: true,
  }
}

function notice(tone: NotificationTone, title: string, text?: string): Notification {
  return text === undefined ? { version: ContractVersion.V1, tone, title } : { version: ContractVersion.V1, tone, title, text }
}

const initialState = (playerCount: number): WhitelistState =>
  ({ players: createPlayers(playerCount), enabled: true, page: FIRST_PAGE, nextIndex: playerCount + 1 })

function fieldOf(values: Readonly<Record<string, unknown>>, name: string): unknown {
  return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : undefined
}

function refusal(message: string): FormResult {
  return { outcome: FormOutcome.Rejected, fieldErrors: { [WhitelistField.Identifier]: message } }
}

function judge(state: WhitelistState, value: unknown): FormResult {
  if (typeof value !== 'string' || !PLAYER_IDENTIFIER.test(value)) return refusal(Label.invalid)
  const known = state.players.some((player) => player.identifier.toLowerCase() === value.toLowerCase())
  return known ? refusal(Label.duplicate) : { outcome: FormOutcome.Accepted }
}

class Whitelist implements FakeResource {
  private state: WhitelistState

  constructor(private readonly kit: FakeKit, playerCount: number) {
    this.state = initialState(playerCount)
  }

  call(name: string, payload: unknown): unknown {
    return this.kit.call(name, payload)
  }

  onReply(reply: Reply): void {
    switch (reply.kind) {
      case ReplyKind.ItemSelected:
        return reply.panelId === WhitelistPanel.List ? this.selected(reply.itemId) : undefined
      case ReplyKind.ValueChanged:
        return reply.panelId === WhitelistPanel.List ? this.toggled(reply.itemId, reply.value) : undefined
      case ReplyKind.FormSubmitted:
        return this.submitted(reply.panelId, reply.submissionId, reply.values)
      case ReplyKind.ConfirmAnswered:
        return this.answered(reply.confirmId, reply.confirmed)
      case ReplyKind.RadialSelected:
        return this.radial(reply.childId)
      default:
    }
  }

  private send(name: KitExport, ...args: readonly unknown[]): void {
    this.kit.call(name, args)
  }

  private refresh(next: WhitelistState, notification?: Notification): void {
    this.state = { ...next, page: Math.min(next.page, pageCountOf(next.players.length)) }
    this.send(KitExport.UpdatePanel, listPanel(this.state.players, this.state.enabled, this.state.page))
    if (notification !== undefined) this.send(KitExport.Notify, notification)
  }

  private selected(itemId: string): void {
    const { page, players } = this.state
    const target = itemId === WhitelistItem.PreviousPage ? page - 1 : itemId === WhitelistItem.NextPage ? page + 1 : page
    const player = players.find((candidate) => candidate.id === itemId)
    if (itemId === WhitelistItem.Add) this.send(KitExport.PushPanel, addPanel(), WhitelistPanel.List)
    else if (player !== undefined) this.send(KitExport.Confirm, removeConfirm(player))
    else if (target !== page && target >= FIRST_PAGE && target <= pageCountOf(players.length)) this.refresh({ ...this.state, page: target })
  }

  private toggled(itemId: string, value: unknown): void {
    if (itemId !== WhitelistItem.Enabled || typeof value !== 'boolean') return
    const title = value ? 'Whitelist activée' : 'Whitelist désactivée'
    this.state = { ...this.state, enabled: value }
    this.send(KitExport.Notify, notice(value ? NotificationTone.Success : NotificationTone.Warning, title))
  }

  private submitted(panelId: string, submissionId: number, values: Readonly<Record<string, unknown>>): void {
    if (panelId !== WhitelistPanel.Add) return
    const value = fieldOf(values, WhitelistField.Identifier)
    const result = judge(this.state, value)
    this.send(KitExport.ResolveForm, panelId, submissionId, result)
    if (result.outcome !== FormOutcome.Accepted || typeof value !== 'string') return
    const added: Player = { ...playerAt(this.state.nextIndex), identifier: value, pending: true, name: `Joueur ${this.state.nextIndex}` }
    this.refresh(
      { ...this.state, players: [...this.state.players, added], nextIndex: this.state.nextIndex + 1 },
      notice(NotificationTone.Success, 'Joueur ajouté', `${value} peut rejoindre le serveur.`),
    )
  }

  private answered(confirmId: string, confirmed: boolean): void {
    const playerId = confirmId.startsWith(REMOVE_PREFIX) ? confirmId.slice(REMOVE_PREFIX.length) : ''
    const player = this.state.players.find((candidate) => candidate.id === playerId)
    if (!confirmed || player === undefined) return
    this.refresh({ ...this.state, players: this.state.players.filter((candidate) => candidate !== player) }, notice(NotificationTone.Success, 'Joueur retiré', `${player.name} ne peut plus rejoindre le serveur.`))
  }

  private radial(childId: string | undefined): void {
    this.state = { ...this.state, page: FIRST_PAGE }
    this.send(KitExport.OpenPanel, listPanel(this.state.players, this.state.enabled, this.state.page))
    if (childId === WhitelistPanel.Add) this.send(KitExport.PushPanel, addPanel(), WhitelistPanel.List)
  }
}

export function createFakeWhitelist({ playerCount = DEFAULT_PLAYER_COUNT }: FakeWhitelistOptions = {}): FakeResourceFactory {
  return (kit) => new Whitelist(kit, playerCount)
}

