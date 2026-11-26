import { CloseReason, FormOutcome, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { FORM_SUBMIT_ROW_ID } from '../../../../src/page/domain/form-handler'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { ConfirmChoice } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import { ToPage } from '../../../../src/protocol/to-page'
import { NOTIFY_TOGGLE } from '../../../fixtures/items'
import { openPanel, press, pushPanel, release, timerFired } from './engine-helpers'
import { click, formWith, hover, NOTE_MENU, PLAIN_TEXT, typeText, VALID_IDENTIFIER } from './handler-helpers'
import { runInvariantLoop } from './invariant-loop'
import { RANDOM_COMMANDS, type Draw } from './invariant-steps'

const RANDOM_STEPS = 6000
const SEED = 20_261_128
const POOL = 4
const EVEN = 2
const TARGETS = ['enabled', 'add', 'player-1', 'purge', 'remove-all', 'identifier', 'role', 'notify', 'note', FORM_SUBMIT_ROW_ID, ConfirmChoice.Confirm, ConfirmChoice.Cancel]

const topOf = (draw: Draw): Draw['state']['stack'][number] | undefined => draw.state.stack[draw.state.stack.length - 1]
const topId = (draw: Draw): string => topOf(draw)?.panel?.panel.id ?? ''
const target = (draw: Draw): string => TARGETS[draw.random % TARGETS.length] ?? 'add'

function plainForm(draw: Draw): ReturnType<typeof formWith> {
  return formWith([PLAIN_TEXT, NOTIFY_TOGGLE], `plain-${String(draw.random % POOL)}`)
}

function rejectTopForm(draw: Draw): UiCommand {
  const result = draw.random % EVEN === 0 ? { outcome: FormOutcome.Rejected } : { outcome: FormOutcome.Rejected, fieldErrors: { note: 'Taken' }, message: 'Nope' }
  return { type: ToPage.ResolveForm, panelId: topId(draw), submissionId: topOf(draw)?.form?.submissionId ?? 0, result }
}

const HANDLER_COMMANDS: readonly ((draw: Draw) => UiCommand)[] = [
  ...RANDOM_COMMANDS,
  () => press(Intent.Up),
  () => press(Intent.Down),
  () => press(Intent.Left),
  () => press(Intent.Confirm),
  () => press(Intent.Back),
  () => release(Intent.Back),
  () => press(Intent.TabNext),
  () => press(Intent.Erase),
  () => press(Intent.Space),
  () => press(Intent.Submit),
  (draw) => typeText(draw.random % EVEN === 0 ? VALID_IDENTIFIER : 'draft'),
  (draw) => click(target(draw)),
  (draw) => click(target(draw)),
  (draw) => hover(target(draw)),
  () => click(FORM_SUBMIT_ROW_ID),
  () => timerFired(TimerKind.BackHold),
  () => timerFired(TimerKind.FormTimeout),
  () => timerFired(TimerKind.LinkPending),
  rejectTopForm,
  (draw) => pushPanel(plainForm(draw), topId(draw), draw.seq),
  (draw) => openPanel(plainForm(draw), draw.seq),
  () => ({ type: PageCommandType.WindowFocused }),
  (draw) => pushPanel({ ...NOTE_MENU, panel: { ...NOTE_MENU.panel, id: `whitelist/notes-${String(draw.random % POOL)}` } }, topId(draw), draw.seq),
]

describe('kit invariants with the real list, confirmation, keyboard and form handlers', () => {
  it('answers each opening and each confirmation exactly once and ends every text entry once', () => {
    const result = runInvariantLoop(HANDLER_COMMANDS, RANDOM_STEPS, SEED)
    expect([result.textEntriesOn > 0, result.textEntriesOff > 0]).toEqual([true, true])
    const expected = [
      ...Object.values(CloseReason).filter((reason) => reason !== CloseReason.KitStopped),
      ReplyKind.ConfirmAnswered,
      ReplyKind.RadialSelected,
      ReplyKind.ItemSelected,
      ReplyKind.ValueChanged,
      ReplyKind.FormSubmitted,
    ]
    expect([...result.reasons].sort()).toEqual(expected.sort())
  })
})
