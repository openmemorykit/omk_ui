import { CallStatus, ContractErrorCode, FormOutcome, KitExport, LABEL_MAX_LENGTH } from '@openmemorykit/ui/contract'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../preview/runtime/preview-settings'
import { LogKind } from '../../../preview/runtime/types'
import { ToPage } from '../../../src/protocol/to-page'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, PRESS_PROMPT, REMOVE_CONFIRM, WHITELIST_RADIAL_ENTRY } from '../../fixtures/surfaces'
import { createClientHarness, Owner, type ClientHarness } from './client-harness'
import { menu } from './runtime-helpers'

const DONE = { status: CallStatus.Done }
const FIRST_SUBMISSION = 1
const OPEN_AND_CLOSE = 2
const TWO_SENT = 2
const FOUR_SENT = 4
const TOO_LONG_TITLE = 'x'.repeat(LABEL_MAX_LENGTH + 1)

function refusedWith(code: ContractErrorCode, path: string): unknown {
  return { status: CallStatus.Refused, errors: [expect.objectContaining({ code, path })] }
}

let harness: ClientHarness

beforeEach(() => {
  harness = createClientHarness()
  harness.client.boot(DEFAULT_PREVIEW_SETTINGS)
  harness.clearSent()
})

describe('fake client stack exports', () => {
  it('opens a panel with the next commandSeq and the namespaced descriptor', () => {
    expect(harness.call(Owner.Whitelist, KitExport.OpenPanel, LIST_PANEL)).toEqual(DONE)
    expect(harness.sent).toEqual([{ type: ToPage.OpenPanel, commandSeq: 1, panel: { owner: Owner.Whitelist, panel: { ...LIST_PANEL, id: 'whitelist/list' } } }])
  })

  it('pushes a panel above its parent, and refuses a parent that is not the caller top', () => {
    harness.call(Owner.Whitelist, KitExport.OpenPanel, LIST_PANEL)
    expect(harness.call(Owner.Garage, KitExport.PushPanel, ADD_PANEL, 'list')).toEqual(refusedWith(ContractErrorCode.NotOwner, ''))
    expect(harness.call(Owner.Whitelist, KitExport.PushPanel, ADD_PANEL, 'list')).toEqual(DONE)
    expect(harness.sent[1]).toEqual({ type: ToPage.PushPanel, commandSeq: 2, panel: { owner: Owner.Whitelist, panel: { ...ADD_PANEL, id: 'whitelist/add' } }, parentId: 'whitelist/list' })
  })

  it('updates an owned panel and refuses an unknown one', () => {
    harness.call(Owner.Whitelist, KitExport.OpenPanel, LIST_PANEL)
    const renamed = { ...LIST_PANEL, title: 'Renamed' }
    expect(harness.call(Owner.Whitelist, KitExport.UpdatePanel, renamed)).toEqual(DONE)
    expect(harness.sent[1]).toEqual({ type: ToPage.UpdatePanel, panel: { owner: Owner.Whitelist, panel: { ...renamed, id: 'whitelist/list' } } })
    expect(harness.call(Owner.Garage, KitExport.UpdatePanel, renamed)).toEqual(refusedWith(ContractErrorCode.UnknownPanel, 'id'))
  })

  it('closes an owned panel, and answers Done without a message for an unknown one', () => {
    harness.call(Owner.Whitelist, KitExport.OpenPanel, LIST_PANEL)
    expect(harness.call(Owner.Whitelist, KitExport.ClosePanel, 'list')).toEqual(DONE)
    expect(harness.sent[1]).toEqual({ type: ToPage.ClosePanel, commandSeq: 2, panelId: 'whitelist/list' })
    expect(harness.call(Owner.Whitelist, KitExport.ClosePanel, 'list')).toEqual(DONE)
    expect(harness.sent).toHaveLength(OPEN_AND_CLOSE)
  })

  it('resolves an owned form, and refuses a menu or a malformed submission id', () => {
    harness.call(Owner.Whitelist, KitExport.OpenPanel, ADD_PANEL)
    const accepted = { outcome: FormOutcome.Accepted }
    expect(harness.call(Owner.Whitelist, KitExport.ResolveForm, 'add', FIRST_SUBMISSION, accepted)).toEqual(DONE)
    expect(harness.sent[1]).toEqual({ type: ToPage.ResolveForm, panelId: 'whitelist/add', submissionId: FIRST_SUBMISSION, result: accepted })
    expect(harness.call(Owner.Whitelist, KitExport.ResolveForm, 'add', -1, accepted)).toEqual(refusedWith(ContractErrorCode.OutOfRange, '1'))
    expect(harness.call(Owner.Whitelist, KitExport.ResolveForm, 'add', 'one', accepted)).toEqual(refusedWith(ContractErrorCode.WrongType, '1'))
    harness.call(Owner.Whitelist, KitExport.OpenPanel, menu('main'))
    expect(harness.call(Owner.Whitelist, KitExport.ResolveForm, 'main', FIRST_SUBMISSION, accepted)).toEqual(refusedWith(ContractErrorCode.UnknownPanel, ''))
  })

  it('shows a confirmation and keeps one per owner', () => {
    expect(harness.call(Owner.Whitelist, KitExport.Confirm, REMOVE_CONFIRM)).toEqual(DONE)
    expect(harness.sent).toEqual([{ type: ToPage.ShowConfirm, commandSeq: 1, confirm: { owner: Owner.Whitelist, confirm: { ...REMOVE_CONFIRM, id: 'whitelist/remove-player-1' } } }])
    expect(harness.call(Owner.Whitelist, KitExport.Confirm, { ...REMOVE_CONFIRM, id: 'other' })).toEqual(refusedWith(ContractErrorCode.QuotaExceeded, ''))
  })
})

describe('fake client surface exports', () => {
  it('sends the radial entries in registry order on each change', () => {
    harness.call(Owner.Whitelist, KitExport.AddRadialEntry, WHITELIST_RADIAL_ENTRY)
    harness.call(Owner.Garage, KitExport.AddRadialEntry, GARAGE_RADIAL_ENTRY)
    expect(harness.sent[1]).toEqual({
      type: ToPage.RadialEntries,
      entries: [
        { owner: Owner.Garage, entry: { ...GARAGE_RADIAL_ENTRY, id: 'garage/main' } },
        { owner: Owner.Whitelist, entry: { ...WHITELIST_RADIAL_ENTRY, id: 'whitelist/main' } },
      ],
    })
    expect(harness.call(Owner.Garage, KitExport.RemoveRadialEntry, 'main')).toEqual(DONE)
    expect(harness.sent[TWO_SENT]).toEqual({ type: ToPage.RadialEntries, entries: [{ owner: Owner.Whitelist, entry: { ...WHITELIST_RADIAL_ENTRY, id: 'whitelist/main' } }] })
  })

  it('shows a prompt, and shows the remaining one when the visible prompt is hidden', () => {
    harness.call(Owner.Garage, KitExport.ShowPrompt, PRESS_PROMPT)
    harness.call(Owner.Garage, KitExport.ShowPrompt, HOLD_PROMPT)
    expect(harness.sent[1]).toEqual({ type: ToPage.ShowPrompt, prompt: { owner: Owner.Garage, prompt: { ...HOLD_PROMPT, id: 'garage/open-door' } } })
    expect(harness.call(Owner.Garage, KitExport.HidePrompt, HOLD_PROMPT.id)).toEqual(DONE)
    expect(harness.sent.slice(TWO_SENT)).toEqual([
      { type: ToPage.HidePrompt, promptId: 'garage/open-door' },
      { type: ToPage.ShowPrompt, prompt: { owner: Owner.Garage, prompt: { ...PRESS_PROMPT, id: 'garage/talk' } } },
    ])
    harness.call(Owner.Garage, KitExport.HidePrompt, PRESS_PROMPT.id)
    expect(harness.sent.slice(FOUR_SENT)).toEqual([{ type: ToPage.HidePrompt, promptId: 'garage/talk' }])
  })

  it('hides a prompt that is not visible without showing another', () => {
    harness.call(Owner.Garage, KitExport.ShowPrompt, PRESS_PROMPT)
    harness.call(Owner.Garage, KitExport.ShowPrompt, HOLD_PROMPT)
    harness.call(Owner.Garage, KitExport.HidePrompt, PRESS_PROMPT.id)
    expect(harness.sent.slice(TWO_SENT)).toEqual([{ type: ToPage.HidePrompt, promptId: 'garage/talk' }])
  })

  it('hides nothing for an unknown prompt', () => {
    expect(harness.call(Owner.Garage, KitExport.HidePrompt, 'unknown')).toEqual(DONE)
    expect(harness.sent).toEqual([])
  })
})

describe('fake client contract boundary', () => {
  it('refuses a payload that breaks the contract and sends nothing', () => {
    expect(harness.call(Owner.Whitelist, KitExport.OpenPanel, { ...LIST_PANEL, title: TOO_LONG_TITLE })).toEqual(refusedWith(ContractErrorCode.TooLong, '0.title'))
    expect(harness.sent).toEqual([])
    expect(harness.client.registry().stack).toEqual([])
  })

  it('refuses a function anywhere in the arguments', () => {
    expect(harness.call(Owner.Whitelist, KitExport.OpenPanel, { ...LIST_PANEL, onSelect: () => undefined })).toEqual(refusedWith(ContractErrorCode.FunctionNotAllowed, '0.onSelect'))
  })

  it('refuses an unknown export, arguments that are not a list, and a wrong arity', () => {
    expect(harness.call(Owner.Whitelist, 'openEverything')).toEqual(refusedWith(ContractErrorCode.UnknownValue, ''))
    expect(harness.client.kitFor(Owner.Whitelist).call(KitExport.OpenPanel, LIST_PANEL)).toEqual(refusedWith(ContractErrorCode.WrongType, ''))
    expect(harness.call(Owner.Whitelist, KitExport.PushPanel, ADD_PANEL)).toEqual(refusedWith(ContractErrorCode.Missing, '1'))
    expect(harness.call(Owner.Whitelist, KitExport.ClosePanel, 'list', 'extra')).toEqual(refusedWith(ContractErrorCode.TooMany, ''))
  })

  it('refuses an owner that cannot be namespaced', () => {
    expect(harness.call('bad/owner', KitExport.OpenPanel, LIST_PANEL)).toEqual(refusedWith(ContractErrorCode.BadIdentifier, ''))
  })

  it('logs every call with its owner, its export and its result', () => {
    harness.call(Owner.Whitelist, KitExport.OpenPanel, LIST_PANEL)
    harness.call(Owner.Whitelist, 'openEverything')
    const calls = harness.events.filter((event) => event.kind === LogKind.Call)
    expect(calls).toEqual([
      { kind: LogKind.Call, owner: Owner.Whitelist, name: KitExport.OpenPanel, result: DONE },
      { kind: LogKind.Call, owner: Owner.Whitelist, name: 'openEverything', result: refusedWith(ContractErrorCode.UnknownValue, '') },
    ])
  })
})
