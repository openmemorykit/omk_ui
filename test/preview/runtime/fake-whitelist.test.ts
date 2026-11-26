import {
  CALL_DONE,
  CloseReason,
  FormOutcome,
  FormPanelSchema,
  ItemKind,
  KitExport,
  MenuPanelSchema,
  NotificationTone,
  ReplyKind,
  type CallResult,
  type ConfirmRequest,
  type FormPanel,
  type FormResult,
  type MenuPanel,
  type Notification,
  type Reply,
} from '@openmemorykit/ui/contract'
import { validateContract, ValidationStatus } from '@openmemorykit/ui/validation'
import { describe, expect, it } from 'vitest'
import {
  addPanel,
  createFakeWhitelist,
  createPlayers,
  listPanel,
  PAGE_SIZE,
  removeConfirm,
  WhitelistField,
  WhitelistItem,
  WhitelistPanel,
  WHITELIST_RADIAL_ENTRY,
} from '../../../preview/runtime/fake-whitelist'
import type { FakeKit, FakeResource } from '../../../preview/runtime/types'

const SMALL_COUNT = 120
const FULL_COUNT = 342
const PAGES_OF_SMALL = 3
const PAGES_OF_FULL = 7
const SECOND_PAGE_FIRST = 'player-0051'
const FIRST_SUBMISSION = 4
const OVERFLOW_COUNT = PAGE_SIZE + 1
const PLAYER_ITEMS_PER_PAGE = PAGE_SIZE
const CHROME_ITEMS = 3
const RESULT_ARGUMENT = 2
const ID_DIGITS = 4
const MIDDLE_PAGE = 2
const SUBMISSION_ARGUMENTS = 2
const NOT_TEXT = 42
const REMOVED_ID = 'player-0003'

interface Call { readonly name: string; readonly args: readonly unknown[] }
interface Setup { readonly resource: FakeResource; readonly calls: Call[]; readonly clear: () => void }

function setup(playerCount = SMALL_COUNT): Setup {
  const calls: Call[] = []
  const kit: FakeKit = {
    call(name, args): CallResult {
      calls.push({ name, args: args as readonly unknown[] })
      return CALL_DONE
    },
  }
  return { resource: createFakeWhitelist({ playerCount })(kit), calls, clear: () => void calls.splice(0) }
}

const select = (itemId: string): Reply => ({ kind: ReplyKind.ItemSelected, panelId: WhitelistPanel.List, itemId })
const submit = (identifier: unknown, submissionId = FIRST_SUBMISSION): Reply =>
  ({ kind: ReplyKind.FormSubmitted, panelId: WhitelistPanel.Add, submissionId, values: { [WhitelistField.Identifier]: identifier } as Record<string, string> })
const answer = (confirmId: string, confirmed: boolean): Reply => ({ kind: ReplyKind.ConfirmAnswered, confirmId, confirmed })

const callsOf = (calls: readonly Call[], name: string): readonly Call[] => calls.filter((call) => call.name === name)
const firstArg = <Shape>(call: Call | undefined): Shape => call?.args[0] as Shape
const notifications = (calls: readonly Call[]): readonly Notification[] => callsOf(calls, KitExport.Notify).map((call) => firstArg<Notification>(call))
const lastUpdate = (calls: readonly Call[]): MenuPanel => firstArg<MenuPanel>(callsOf(calls, KitExport.UpdatePanel).slice(-1)[0])
const resolution = (calls: readonly Call[]): FormResult => callsOf(calls, KitExport.ResolveForm)[0]?.args[RESULT_ARGUMENT] as FormResult
const playerRows = (panel: MenuPanel): number => panel.items.filter((item) => item.id.startsWith('player-')).length

describe('fake whitelist panels', () => {
  it('builds list pages the contract accepts, with a counter in the subtitle', () => {
    const players = createPlayers(FULL_COUNT)
    const first = listPanel(players, true, 1)
    expect(validateContract(MenuPanelSchema, first).status).toBe(ValidationStatus.Accepted)
    expect(first.subtitle).toBe(`Page 1 sur ${PAGES_OF_FULL} · ${FULL_COUNT} joueurs`)
    expect(playerRows(first)).toBe(PAGE_SIZE)
    expect(first.items.map((item) => item.id).slice(0, CHROME_ITEMS)).toEqual([WhitelistItem.Enabled, WhitelistItem.Add, 'players'])
    expect(first.items.slice(-1)[0]).toMatchObject({ kind: ItemKind.Link, id: WhitelistItem.NextPage, value: `2/${PAGES_OF_FULL}` })
    expect(first.items.some((item) => item.id === WhitelistItem.PreviousPage)).toBe(false)
  })

  it('puts a previous link on the middle pages and none after the last', () => {
    const players = createPlayers(FULL_COUNT)
    const middle = listPanel(players, true, MIDDLE_PAGE)
    expect(middle.items.some((item) => item.id === WhitelistItem.PreviousPage)).toBe(true)
    expect(middle.items.some((item) => item.id === WhitelistItem.NextPage)).toBe(true)
    const last = listPanel(players, true, PAGES_OF_FULL)
    expect(last.items.some((item) => item.id === WhitelistItem.NextPage)).toBe(false)
    expect(playerRows(last)).toBe(FULL_COUNT - PAGE_SIZE * (PAGES_OF_FULL - 1))
  })

  it('builds an empty list with a single page', () => {
    const empty = listPanel([], false, 1)
    expect(empty.subtitle).toBe('Page 1 sur 1 · 0 joueur')
    expect(playerRows(empty)).toBe(0)
    expect(empty.items[0]).toMatchObject({ id: WhitelistItem.Enabled, value: false })
  })

  it('builds players with unique identifiers and unique ids', () => {
    const players = createPlayers(FULL_COUNT)
    expect(new Set(players.map((player) => player.id)).size).toBe(FULL_COUNT)
    expect(new Set(players.map((player) => player.identifier)).size).toBe(FULL_COUNT)
  })

  it('builds an add form the contract accepts and a danger confirmation', () => {
    expect(validateContract(FormPanelSchema, addPanel()).status).toBe(ValidationStatus.Accepted)
    const [first] = createPlayers(1)
    const confirm: ConfirmRequest | undefined = first === undefined ? undefined : removeConfirm(first)
    expect(confirm).toMatchObject({ id: `remove-${first?.id}`, danger: true })
    expect(WHITELIST_RADIAL_ENTRY.children?.map((child) => child.id)).toEqual(['list', 'add'])
  })
})

describe('fake whitelist resource', () => {
  it('forwards the calls it receives to the kit', () => {
    const { resource, calls } = setup()
    const result = resource.call(KitExport.Notify, [{ version: 1 }])
    expect(result).toBe(CALL_DONE)
    expect(calls).toEqual([{ name: KitExport.Notify, args: [{ version: 1 }] }])
  })

  it('moves to the next page then back, keeping the counter', () => {
    const { resource, calls } = setup()
    resource.onReply(select(WhitelistItem.NextPage))
    const second = lastUpdate(calls)
    expect(second.subtitle).toBe(`Page 2 sur ${PAGES_OF_SMALL} · ${SMALL_COUNT} joueurs`)
    expect(second.items.some((item) => item.id === SECOND_PAGE_FIRST)).toBe(true)
    resource.onReply(select(WhitelistItem.PreviousPage))
    expect(lastUpdate(calls).subtitle).toBe(`Page 1 sur ${PAGES_OF_SMALL} · ${SMALL_COUNT} joueurs`)
  })

  it('ignores a stale paging link past the first or last page', () => {
    const { resource, calls } = setup()
    resource.onReply(select(WhitelistItem.PreviousPage))
    expect(calls).toEqual([])
    resource.onReply(select(WhitelistItem.NextPage))
    resource.onReply(select(WhitelistItem.NextPage))
    calls.splice(0)
    resource.onReply(select(WhitelistItem.NextPage))
    expect(calls).toEqual([])
  })

  it('notifies a toggle change and keeps it for the next update', () => {
    const { resource, calls, clear } = setup()
    resource.onReply({ kind: ReplyKind.ValueChanged, panelId: WhitelistPanel.List, itemId: WhitelistItem.Enabled, value: false })
    expect(notifications(calls).map((notification) => notification.tone)).toEqual([NotificationTone.Warning])
    clear()
    resource.onReply(select(WhitelistItem.NextPage))
    expect(lastUpdate(calls).items[0]).toMatchObject({ id: WhitelistItem.Enabled, value: false })
    clear()
    resource.onReply({ kind: ReplyKind.ValueChanged, panelId: WhitelistPanel.List, itemId: WhitelistItem.Enabled, value: true })
    expect(notifications(calls).map((notification) => notification.tone)).toEqual([NotificationTone.Success])
  })

  it('ignores a toggle change that is not a boolean or not the whitelist switch', () => {
    const { resource, calls } = setup()
    resource.onReply({ kind: ReplyKind.ValueChanged, panelId: WhitelistPanel.List, itemId: WhitelistItem.Enabled, value: 'yes' })
    resource.onReply({ kind: ReplyKind.ValueChanged, panelId: WhitelistPanel.List, itemId: 'other', value: true })
    expect(calls).toEqual([])
  })

  it('pushes the add form over the list', () => {
    const { resource, calls } = setup()
    resource.onReply(select(WhitelistItem.Add))
    expect(calls).toEqual([{ name: KitExport.PushPanel, args: [addPanel(), WhitelistPanel.List] }])
  })

  it('accepts a new identifier: resolves the form, notifies and refreshes the count', () => {
    const { resource, calls } = setup()
    resource.onReply(submit('license:feed00beef01'))
    expect(resolution(calls)).toEqual({ outcome: FormOutcome.Accepted })
    expect(callsOf(calls, KitExport.ResolveForm)[0]?.args.slice(0, SUBMISSION_ARGUMENTS)).toEqual([WhitelistPanel.Add, FIRST_SUBMISSION])
    expect(notifications(calls)).toMatchObject([{ tone: NotificationTone.Success, title: 'Joueur ajouté' }])
    expect(lastUpdate(calls).subtitle).toBe(`Page 1 sur ${PAGES_OF_SMALL} · ${SMALL_COUNT + 1} joueurs`)
  })

  it('rejects an identifier that is already allowed, whatever its case', () => {
    const { resource, calls } = setup()
    const [first] = createPlayers(1)
    resource.onReply(submit(`license:${first?.identifier.slice('license:'.length).toUpperCase()}`))
    expect(resolution(calls)).toEqual({ outcome: FormOutcome.Rejected, fieldErrors: { [WhitelistField.Identifier]: 'Cet identifiant est déjà autorisé' } })
    expect(notifications(calls)).toEqual([])
    expect(callsOf(calls, KitExport.UpdatePanel)).toEqual([])
  })

  it('rejects a malformed or non-text identifier', () => {
    const { resource, calls, clear } = setup()
    resource.onReply(submit('not an identifier'))
    expect(resolution(calls)).toMatchObject({ outcome: FormOutcome.Rejected, fieldErrors: { [WhitelistField.Identifier]: 'Identifiant invalide' } })
    clear()
    resource.onReply(submit(NOT_TEXT))
    expect(resolution(calls)).toMatchObject({ outcome: FormOutcome.Rejected, fieldErrors: { [WhitelistField.Identifier]: 'Identifiant invalide' } })
    expect(notifications(calls)).toEqual([])
  })

  it('ignores a submission of another form', () => {
    const { resource, calls } = setup()
    resource.onReply({ kind: ReplyKind.FormSubmitted, panelId: 'elsewhere', submissionId: 1, values: {} })
    expect(calls).toEqual([])
  })

  it('asks for a danger confirmation before removing a player', () => {
    const { resource, calls } = setup()
    resource.onReply(select('player-0003'))
    const [request] = callsOf(calls, KitExport.Confirm)
    expect(firstArg<ConfirmRequest>(request)).toMatchObject({ id: 'remove-player-0003', danger: true })
    expect(calls).toHaveLength(1)
  })

  it('removes the player once confirmed, then notifies and refreshes', () => {
    const { resource, calls } = setup()
    resource.onReply(answer('remove-player-0003', true))
    expect(lastUpdate(calls).items.some((item) => item.id === REMOVED_ID)).toBe(false)
    expect(lastUpdate(calls).subtitle).toBe(`Page 1 sur ${PAGES_OF_SMALL} · ${SMALL_COUNT - 1} joueurs`)
    expect(notifications(calls)).toMatchObject([{ tone: NotificationTone.Success, title: 'Joueur retiré' }])
  })

  it('keeps everything when the removal is cancelled or the target is unknown', () => {
    const { resource, calls } = setup()
    resource.onReply(answer('remove-player-0003', false))
    resource.onReply(answer('remove-player-9999', true))
    resource.onReply(answer('something-else', true))
    resource.onReply(select('player-9999'))
    expect(calls).toEqual([])
  })

  it('goes back one page when the last row of the last page is removed', () => {
    const { resource, calls, clear } = setup(OVERFLOW_COUNT)
    resource.onReply(select(WhitelistItem.NextPage))
    clear()
    resource.onReply(answer(`remove-player-${String(OVERFLOW_COUNT).padStart(ID_DIGITS, '0')}`, true))
    expect(lastUpdate(calls).subtitle).toBe(`Page 1 sur 1 · ${PLAYER_ITEMS_PER_PAGE} joueurs`)
    expect(playerRows(lastUpdate(calls))).toBe(PLAYER_ITEMS_PER_PAGE)
  })

  it('opens the list from a radial selection, with the form on top for the add child', () => {
    const { resource, calls, clear } = setup()
    resource.onReply({ kind: ReplyKind.RadialSelected, entryId: 'whitelist' })
    expect(calls.map((call) => call.name)).toEqual([KitExport.OpenPanel])
    clear()
    resource.onReply({ kind: ReplyKind.RadialSelected, entryId: 'whitelist', childId: 'list' })
    expect(calls.map((call) => call.name)).toEqual([KitExport.OpenPanel])
    clear()
    resource.onReply({ kind: ReplyKind.RadialSelected, entryId: 'whitelist', childId: 'add' })
    expect(calls.map((call) => call.name)).toEqual([KitExport.OpenPanel, KitExport.PushPanel])
    expect(firstArg<FormPanel>(calls[1]).id).toBe(WhitelistPanel.Add)
  })

  it('goes back to the first page when the list is reopened', () => {
    const { resource, calls, clear } = setup()
    resource.onReply(select(WhitelistItem.NextPage))
    clear()
    resource.onReply({ kind: ReplyKind.RadialSelected, entryId: 'whitelist' })
    expect(firstArg<MenuPanel>(calls[0]).subtitle).toContain('Page 1 sur')
  })

  it('ignores the replies it has nothing to say about', () => {
    const { resource, calls } = setup()
    resource.onReply({ kind: ReplyKind.PanelClosed, panelId: WhitelistPanel.List, reason: CloseReason.Back })
    resource.onReply({ kind: ReplyKind.PromptCompleted, promptId: 'open-door' })
    resource.onReply({ kind: ReplyKind.ItemSelected, panelId: 'elsewhere', itemId: WhitelistItem.Add })
    expect(calls).toEqual([])
  })
})
