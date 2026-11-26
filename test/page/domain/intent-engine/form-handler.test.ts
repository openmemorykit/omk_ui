import { CloseReason, FormOutcome, ReplyKind, type FormResult } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { FORM_TIMEOUT_MS, FormStatus } from '../../../../src/page/domain/form'
import { FORM_SUBMIT_ROW_ID } from '../../../../src/page/domain/form-handler'
import { transition } from '../../../../src/page/domain/intent-engine'
import { TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { schedule, sendToHost } from '../../../../src/page/domain/ui-effects'
import type { UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { ToPage } from '../../../../src/protocol/to-page'
import { ReportKind } from '../../../../src/shared/report/report-kind'
import { IDENTIFIER_TEXT, NOTIFY_TOGGLE, ROLE_CYCLE } from '../../../fixtures/items'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { ADD_PANEL } from '../../../fixtures/panels'
import { NOW, press, pushPanel, run, timerFired, withPanels } from './engine-helpers'
import { click, focusedAnnouncement, formErrorsAnnouncement, formWith, REPEAT_SCHEDULE, replyEvent, stackEventOf, topFrame, VALID_IDENTIFIER } from './handler-helpers'

const OWNER = FixtureOwner.Whitelist
const FORM_ID = OWNED_ADD_PANEL.panel.id
const LIST_ID = OWNED_LIST_PANEL.panel.id
const VALID_FORM = formWith([{ ...IDENTIFIER_TEXT, value: VALID_IDENTIFIER }, ROLE_CYCLE, NOTIFY_TOGGLE])
const SECOND_FORM = formWith([{ ...IDENTIFIER_TEXT, value: VALID_IDENTIFIER }], 'second')
const LATER_MS = 3000
const EARLY_MS = 4000
const ROWS = 4
const TWO_ERRORS = 2
const PUSH_SEQ = 3

function opened(form = OWNED_ADD_PANEL): UiState {
  return withPanels([OWNED_LIST_PANEL, form])
}

function resolve(result: FormResult, submissionId = 1, panelId = FORM_ID): UiCommand {
  return { type: ToPage.ResolveForm, panelId, submissionId, result }
}

function submitted(panelId: string, values: Readonly<Record<string, string | boolean>>): ReturnType<typeof replyEvent> {
  return replyEvent(OWNER, { kind: ReplyKind.FormSubmitted, panelId, submissionId: 1, values })
}

function timedOutTrace(panelId: string): ReturnType<typeof sendToHost> {
  return sendToHost({ type: FromPage.Trace, kind: ReportKind.FormTimeout, data: { owner: OWNER, panelId, submissionId: 1 } })
}

describe('form rows', () => {
  it('adds the submit row at the end of the focus cycle', () => {
    const downs = [ROWS - 1, ROWS].map((count) => topFrame(run(opened(), Array.from({ length: count }, () => press(Intent.Down))).state).focusItemId)
    expect(downs).toEqual([FORM_SUBMIT_ROW_ID, 'identifier'])
    const raised = transition(opened(), press(Intent.Up), NOW)
    expect(topFrame(raised.state).focusItemId).toBe(FORM_SUBMIT_ROW_ID)
    expect(raised.effects).toEqual([REPEAT_SCHEDULE, focusedAnnouncement(FORM_ID, FORM_SUBMIT_ROW_ID, ADD_PANEL.submitLabel)])
  })

  it('keeps the focus on the submit row across an update of the form', () => {
    const onSubmit = run(opened(VALID_FORM), [press(Intent.Up)]).state
    expect(topFrame(run(onSubmit, [{ type: ToPage.UpdatePanel, panel: VALID_FORM }]).state).focusItemId).toBe(FORM_SUBMIT_ROW_ID)
  })

  it('keeps Cycle and Toggle values in the form without ValueChanged', () => {
    const next = run(opened(), [click('role'), click('notify')])
    expect(next.effects).toEqual([])
    expect([topFrame(next.state).form?.values.role, topFrame(next.state).form?.values.notify]).toEqual(['staff', true])
  })
})

describe('form submission', () => {
  it('refuses an invalid form: errors, focus on the first field in error, FormErrors announced', () => {
    const next = transition(opened(), click(FORM_SUBMIT_ROW_ID), NOW)
    expect(next.effects).toEqual([formErrorsAnnouncement(FORM_ID, 1)])
    const frame = topFrame(next.state)
    expect([frame.focusItemId, frame.form?.status, Object.keys(frame.form?.errors ?? {})]).toEqual(['identifier', FormStatus.Editing, ['identifier']])
  })

  it('submits a valid form: Pending, FormSubmitted in an Event, form delay scheduled', () => {
    const next = transition(opened(VALID_FORM), click(FORM_SUBMIT_ROW_ID), NOW)
    expect(next.effects).toEqual([submitted(FORM_ID, { identifier: VALID_IDENTIFIER, role: 'member', notify: false }), schedule(TimerKind.FormTimeout, FORM_TIMEOUT_MS)])
    expect(topFrame(next.state).form?.status).toBe(FormStatus.Pending)
  })

  it('keeps fields and submit row inert while pending', () => {
    const pending = run(opened(VALID_FORM), [click(FORM_SUBMIT_ROW_ID)]).state
    ;['notify', 'role', 'identifier', FORM_SUBMIT_ROW_ID].forEach((itemId) => {
      const next = transition(pending, click(itemId), NOW)
      expect([itemId, next.effects, next.state.stack[1]?.form]).toEqual([itemId, [], pending.stack[1]?.form])
    })
  })
})

describe('form resolution', () => {
  const pending = (): UiState => run(opened(VALID_FORM), [click(FORM_SUBMIT_ROW_ID)]).state

  it('closes the frame on Accepted', () => {
    const next = transition(pending(), resolve({ outcome: FormOutcome.Accepted }), NOW)
    expect(next.effects).toEqual([
      stackEventOf({ appliedCommandSeq: 2, entries: [{ panelId: LIST_ID, owner: OWNER }] }, OWNER, { kind: ReplyKind.PanelClosed, panelId: FORM_ID, reason: CloseReason.ClosedByOwner }),
    ])
  })

  it('keeps the frame open on Accepted with keepOpen', () => {
    const next = transition(pending(), resolve({ outcome: FormOutcome.Accepted, keepOpen: true }), NOW)
    expect(next.effects).toEqual([])
    expect(topFrame(next.state).form?.status).toBe(FormStatus.Editing)
  })

  it('shows a Rejected answer and announces the form errors', () => {
    const next = transition(pending(), resolve({ outcome: FormOutcome.Rejected, fieldErrors: { identifier: 'Unknown player', role: 'Too high' }, message: 'Nope' }), NOW)
    expect(next.effects).toEqual([formErrorsAnnouncement(FORM_ID, TWO_ERRORS)])
    const form = topFrame(next.state).form
    expect([form?.status, form?.message, Object.keys(form?.errors ?? {})]).toEqual([FormStatus.Rejected, 'Nope', ['identifier', 'role']])
  })

  it('announces a bare Rejected answer too', () => {
    expect(transition(pending(), resolve({ outcome: FormOutcome.Rejected }), NOW).effects).toEqual([formErrorsAnnouncement(FORM_ID, 0)])
  })

  it('ignores an older submission', () => {
    const state = pending()
    expect(transition(state, resolve({ outcome: FormOutcome.Rejected }, 0), NOW)).toEqual({ state, effects: [] })
  })
})

describe('form delay', () => {
  const pending = (): UiState => run(opened(VALID_FORM), [click(FORM_SUBMIT_ROW_ID)]).state

  it('goes back to Editing after the delay, with a FormTimeout trace', () => {
    const next = transition(pending(), timerFired(TimerKind.FormTimeout), NOW + FORM_TIMEOUT_MS)
    expect(next.effects).toEqual([timedOutTrace(FORM_ID)])
    const form = topFrame(next.state).form
    expect([form?.status, form?.timedOut]).toEqual([FormStatus.Editing, true])
  })

  it('schedules the rest of the delay when the timer fires early', () => {
    const next = transition(pending(), timerFired(TimerKind.FormTimeout), NOW + EARLY_MS)
    expect(next.effects).toEqual([schedule(TimerKind.FormTimeout, FORM_TIMEOUT_MS - EARLY_MS)])
    expect(topFrame(next.state).form?.status).toBe(FormStatus.Pending)
  })

  it('expires every due form and schedules the next one', () => {
    const first = run(withPanels([OWNED_LIST_PANEL, VALID_FORM]), [click(FORM_SUBMIT_ROW_ID), pushPanel(SECOND_FORM, FORM_ID, PUSH_SEQ)]).state
    const both = run(first, [click(FORM_SUBMIT_ROW_ID)], NOW + LATER_MS).state
    const next = transition(both, timerFired(TimerKind.FormTimeout), NOW + FORM_TIMEOUT_MS)
    expect(next.effects).toEqual([timedOutTrace(FORM_ID), schedule(TimerKind.FormTimeout, LATER_MS)])
    expect(next.state.stack.map((frame) => frame.form?.status ?? null)).toEqual([null, FormStatus.Editing, FormStatus.Pending])
  })

  it('does nothing without a pending form', () => {
    const state = opened()
    expect(transition(state, timerFired(TimerKind.FormTimeout), NOW + FORM_TIMEOUT_MS)).toEqual({ state, effects: [] })
  })
})
