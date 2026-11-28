import { Modality } from '../../protocol/intents'
import { ToPage } from '../../protocol/to-page'
import { ReportKind } from '../../shared/report/report-kind'
import { applyFocus, FocusApplyReason } from './apply-focus'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'
import { traceLine } from './trace'

export function readModality(ports: ClientPorts): Modality {
  return ports.controls.isUsingKeyboard() ? Modality.KeyboardMouse : Modality.Gamepad
}

export function changeModality(ports: ClientPorts, store: SessionStore, modality: Modality): void {
  const session = store.read()
  if (session.modality === modality) return
  store.write({ ...session, modality })
  ports.nui.send({ type: ToPage.Modality, modality })
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.ModalityChanged, data: { modality } })
  applyFocus(ports, store, FocusApplyReason.ModalityChanged)
}
