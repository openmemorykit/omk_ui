import { CallStatus, CloseReason, ContractErrorCode, KitExport, ReplyKind, type Reply } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../preview/runtime/preview-settings'
import { LogKind } from '../../../preview/runtime/types'
import { FromPage, type FromPageMessage } from '../../../src/protocol/from-page'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import type { OwnedReply } from '../../../src/protocol/stack'
import { REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { createClientHarness, createPageHarness, Owner, recordReplies, type PageHarness } from './client-harness'
import { clientIntent, menu } from './runtime-helpers'

const ITEM_SELECTED: Reply = { kind: ReplyKind.ItemSelected, panelId: 'whitelist/main', itemId: 'go' }
const CLOSED: Reply = { kind: ReplyKind.PanelClosed, panelId: 'whitelist/main', reason: CloseReason.Back }
const DELIVERED_COUNT = 3

function eventOf(replies: readonly OwnedReply[]): FromPageMessage {
  return { type: FromPage.Event, event: { stack: null, replies } }
}

function pressAndRelease(harness: PageHarness, seq: number, intent: Intent): void {
  harness.page.dispatch(clientIntent(seq, intent, IntentPhase.Press))
  harness.page.dispatch(clientIntent(seq + 1, intent, IntentPhase.Release))
}

function bootedPage(): PageHarness {
  const harness = createPageHarness()
  recordReplies(harness, Owner.Whitelist)
  harness.client.boot(DEFAULT_PREVIEW_SETTINGS)
  return harness
}

describe('fake client Event handling', () => {
  it('delivers the selection of the focused item with the owner local ids', () => {
    const harness = bootedPage()
    harness.call(Owner.Whitelist, KitExport.OpenPanel, menu('main'))
    pressAndRelease(harness, 1, Intent.Confirm)
    expect(harness.replies.get(Owner.Whitelist)).toEqual([{ kind: ReplyKind.ItemSelected, panelId: 'main', itemId: 'go' }])
  })

  it('reconciles the registry stack with the page and delivers the closing', () => {
    const harness = bootedPage()
    harness.call(Owner.Whitelist, KitExport.OpenPanel, menu('main'))
    harness.call(Owner.Whitelist, KitExport.PushPanel, menu('sub'), 'main')
    pressAndRelease(harness, 1, Intent.Back)
    expect(harness.client.registry().stack.map(({ panel }) => panel.id)).toEqual(['main'])
    expect(harness.replies.get(Owner.Whitelist)).toEqual([{ kind: ReplyKind.PanelClosed, panelId: 'sub', reason: CloseReason.Back }])
  })

  it('settles an answered confirmation in the registry', () => {
    const harness = bootedPage()
    harness.call(Owner.Whitelist, KitExport.Confirm, REMOVE_CONFIRM)
    pressAndRelease(harness, 1, Intent.Confirm)
    expect(harness.replies.get(Owner.Whitelist)).toEqual([{ kind: ReplyKind.ConfirmAnswered, confirmId: REMOVE_CONFIRM.id, confirmed: false }])
    expect(harness.client.registry().confirms).toEqual([])
    expect(harness.call(Owner.Whitelist, KitExport.Confirm, REMOVE_CONFIRM)).toEqual({ status: CallStatus.Done })
  })

  it('keeps the registry stack for an Event without a stack', () => {
    const harness = createClientHarness()
    harness.call(Owner.Whitelist, KitExport.OpenPanel, menu('main'))
    harness.client.receive(eventOf([]))
    expect(harness.client.registry().stack).toHaveLength(1)
  })

  it('ignores the other page messages', () => {
    const harness = createClientHarness()
    harness.client.receive({ type: FromPage.Ack, lastIntentSeq: 1 })
    expect(harness.events).toEqual([])
  })
})

describe('fake client reply checks', () => {
  it('refuses a reply whose id belongs to another owner', () => {
    const harness = createClientHarness()
    recordReplies(harness, Owner.Whitelist)
    harness.client.receive(eventOf([{ owner: Owner.Whitelist, reply: { ...CLOSED, panelId: 'garage/main' } }]))
    expect(harness.replies.get(Owner.Whitelist)).toEqual([])
    expect(harness.events).toEqual([{ kind: LogKind.ReplyRefused, owner: Owner.Whitelist, errors: [{ path: '', code: ContractErrorCode.BadIdentifier }] }])
  })

  it('refuses a reply that fails ReplySchema', () => {
    const harness = createClientHarness()
    recordReplies(harness, Owner.Whitelist)
    const wrongValue = { kind: ReplyKind.ValueChanged, panelId: 'whitelist/main', itemId: 'flag', value: 3 } as unknown as Reply
    harness.client.receive(eventOf([{ owner: Owner.Whitelist, reply: wrongValue }]))
    expect(harness.replies.get(Owner.Whitelist)).toEqual([])
    expect(harness.events).toEqual([{ kind: LogKind.ReplyRefused, owner: Owner.Whitelist, errors: [expect.objectContaining({ path: 'value' })] }])
  })

  it('refuses a reply whose owner is not a string', () => {
    const harness = createClientHarness()
    harness.client.receive(eventOf([{ owner: 7, reply: CLOSED } as unknown as OwnedReply]))
    expect(harness.events).toEqual([{ kind: LogKind.ReplyRefused, owner: '', errors: [{ path: '', code: ContractErrorCode.BadIdentifier }] }])
  })

  it('logs a reply for an owner without a resource', () => {
    const harness = createClientHarness()
    harness.client.receive(eventOf([{ owner: Owner.Garage, reply: { ...CLOSED, panelId: 'garage/main' } }]))
    expect(harness.events).toEqual([{ kind: LogKind.Reply, owner: Owner.Garage, reply: { ...CLOSED, panelId: 'main' } }])
  })

  it('delivers every reply of an Event before those of an Event raised by a handler', () => {
    const harness = createClientHarness()
    const order: string[] = []
    recordReplies(harness, Owner.Whitelist, (reply) => {
      order.push(reply.kind)
      if (reply.kind === ReplyKind.ItemSelected && reply.itemId === ITEM_SELECTED.itemId) harness.client.receive(eventOf([{ owner: Owner.Whitelist, reply: { ...ITEM_SELECTED, itemId: 'more' } }]))
    })
    harness.client.receive(eventOf([{ owner: Owner.Whitelist, reply: ITEM_SELECTED }, { owner: Owner.Whitelist, reply: CLOSED }]))
    expect(harness.replies.get(Owner.Whitelist)?.map((reply) => (reply.kind === ReplyKind.ItemSelected ? reply.itemId : reply.kind))).toEqual(['go', ReplyKind.PanelClosed, 'more'])
    expect(order).toHaveLength(DELIVERED_COUNT)
  })

  it('logs a reply whose resource throws and goes on with the next one', () => {
    const harness = createClientHarness()
    recordReplies(harness, Owner.Whitelist, (reply) => {
      if (reply.kind === ReplyKind.ItemSelected) throw new RangeError('handler failed')
    })
    harness.client.receive(eventOf([{ owner: Owner.Whitelist, reply: ITEM_SELECTED }, { owner: Owner.Whitelist, reply: CLOSED }]))
    expect(harness.replies.get(Owner.Whitelist)?.map((reply) => reply.kind)).toEqual([ReplyKind.ItemSelected, ReplyKind.PanelClosed])
    expect(harness.events).toContainEqual({ kind: LogKind.ReplyUndelivered, owner: Owner.Whitelist, reply: { ...ITEM_SELECTED, panelId: 'main' } })
  })
})
