import { convarChoice, readConvar, type ValueOf } from '@openmemorykit/core/shared'
import { ReportKind } from '../../shared/report/report-kind'
import { decideFocus, PushToTalkPolicy, type FocusDecision } from '../domain/focus-policy'
import { GuardKind, guardedControls } from '../domain/release-guard'
import type { ClientPorts } from './ports'
import type { ClientSession, SessionStore } from './session-state'
import { traceLine } from './trace'

export const PUSH_TO_TALK_CONVAR = 'omk_ui_ptt'

export const FocusApplyReason = { ModeChanged: 'modeChanged', ModalityChanged: 'modalityChanged', Resumed: 'resumed', EscapeWait: 'escapeWait' } as const
export type FocusApplyReason = ValueOf<typeof FocusApplyReason>

const PushToTalkSchema = convarChoice(PushToTalkPolicy)

export function decideSessionFocus(ports: ClientPorts, session: ClientSession): FocusDecision {
  return decideFocus({
    mode: session.mode,
    modality: session.modality,
    paused: session.paused,
    awaitingEscapeRelease: session.guard.kind === GuardKind.Escape,
    releaseGuardControls: guardedControls(session.guard),
    textEntryActive: session.textEntry,
    pushToTalk: readConvar(ports.convars, PUSH_TO_TALK_CONVAR, PushToTalkSchema, PushToTalkPolicy.Blocked).value,
  })
}

export function applyFocus(ports: ClientPorts, store: SessionStore, reason: FocusApplyReason): void {
  const session = store.read()
  if (session.paused) return
  const decision = decideSessionFocus(ports, session)
  if (!decision.focus) return
  ports.nui.setFocus(true, decision.cursor)
  ports.nui.setKeepInput(false)
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.FocusApplied, data: { focus: true, cursor: decision.cursor, keepInput: false, reason } })
}
