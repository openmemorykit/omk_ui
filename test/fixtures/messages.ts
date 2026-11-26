import { FormOutcome } from '@openmemorykit/ui/contract'
import { FromPage } from '../../src/protocol/from-page'
import type { FromPageMessageOf } from '../../src/protocol/from-page'
import { InputSource, Intent, IntentPhase, Modality } from '../../src/protocol/intents'
import { GlyphSet, PromptState, UiMode } from '../../src/protocol/page-vocabulary'
import { ToPage } from '../../src/protocol/to-page'
import type { BindingLabels, LocaleBundle, ToPageMessageOf } from '../../src/protocol/to-page'
import { THEME_DEFAULTS } from '../../src/shared/config/config-schema'
import { ReportKind } from '../../src/shared/report/report-kind'
import { deepFrozen } from './frozen'
import { FixtureOwner, OWNED_GARAGE_RADIAL_ENTRY, OWNED_HOLD_PROMPT, OWNED_KEYED_NOTIFICATION, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM, OWNED_WHITELIST_RADIAL_ENTRY } from './owned'
import { OWNED_REPLIES, FIRST_SUBMISSION_ID } from './replies'
import { HOLD_PROMPT_MS } from './surfaces'
import { SHARED_STACK_OWNED, SHARED_STACK_SEQ, SHARED_STACK_SNAPSHOT } from './stack'

export const FIRST_INTENT_SEQ = 1
export const FIRST_SNAPSHOT_REQUEST_ID = 1
export const STICK_HALF = 0.5
export const NEXT_COMMAND_SEQ = SHARED_STACK_SEQ.Push + 1

export const BINDING_LABELS: BindingLabels = deepFrozen({ radial: 'F1', interact: 'E', pushToTalk: 'N' })

export const ENGLISH_LOCALE: LocaleBundle = deepFrozen({ language: 'en', messages: { back: 'Back', closeAll: 'Close all' } })

export const TO_PAGE_SAMPLES: Readonly<{ [Type in ToPage]: ToPageMessageOf<Type> }> = deepFrozen({
  [ToPage.Boot]: {
    type: ToPage.Boot,
    settings: THEME_DEFAULTS,
    locale: ENGLISH_LOCALE,
    glyphSet: GlyphSet.Xbox,
    bindings: BINDING_LABELS,
    radialEntries: [OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY],
    panels: SHARED_STACK_OWNED,
    confirm: null,
    prompt: null,
    commandSeq: SHARED_STACK_SEQ.Push,
  },
  [ToPage.Intent]: { type: ToPage.Intent, seq: FIRST_INTENT_SEQ, intent: Intent.Down, phase: IntentPhase.Press, source: InputSource.Pad },
  [ToPage.Stick]: { type: ToPage.Stick, x: STICK_HALF, y: -STICK_HALF },
  [ToPage.Modality]: { type: ToPage.Modality, modality: Modality.Gamepad },
  [ToPage.OpenRadial]: { type: ToPage.OpenRadial },
  [ToPage.RadialEntries]: { type: ToPage.RadialEntries, entries: [OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY] },
  [ToPage.OpenPanel]: { type: ToPage.OpenPanel, commandSeq: SHARED_STACK_SEQ.Open, panel: SHARED_STACK_OWNED[0] },
  [ToPage.PushPanel]: { type: ToPage.PushPanel, commandSeq: SHARED_STACK_SEQ.Push, panel: SHARED_STACK_OWNED[1], parentId: SHARED_STACK_OWNED[0].panel.id },
  [ToPage.UpdatePanel]: { type: ToPage.UpdatePanel, panel: OWNED_LIST_PANEL },
  [ToPage.ClosePanel]: { type: ToPage.ClosePanel, commandSeq: NEXT_COMMAND_SEQ, panelId: SHARED_STACK_OWNED[1].panel.id },
  [ToPage.ResolveForm]: {
    type: ToPage.ResolveForm,
    panelId: SHARED_STACK_OWNED[1].panel.id,
    submissionId: FIRST_SUBMISSION_ID,
    result: { outcome: FormOutcome.Rejected, fieldErrors: { identifier: 'Already allowed' } },
  },
  [ToPage.ShowConfirm]: { type: ToPage.ShowConfirm, commandSeq: NEXT_COMMAND_SEQ, confirm: OWNED_REMOVE_CONFIRM },
  [ToPage.Notify]: { type: ToPage.Notify, notification: OWNED_KEYED_NOTIFICATION },
  [ToPage.ShowPrompt]: { type: ToPage.ShowPrompt, prompt: OWNED_HOLD_PROMPT },
  [ToPage.PromptProgress]: { type: ToPage.PromptProgress, promptId: OWNED_HOLD_PROMPT.prompt.id, state: PromptState.Holding, holdMs: HOLD_PROMPT_MS },
  [ToPage.HidePrompt]: { type: ToPage.HidePrompt, promptId: OWNED_HOLD_PROMPT.prompt.id },
  [ToPage.DropOwner]: { type: ToPage.DropOwner, commandSeq: NEXT_COMMAND_SEQ, owner: FixtureOwner.Garage },
  [ToPage.GlyphSet]: { type: ToPage.GlyphSet, glyphSet: GlyphSet.PlayStation },
  [ToPage.SnapshotRequest]: { type: ToPage.SnapshotRequest, requestId: FIRST_SNAPSHOT_REQUEST_ID },
})

export const FROM_PAGE_SAMPLES: Readonly<{ [Type in FromPage]: FromPageMessageOf<Type> }> = deepFrozen({
  [FromPage.Ready]: { type: FromPage.Ready },
  [FromPage.Event]: { type: FromPage.Event, event: { stack: SHARED_STACK_SNAPSHOT, replies: OWNED_REPLIES } },
  [FromPage.Ack]: { type: FromPage.Ack, lastIntentSeq: FIRST_INTENT_SEQ },
  [FromPage.ModeChanged]: { type: FromPage.ModeChanged, mode: UiMode.Panels },
  [FromPage.Paused]: { type: FromPage.Paused, paused: true },
  [FromPage.EscapeReleased]: { type: FromPage.EscapeReleased },
  [FromPage.TextEntry]: { type: FromPage.TextEntry, active: true },
  [FromPage.Snapshot]: { type: FromPage.Snapshot, requestId: FIRST_SNAPSHOT_REQUEST_ID, snapshot: { mode: UiMode.Panels, stackDepth: SHARED_STACK_OWNED.length } },
  [FromPage.PageError]: { type: FromPage.PageError, message: 'Cannot read properties of null', stack: 'TypeError: Cannot read properties of null\n    at render (page.js:1:1)' },
  [FromPage.Trace]: { type: FromPage.Trace, kind: ReportKind.ModeChanged, data: {} },
})

export const ESCAPE_HELD_MODE_CHANGED: FromPageMessageOf<typeof FromPage.ModeChanged> = deepFrozen({ type: FromPage.ModeChanged, mode: UiMode.Idle, escapeHeld: true })

export const EMPTY_STACK_EVENT: FromPageMessageOf<typeof FromPage.Event> = deepFrozen({ type: FromPage.Event, event: { stack: null, replies: [] } })
