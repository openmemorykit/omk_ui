import { CallStatus, KitExport, NOTIFICATION_QUEUE_LENGTH } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREVIEW_SETTINGS, PREVIEW_BINDINGS, PreviewLanguage, previewLocale, previewTheme } from '../../../preview/runtime/preview-settings'
import { LogKind } from '../../../preview/runtime/types'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { PanelSide } from '../../../src/shared/config/theme-defaults'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, KEYED_NOTIFICATION, PLAIN_NOTIFICATION, REMOVE_CONFIRM, WHITELIST_RADIAL_ENTRY } from '../../fixtures/surfaces'
import { createClientHarness, Owner } from './client-harness'
import { messagesOf } from './runtime-helpers'

const SETTINGS = { ...DEFAULT_PREVIEW_SETTINGS, glyphSet: GlyphSet.PlayStation, side: PanelSide.Right, language: PreviewLanguage.English }
const PREVIOUS_COMMAND_SEQ = 41
const QUEUED_COUNT = 2
const OVERFLOW = 2

describe('fake client before Ready', () => {
  it('registers stack calls without sending them', () => {
    const harness = createClientHarness()
    expect(harness.call(Owner.Whitelist, KitExport.OpenPanel, LIST_PANEL)).toEqual({ status: CallStatus.Done })
    expect(harness.sent).toEqual([])
    expect(harness.client.registry().stack).toEqual([{ owner: Owner.Whitelist, panel: LIST_PANEL }])
  })

  it('queues notifications and sends them right after Boot', () => {
    const harness = createClientHarness()
    harness.call(Owner.Whitelist, KitExport.Notify, KEYED_NOTIFICATION)
    harness.call(Owner.Garage, KitExport.Notify, PLAIN_NOTIFICATION)
    harness.client.boot(SETTINGS)
    expect(harness.sent.map((message) => message.type)).toEqual([ToPage.Boot, ToPage.Notify, ToPage.Notify])
    expect(harness.sent[1]).toEqual({ type: ToPage.Notify, notification: { owner: Owner.Whitelist, notification: { ...KEYED_NOTIFICATION, key: 'whitelist/player-added' } } })
    harness.client.boot(SETTINGS)
    expect(messagesOf(harness.sent, ToPage.Notify)).toHaveLength(QUEUED_COUNT)
  })

  it('keeps the newest notifications and logs each one dropped', () => {
    const harness = createClientHarness()
    const titles = Array.from({ length: NOTIFICATION_QUEUE_LENGTH + OVERFLOW }, (_, index) => `Note ${index}`)
    titles.forEach((title) => harness.call(Owner.Garage, KitExport.Notify, { ...PLAIN_NOTIFICATION, title }))
    harness.client.boot(SETTINGS)
    const sentTitles = messagesOf(harness.sent, ToPage.Notify).map((message) => message.notification.notification.title)
    expect(sentTitles).toEqual(titles.slice(OVERFLOW))
    expect(harness.events.filter((event) => event.kind === LogKind.NotificationDropped)).toEqual([
      { kind: LogKind.NotificationDropped, owner: Owner.Garage },
      { kind: LogKind.NotificationDropped, owner: Owner.Garage },
    ])
  })
})

describe('fake client Boot', () => {
  it('rebuilds the page from the registry, the settings and the locale, without a session token', () => {
    const harness = createClientHarness()
    harness.call(Owner.Whitelist, KitExport.AddRadialEntry, WHITELIST_RADIAL_ENTRY)
    harness.call(Owner.Garage, KitExport.AddRadialEntry, GARAGE_RADIAL_ENTRY)
    harness.call(Owner.Whitelist, KitExport.OpenPanel, LIST_PANEL)
    harness.call(Owner.Whitelist, KitExport.PushPanel, ADD_PANEL, 'list')
    harness.call(Owner.Whitelist, KitExport.Confirm, REMOVE_CONFIRM)
    harness.call(Owner.Garage, KitExport.ShowPrompt, HOLD_PROMPT)
    harness.client.boot(SETTINGS)
    expect(harness.sent).toEqual([{
      type: ToPage.Boot,
      settings: previewTheme(SETTINGS),
      locale: previewLocale(PreviewLanguage.English),
      glyphSet: GlyphSet.PlayStation,
      bindings: PREVIEW_BINDINGS,
      radialEntries: [
        { owner: Owner.Garage, entry: { ...GARAGE_RADIAL_ENTRY, id: 'garage/main' } },
        { owner: Owner.Whitelist, entry: { ...WHITELIST_RADIAL_ENTRY, id: 'whitelist/main' } },
      ],
      panels: [
        { owner: Owner.Whitelist, panel: { ...LIST_PANEL, id: 'whitelist/list' } },
        { owner: Owner.Whitelist, panel: { ...ADD_PANEL, id: 'whitelist/add' } },
      ],
      confirm: { owner: Owner.Whitelist, confirm: { ...REMOVE_CONFIRM, id: 'whitelist/remove-player-1' } },
      prompt: { owner: Owner.Garage, prompt: { ...HOLD_PROMPT, id: 'garage/open-door' } },
      commandSeq: 3,
    }])
    expect(Object.hasOwn(harness.sent[0] ?? {}, 'sessionToken')).toBe(false)
  })

  it('boots an empty registry with no confirmation nor prompt', () => {
    const harness = createClientHarness()
    harness.client.boot(DEFAULT_PREVIEW_SETTINGS)
    expect(harness.sent[0]).toMatchObject({ radialEntries: [], panels: [], confirm: null, prompt: null, commandSeq: 0 })
  })

  it('continues the commandSeq it was created with', () => {
    const harness = createClientHarness(() => undefined, PREVIOUS_COMMAND_SEQ)
    harness.client.boot(DEFAULT_PREVIEW_SETTINGS)
    harness.call(Owner.Whitelist, KitExport.OpenPanel, LIST_PANEL)
    expect(messagesOf(harness.sent, ToPage.Boot)[0]?.commandSeq).toBe(PREVIOUS_COMMAND_SEQ)
    expect(messagesOf(harness.sent, ToPage.OpenPanel)[0]?.commandSeq).toBe(PREVIOUS_COMMAND_SEQ + 1)
  })
})
