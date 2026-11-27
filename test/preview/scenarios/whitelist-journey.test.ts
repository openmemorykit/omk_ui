import type { Panel } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { ScenarioId, LogKind } from '../../../preview/runtime/types'
import { FormStatus } from '../../../src/page/domain/form'
import { PageCommandType } from '../../../src/page/domain/page-commands'
import { LayerKind } from '../../../src/page/domain/ui-state'
import { FromPage } from '../../../src/protocol/from-page'
import { Intent } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { play, press, topFrame, type Played } from './scenario-harness'
import { createPlayers } from '../../../preview/runtime/fake-whitelist'

const PLAYERS = 342
const MAX_STEPS = 60
const FORM_OVER_LIST = 2
const TARGET_ID = 'player-0002'
const IDENTIFIER_CHARACTERS = 'license:'

function toWhitelistPanel(): Played {
  const played = play(ScenarioId.Whitelist)
  press(played.page, Intent.Left)
  press(played.page, Intent.Confirm)
  press(played.page, Intent.Confirm)
  return played
}

function focusOn(played: Played, itemId: string): void {
  for (let step = 0; step < MAX_STEPS && topFrame(played.page.state())?.focusItemId !== itemId; step += 1) press(played.page, Intent.Down)
  expect(topFrame(played.page.state())?.focusItemId).toBe(itemId)
}

const panelOf = (played: Played): Panel | undefined => topFrame(played.page.state())?.panel?.panel
const subtitleOf = (played: Played): string | undefined => panelOf(played)?.subtitle
const toastTitles = (played: Played): readonly string[] => played.page.state().toasts.visible.map((toast) => toast.owned.notification.title)

function openAddForm(played: Played): void {
  focusOn(played, 'add')
  press(played.page, Intent.Confirm)
  expect(topFrame(played.page.state())?.panel?.panel.id).toBe('whitelist/add')
}

function typeIdentifier(played: Played, value: string): void {
  press(played.page, Intent.Confirm)
  expect(topFrame(played.page.state())?.layers[0]?.kind).toBe(LayerKind.Keyboard)
  played.page.dispatch({ type: PageCommandType.TypeText, value })
  press(played.page, Intent.Submit)
  press(played.page, Intent.Down)
  press(played.page, Intent.Confirm)
}

describe('whitelist journey on the real page', () => {
  it('opens the list from the radial', () => {
    const played = toWhitelistPanel()
    expect(played.page.state().mode).toBe(UiMode.Panels)
    expect(panelOf(played)?.id).toBe('whitelist/list')
    expect(subtitleOf(played)).toBe(`Page 1 sur 7 · ${PLAYERS} joueurs`)
  })

  it('turns to the next page and lands the focus on the same link', () => {
    const played = toWhitelistPanel()
    focusOn(played, 'next-page')
    press(played.page, Intent.Confirm)
    expect(subtitleOf(played)).toBe(`Page 2 sur 7 · ${PLAYERS} joueurs`)
    expect(topFrame(played.page.state())?.focusItemId).toBe('next-page')
    press(played.page, Intent.Confirm)
    expect(subtitleOf(played)).toBe(`Page 3 sur 7 · ${PLAYERS} joueurs`)
  })

  it('flips the switch and notifies the result', () => {
    const played = toWhitelistPanel()
    focusOn(played, 'enabled')
    press(played.page, Intent.Confirm)
    expect(toastTitles(played)).toEqual(['Whitelist désactivée'])
    press(played.page, Intent.Confirm)
    expect(toastTitles(played)).toEqual(['Whitelist désactivée', 'Whitelist activée'])
  })

  it('adds a player through the virtual keyboard: accepted by the page then by the server', () => {
    const played = toWhitelistPanel()
    openAddForm(played)
    typeIdentifier(played, `${IDENTIFIER_CHARACTERS}feed00beef01`)
    expect(played.page.state().stack.map((frame) => frame.panel?.panel.id)).toEqual(['whitelist/list'])
    expect(subtitleOf(played)).toBe(`Page 1 sur 7 · ${PLAYERS + 1} joueurs`)
    expect(toastTitles(played)).toEqual(['Joueur ajouté'])
  })

  it('refuses an identifier the page rejects before the server hears of it', () => {
    const played = toWhitelistPanel()
    openAddForm(played)
    typeIdentifier(played, 'nonsense')
    expect(topFrame(played.page.state())?.form?.status).toBe(FormStatus.Editing)
    expect(Object.keys(topFrame(played.page.state())?.form?.errors ?? {})).toEqual(['identifier'])
    expect(played.page.sent.some((message) => message.type === FromPage.Event && JSON.stringify(message).includes('formSubmitted'))).toBe(false)
  })

  it('shows the server refusal for an identifier already allowed and keeps the form open', () => {
    const played = toWhitelistPanel()
    const [first] = createPlayers(1)
    openAddForm(played)
    typeIdentifier(played, first?.identifier ?? '')
    const form = topFrame(played.page.state())?.form
    expect(played.page.state().stack).toHaveLength(FORM_OVER_LIST)
    expect(form?.status).toBe(FormStatus.Rejected)
    expect(Object.values(form?.errors ?? {}).map((error) => error.message)).toContain('Cet identifiant est déjà autorisé')
    expect(played.page.state().stack[0]?.panel?.panel.subtitle).toBe(`Page 1 sur 7 · ${PLAYERS} joueurs`)
  })

  it('removes a player after a confirmed danger prompt', () => {
    const played = toWhitelistPanel()
    focusOn(played, TARGET_ID)
    press(played.page, Intent.Confirm)
    const layer = topFrame(played.page.state())?.layers[0]
    expect(layer?.kind).toBe(LayerKind.Confirm)
    expect(layer?.kind === LayerKind.Confirm ? layer.content.danger : false).toBe(true)
    press(played.page, Intent.Down)
    press(played.page, Intent.Confirm)
    expect(topFrame(played.page.state())?.layers).toEqual([])
    expect(subtitleOf(played)).toBe(`Page 1 sur 7 · ${PLAYERS - 1} joueurs`)
    expect(panelOf(played)?.items.some((item) => item.id === TARGET_ID)).toBe(false)
    expect(toastTitles(played)).toEqual(['Joueur retiré'])
  })

  it('keeps the player when the confirmation is cancelled', () => {
    const played = toWhitelistPanel()
    focusOn(played, TARGET_ID)
    press(played.page, Intent.Confirm)
    press(played.page, Intent.Back)
    expect(topFrame(played.page.state())?.layers).toEqual([])
    expect(subtitleOf(played)).toBe(`Page 1 sur 7 · ${PLAYERS} joueurs`)
    expect(panelOf(played)?.items.some((item) => item.id === TARGET_ID)).toBe(true)
    expect(toastTitles(played)).toEqual([])
  })

  it('leaves no refused reply in the log along the whole journey', () => {
    const played = toWhitelistPanel()
    openAddForm(played)
    typeIdentifier(played, `${IDENTIFIER_CHARACTERS}feed00beef01`)
    const kinds = played.runtime.log().map((entry) => entry.event.kind)
    expect(kinds).not.toContain(LogKind.ReplyRefused)
    expect(kinds).not.toContain(LogKind.ReplyUndelivered)
  })
})
