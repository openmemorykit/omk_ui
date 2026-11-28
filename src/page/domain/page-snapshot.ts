import type { JsonObject, JsonValue } from '../../shared/report/json-value'
import { FormField, KeyboardField, PageSnapshotField, SnapshotPanelField } from '../../shared/report/snapshot-fields'
import { LayerKind, type Frame, type UiState } from './ui-state'

const NO_ID = null

function panelEntry(frame: Frame): JsonObject {
  return { [SnapshotPanelField.Id]: frame.panel?.panel.id ?? NO_ID, [SnapshotPanelField.Focus]: frame.focusItemId }
}

function keyboardEntry(state: UiState): Readonly<Record<string, JsonValue>> {
  const top = state.stack[state.stack.length - 1]
  const layer = top?.layers.find((candidate) => candidate.kind === LayerKind.Keyboard)
  if (layer === undefined || layer.kind !== LayerKind.Keyboard) return {}
  const { keyboard } = layer
  return {
    [PageSnapshotField.Keyboard]: {
      [KeyboardField.Name]: LayerKind.Keyboard,
      [KeyboardField.Layer]: keyboard.layer,
      [KeyboardField.Length]: keyboard.value.length,
      [KeyboardField.Max]: keyboard.maxLength,
    },
  }
}

function formEntry(state: UiState): Readonly<Record<string, JsonValue>> {
  const frame = [...state.stack].reverse().find((candidate) => candidate.form !== null)
  if (frame === undefined || frame.form === null) return {}
  return {
    [PageSnapshotField.Form]: {
      [FormField.Panel]: frame.panel?.panel.id ?? NO_ID,
      [FormField.State]: frame.form.status,
      [FormField.Submission]: frame.form.submissionId,
      [FormField.Errors]: Object.keys(frame.form.errors).length,
    },
  }
}

export function pageSnapshot(state: UiState): JsonObject {
  return {
    mode: state.mode,
    paused: state.paused,
    modality: state.modality,
    escapeHeld: state.escapeHeld,
    lastIntentSeq: state.lastIntentSeq,
    radialLevel: state.radial.level,
    radialEntries: state.radial.entries.length,
    waitingToasts: state.toasts.waiting.length,
    prompt: state.prompt?.prompt.prompt.id ?? NO_ID,
    [PageSnapshotField.AppliedCommandSeq]: state.appliedCommandSeq,
    [PageSnapshotField.Panels]: state.stack.map(panelEntry),
    [PageSnapshotField.RadialPosition]: state.radial.sectorIndex,
    [PageSnapshotField.NotificationsVisible]: state.toasts.visible.length,
    [PageSnapshotField.HeldIntents]: state.held.map(({ intent }) => intent),
    ...keyboardEntry(state),
    ...formEntry(state),
  }
}
