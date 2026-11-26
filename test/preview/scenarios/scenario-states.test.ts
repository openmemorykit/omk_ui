import { ItemKind, NOTIFICATIONS_VISIBLE, NotificationTone, PanelKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { validateScenario } from '../../../preview/runtime/scenario-runner'
import { ScenarioId } from '../../../preview/runtime/types'
import { SCENARIO_CATALOG } from '../../../preview/scenarios'
import { FormStatus } from '../../../src/page/domain/form'
import { KeyboardLayer } from '../../../src/page/domain/keyboard-layouts'
import { ConfirmOrigin, LayerKind, RadialLevel } from '../../../src/page/domain/ui-state'
import { PromptState, UiMode } from '../../../src/protocol/page-vocabulary'
import { play, topFrame } from './scenario-harness'

const ALL_IDS: readonly ScenarioId[] = Object.values(ScenarioId)
const LONG_LIST_ROWS = 1000
const RADIAL_SECTORS = 5
const LIST_ROWS = 54
const PAGE_COUNT = 7
const PLAYERS = 342
const FORM_ERRORS = 2
const TONES = 4
const PROMPT_HOLD_MS = 1200
const BEYOND_VISIBLE = 2

describe('scenario catalog', () => {
  it('holds the fourteen scenarios of the page, each under its own identifier', () => {
    expect([...SCENARIO_CATALOG.keys()].sort()).toEqual([...ALL_IDS].sort())
    SCENARIO_CATALOG.forEach((entry, id) => expect(entry.scenario.id).toBe(id))
  })

  it.each(ALL_IDS)('%s passes the contract', (id) => {
    const entry = SCENARIO_CATALOG.get(id)
    expect(entry).toBeDefined()
    expect(entry === undefined ? ['missing'] : validateScenario(entry.scenario)).toEqual([])
  })

  it.each(ALL_IDS)('%s settles on the real page without any refusal', (id) => {
    const { runtime } = play(id)
    expect(runtime.settled()).toBe(true)
    expect(runtime.log().filter((entry) => entry.event.kind.endsWith('Refused'))).toEqual([])
  })
})

describe('scenario target states', () => {
  it('radial: the ring is open on its first sector', () => {
    const { page } = play(ScenarioId.Radial)
    const { radial, mode } = page.state()
    expect(mode).toBe(UiMode.Radial)
    expect(radial.level).toBe(RadialLevel.Sectors)
    expect(radial.entries).toHaveLength(RADIAL_SECTORS)
  })

  it('radial-children: the ring is open on the children of a sector', () => {
    const { page } = play(ScenarioId.RadialChildren)
    expect(page.state().mode).toBe(UiMode.Radial)
    expect(page.state().radial.level).toBe(RadialLevel.Children)
    expect(page.state().radial.childIndex).not.toBeNull()
  })

  it('whitelist-list: the first page of the players, with its counter', () => {
    const { page } = play(ScenarioId.WhitelistList)
    const panel = topFrame(page.state())?.panel?.panel
    expect(page.state().stack).toHaveLength(1)
    expect(panel?.id).toBe('whitelist/list')
    expect(panel?.items).toHaveLength(LIST_ROWS)
    expect(panel?.subtitle).toBe(`Page 1 sur ${PAGE_COUNT} · ${PLAYERS} joueurs`)
  })

  it('whitelist: the radial is open with the whitelist among its sectors', () => {
    const { page } = play(ScenarioId.Whitelist)
    expect(page.state().mode).toBe(UiMode.Radial)
    expect(page.state().radial.entries.map((owned) => owned.entry.id)).toContain('whitelist/whitelist')
  })

  it('long-list: one thousand rows in a single panel', () => {
    const { page } = play(ScenarioId.LongList)
    const panel = topFrame(page.state())?.panel?.panel
    expect(panel?.kind).toBe(PanelKind.Menu)
    expect(panel?.items).toHaveLength(LONG_LIST_ROWS)
  })

  it('disabled-focused: the focus rests on a disabled row that keeps its reason', () => {
    const { page } = play(ScenarioId.DisabledFocused)
    const frame = topFrame(page.state())
    const focused = frame?.panel?.panel.items.find((item) => item.id === frame.focusItemId)
    expect(focused?.kind).toBe(ItemKind.Action)
    expect(focused !== undefined && 'disabled' in focused ? focused.disabled?.reason : undefined).toEqual(expect.any(String))
  })

  it('form-errors: the form is back in editing with two fields in error', () => {
    const { page } = play(ScenarioId.FormErrors)
    const form = topFrame(page.state())?.form
    expect(form?.status).toBe(FormStatus.Editing)
    expect(Object.keys(form?.errors ?? {})).toHaveLength(FORM_ERRORS)
  })

  it('form-pending: the form was submitted and waits for the resource', () => {
    const { page } = play(ScenarioId.FormPending)
    expect(topFrame(page.state())?.form?.status).toBe(FormStatus.Pending)
  })

  it.each([
    [ScenarioId.KeyboardLetters, KeyboardLayer.Letters],
    [ScenarioId.KeyboardAccents, KeyboardLayer.AccentsDigits],
    [ScenarioId.KeyboardSymbols, KeyboardLayer.Symbols],
  ])('%s: the virtual keyboard is open on its layer', (id, layer) => {
    const { page } = play(id)
    const top = topFrame(page.state())?.layers[0]
    expect(top?.kind).toBe(LayerKind.Keyboard)
    expect(top?.kind === LayerKind.Keyboard ? top.keyboard.layer : null).toBe(layer)
  })

  it('confirm-danger: a danger confirmation covers the list', () => {
    const { page } = play(ScenarioId.ConfirmDanger)
    const layer = topFrame(page.state())?.layers[0]
    expect(layer?.kind).toBe(LayerKind.Confirm)
    expect(layer?.kind === LayerKind.Confirm ? [layer.origin, layer.content.danger] : []).toEqual([ConfirmOrigin.Request, true])
  })

  it('toasts: four visible, the others waiting, every tone shown', () => {
    const { page } = play(ScenarioId.Toasts)
    const { visible, waiting } = page.state().toasts
    expect(visible).toHaveLength(NOTIFICATIONS_VISIBLE)
    expect(waiting).toHaveLength(BEYOND_VISIBLE)
    const tones = new Set([...visible, ...waiting].map((toast) => toast.owned.notification.tone))
    expect(tones).toEqual(new Set(Object.values(NotificationTone)))
    expect(tones.size).toBe(TONES)
  })

  it('prompt-hold: the prompt is held down', () => {
    const { page } = play(ScenarioId.PromptHold)
    expect(page.state().prompt?.state).toBe(PromptState.Holding)
    expect(page.state().prompt?.holdMs).toBe(PROMPT_HOLD_MS)
  })
})
