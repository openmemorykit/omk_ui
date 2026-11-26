import { describe, expect, it } from 'vitest'
import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import type { Reply } from '@openmemorykit/ui/contract'
import {
  fromPageReply,
  fromPageStackEntry,
  toPageConfirm,
  toPageNotification,
  toPagePanel,
  toPagePrompt,
  toPageRadialEntry,
} from '../../src/protocol/owned'
import type { OwnedReply, StackEntry } from '../../src/protocol/stack'
import {
  FixtureOwner,
  HOSTILE_NAMESPACED_IDS,
  OWNED_ADD_PANEL,
  OWNED_GARAGE_RADIAL_ENTRY,
  OWNED_HOLD_PROMPT,
  OWNED_KEYED_NOTIFICATION,
  OWNED_LIST_PANEL,
  OWNED_PLAIN_NOTIFICATION,
  OWNED_PRESS_PROMPT,
  OWNED_REMOVE_CONFIRM,
  OWNED_WHITELIST_RADIAL_ENTRY,
} from '../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../fixtures/panels'
import { LOCAL_REPLIES, OWNED_REPLIES, PAGE_REPLIES, REPLY_OWNER } from '../fixtures/replies'
import {
  GARAGE_RADIAL_ENTRY,
  HOLD_PROMPT,
  KEYED_NOTIFICATION,
  PLAIN_NOTIFICATION,
  PRESS_PROMPT,
  REMOVE_CONFIRM,
  WHITELIST_RADIAL_ENTRY,
} from '../fixtures/surfaces'

describe('toPage conversions', () => {
  it('prefixes panel.id and nothing else', () => {
    const owned = toPagePanel(FixtureOwner.Whitelist, LIST_PANEL)
    expect(owned).toStrictEqual(OWNED_LIST_PANEL)
    expect(owned.panel.items).toBe(LIST_PANEL.items)
    expect(toPagePanel(FixtureOwner.Whitelist, ADD_PANEL)).toStrictEqual(OWNED_ADD_PANEL)
  })

  it('prefixes the confirmation and prompt ids', () => {
    expect(toPageConfirm(FixtureOwner.Whitelist, REMOVE_CONFIRM)).toStrictEqual(OWNED_REMOVE_CONFIRM)
    expect(toPagePrompt(FixtureOwner.Garage, HOLD_PROMPT)).toStrictEqual(OWNED_HOLD_PROMPT)
    expect(toPagePrompt(FixtureOwner.Garage, PRESS_PROMPT)).toStrictEqual(OWNED_PRESS_PROMPT)
  })

  it('prefixes the radial entry id and never its children ids', () => {
    const owned = toPageRadialEntry(FixtureOwner.Whitelist, WHITELIST_RADIAL_ENTRY)
    expect(owned).toStrictEqual(OWNED_WHITELIST_RADIAL_ENTRY)
    expect(owned.entry.children?.map((child) => child.id)).toStrictEqual(['list', 'add'])
    expect(toPageRadialEntry(FixtureOwner.Garage, GARAGE_RADIAL_ENTRY)).toStrictEqual(OWNED_GARAGE_RADIAL_ENTRY)
  })

  it('prefixes a notification key and leaves an absent key absent', () => {
    expect(toPageNotification(FixtureOwner.Whitelist, KEYED_NOTIFICATION)).toStrictEqual(OWNED_KEYED_NOTIFICATION)
    const plain = toPageNotification(FixtureOwner.Garage, PLAIN_NOTIFICATION)
    expect(plain).toStrictEqual(OWNED_PLAIN_NOTIFICATION)
    expect(Object.prototype.hasOwnProperty.call(plain.notification, 'key')).toBe(false)
  })

  it('gives two owners distinct ids for the same local id', () => {
    const whitelist = toPageRadialEntry(FixtureOwner.Whitelist, WHITELIST_RADIAL_ENTRY)
    const garage = toPageRadialEntry(FixtureOwner.Garage, GARAGE_RADIAL_ENTRY)
    expect(WHITELIST_RADIAL_ENTRY.id).toBe(GARAGE_RADIAL_ENTRY.id)
    expect(whitelist.entry.id).not.toBe(garage.entry.id)
  })

  it('throws rather than build an ambiguous id', () => {
    expect(() => toPagePanel('white/list', LIST_PANEL)).toThrow(RangeError)
  })
})

describe('fromPageStackEntry', () => {
  it('is the inverse of toPagePanel', () => {
    const owned = toPagePanel(FixtureOwner.Whitelist, LIST_PANEL)
    expect(fromPageStackEntry({ panelId: owned.panel.id, owner: owned.owner })).toStrictEqual({ owner: FixtureOwner.Whitelist, localPanelId: 'list' })
  })

  it('refuses an id without prefix', () => {
    expect(fromPageStackEntry({ panelId: 'list', owner: FixtureOwner.Whitelist })).toBeNull()
  })

  it('refuses an entry whose prefix is another owner', () => {
    expect(fromPageStackEntry({ panelId: 'garage/list', owner: FixtureOwner.Whitelist })).toBeNull()
  })

  it.each(HOSTILE_NAMESPACED_IDS.map((panelId) => [panelId]))('refuses the hostile id %j', (panelId) => {
    expect(fromPageStackEntry({ panelId, owner: FixtureOwner.Whitelist })).toBeNull()
  })

  it.each([null, 'whitelist/list', [], { panelId: 'whitelist/list' }, { panelId: 1, owner: FixtureOwner.Whitelist }])('refuses the malformed entry %j', (entry) => {
    expect(fromPageStackEntry(entry as unknown as StackEntry)).toBeNull()
  })
})

describe('fromPageReply', () => {
  it('gives PanelClosed of whitelist/list to whitelist with the local panel id', () => {
    const reply: Reply = { kind: ReplyKind.PanelClosed, panelId: 'whitelist/list', reason: CloseReason.Back }
    expect(fromPageReply({ owner: FixtureOwner.Whitelist, reply })).toStrictEqual({
      owner: FixtureOwner.Whitelist,
      reply: { kind: ReplyKind.PanelClosed, panelId: 'list', reason: CloseReason.Back },
    })
  })

  it.each(Object.values(ReplyKind).map((kind) => [kind]))('strips the prefix of the %s target', (kind) => {
    expect(fromPageReply({ owner: REPLY_OWNER[kind], reply: PAGE_REPLIES[kind] })).toStrictEqual({ owner: REPLY_OWNER[kind], reply: LOCAL_REPLIES[kind] })
  })

  it('covers one reply of each kind in the shared fixture', () => {
    expect(OWNED_REPLIES.map((owned) => owned.reply.kind)).toStrictEqual(Object.values(ReplyKind))
  })

  it.each(Object.values(ReplyKind).map((kind) => [kind]))('refuses a %s target that belongs to another owner', (kind) => {
    const otherOwner = REPLY_OWNER[kind] === FixtureOwner.Garage ? FixtureOwner.Whitelist : FixtureOwner.Garage
    expect(fromPageReply({ owner: otherOwner, reply: PAGE_REPLIES[kind] })).toBeNull()
  })

  it.each(Object.values(ReplyKind).map((kind) => [kind]))('refuses a %s target without prefix', (kind) => {
    expect(fromPageReply({ owner: REPLY_OWNER[kind], reply: LOCAL_REPLIES[kind] })).toBeNull()
  })

  it('keeps the radial child id as it is', () => {
    const local = fromPageReply({ owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.RadialSelected] })
    expect(local?.reply).toStrictEqual({ kind: ReplyKind.RadialSelected, entryId: 'main', childId: 'add' })
  })

  it.each([
    null,
    {},
    { owner: FixtureOwner.Whitelist },
    { owner: FixtureOwner.Whitelist, reply: null },
    { owner: FixtureOwner.Whitelist, reply: { kind: 'unknown', panelId: 'whitelist/list' } },
    { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed } },
    { owner: 7, reply: PAGE_REPLIES[ReplyKind.PanelClosed] },
  ])('refuses the malformed reply %j', (owned) => {
    expect(fromPageReply(owned as unknown as OwnedReply)).toBeNull()
  })
})
