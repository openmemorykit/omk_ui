import type * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
  ConfirmRequestSchema,
  ContractErrorCode,
  ItemKind,
  ItemSchema,
  NotificationSchema,
  PanelSchema,
  PromptSchema,
  RadialEntrySchema,
  ReplyKind,
  ReplySchema,
} from '@openmemorykit/ui/contract'
import { validateContract, ValidationStatus } from '@openmemorykit/ui/validation'
import { FromPage } from '../../src/protocol/from-page'
import { toPagePanel } from '../../src/protocol/owned'
import * as itemFixtures from '../fixtures/items'
import * as messageFixtures from '../fixtures/messages'
import * as ownedFixtures from '../fixtures/owned'
import * as panelFixtures from '../fixtures/panels'
import * as replyFixtures from '../fixtures/replies'
import * as stackFixtures from '../fixtures/stack'
import * as surfaceFixtures from '../fixtures/surfaces'
import { ITEM_BY_KIND, PLAYERS_SECTION, PURGE_ACTION, REMOVE_ALL_ACTION, NOTIFY_TOGGLE } from '../fixtures/items'
import { FROM_PAGE_SAMPLES } from '../fixtures/messages'
import { OWNED_ADD_PANEL, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM, OWNED_WHITELIST_RADIAL_ENTRY } from '../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../fixtures/panels'
import { LOCAL_REPLIES, PAGE_REPLIES } from '../fixtures/replies'
import { SHARED_STACK_OWNED, SHARED_STACK_PANELS, SHARED_STACK_SNAPSHOT } from '../fixtures/stack'
import {
  GARAGE_RADIAL_ENTRY,
  HOLD_PROMPT,
  KEYED_NOTIFICATION,
  PLAIN_NOTIFICATION,
  PRESS_PROMPT,
  REMOVE_CONFIRM,
  WHITELIST_RADIAL_ENTRY,
} from '../fixtures/surfaces'

type Case = readonly [string, v.GenericSchema, unknown]

const localCases: readonly Case[] = [
  ['LIST_PANEL', PanelSchema, LIST_PANEL],
  ['ADD_PANEL', PanelSchema, ADD_PANEL],
  ['REMOVE_CONFIRM', ConfirmRequestSchema, REMOVE_CONFIRM],
  ['HOLD_PROMPT', PromptSchema, HOLD_PROMPT],
  ['PRESS_PROMPT', PromptSchema, PRESS_PROMPT],
  ['WHITELIST_RADIAL_ENTRY', RadialEntrySchema, WHITELIST_RADIAL_ENTRY],
  ['GARAGE_RADIAL_ENTRY', RadialEntrySchema, GARAGE_RADIAL_ENTRY],
  ['KEYED_NOTIFICATION', NotificationSchema, KEYED_NOTIFICATION],
  ['PLAIN_NOTIFICATION', NotificationSchema, PLAIN_NOTIFICATION],
  ...Object.values(ItemKind).map((kind): Case => [`ITEM_BY_KIND.${kind}`, ItemSchema, ITEM_BY_KIND[kind]]),
  ...Object.values(ReplyKind).map((kind): Case => [`LOCAL_REPLIES.${kind}`, ReplySchema, LOCAL_REPLIES[kind]]),
]

const prefixedCases: readonly Case[] = [
  ['OWNED_LIST_PANEL', PanelSchema, OWNED_LIST_PANEL.panel],
  ['OWNED_ADD_PANEL', PanelSchema, OWNED_ADD_PANEL.panel],
  ['OWNED_REMOVE_CONFIRM', ConfirmRequestSchema, OWNED_REMOVE_CONFIRM.confirm],
  ['OWNED_WHITELIST_RADIAL_ENTRY', RadialEntrySchema, OWNED_WHITELIST_RADIAL_ENTRY.entry],
]

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen)
}

describe('shared fixtures', () => {
  it.each(localCases)('%s is accepted by the contract with no unknown field', (_name, schema, fixture) => {
    const result = validateContract(schema, fixture)
    expect(result).toMatchObject({ status: ValidationStatus.Accepted, unknownFields: [] })
  })

  it.each(prefixedCases)('%s is refused by the contract, so a prefixed id never passes for a local one', (_name, schema, fixture) => {
    expect(validateContract(schema, fixture)).toStrictEqual({ status: ValidationStatus.Refused, errors: [{ path: 'id', code: ContractErrorCode.BadIdentifier }] })
  })

  it('has one item of each kind, under its own kind', () => {
    Object.entries(ITEM_BY_KIND).forEach(([kind, item]) => expect(item.kind).toBe(kind))
    expect(Object.keys(ITEM_BY_KIND).sort()).toStrictEqual(Object.values(ItemKind).sort())
  })

  it('covers a section, a disabled item, an item confirmation and the three field kinds', () => {
    expect(LIST_PANEL.items).toContain(PLAYERS_SECTION)
    expect(PURGE_ACTION.disabled).toBeDefined()
    expect(REMOVE_ALL_ACTION.confirm).toBeDefined()
    expect(ADD_PANEL.items.map((item) => item.kind)).toStrictEqual([ItemKind.Text, ItemKind.Cycle, ItemKind.Toggle])
    expect(ADD_PANEL.items).toContain(NOTIFY_TOGGLE)
  })

  it('describes one stack in its three forms', () => {
    expect(SHARED_STACK_PANELS.map(({ owner, panel }) => toPagePanel(owner, panel))).toStrictEqual(SHARED_STACK_OWNED)
    expect(SHARED_STACK_SNAPSHOT.entries).toStrictEqual(SHARED_STACK_OWNED.map(({ owner, panel }) => ({ panelId: panel.id, owner })))
  })

  it('samples an event the page can send: no closed panel is still on its stack', () => {
    const { stack, replies } = FROM_PAGE_SAMPLES[FromPage.Event].event
    const closedIds = replies.flatMap(({ reply }) => (reply.kind === ReplyKind.PanelClosed ? [reply.panelId] : []))
    expect(closedIds.length).toBeGreaterThan(0)
    expect(stack?.entries.filter((entry) => closedIds.includes(entry.panelId))).toEqual([])
  })

  it('has one local reply of each kind, the page form under the same key', () => {
    expect(Object.keys(LOCAL_REPLIES).sort()).toStrictEqual(Object.values(ReplyKind).sort())
    expect(Object.keys(PAGE_REPLIES)).toStrictEqual(Object.keys(LOCAL_REPLIES))
  })

  const fixtureModules = { itemFixtures, messageFixtures, ownedFixtures, panelFixtures, replyFixtures, stackFixtures, surfaceFixtures }
  const everyFixture = Object.entries(fixtureModules).flatMap(([moduleName, exported]) => Object.entries(exported).map(([name, value]) => [`${moduleName}.${name}`, value] as const))

  it.each(everyFixture)('%s is frozen to the last level', (_name, fixture) => {
    expect(isDeepFrozen(fixture)).toBe(true)
  })
})
