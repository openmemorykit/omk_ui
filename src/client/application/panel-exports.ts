import { CALL_DONE, ConfirmRequestSchema, ContractErrorCode, FormResultSchema, IdentifierSchema, PanelSchema, type CallResult } from '@openmemorykit/ui/contract'
import * as v from 'valibot'
import { namespaceId } from '../../protocol/namespaced-id'
import { toPagePanel } from '../../protocol/owned'
import { ToPage } from '../../protocol/to-page'
import { checkFormOwner, closePanel, openPanel, pushPanel, showConfirm, updatePanel } from '../domain/owner-registry'
import { refuseCall, refuseOpening, type ContractCall } from './call-refusals'
import { withArguments } from './export-arguments'
import { ownerCallBlocker } from './open-gate'
import { commitToRegistry, sendToReadyPage } from './registry-commit'
import { endReservation } from './reservation'
import type { UseCaseContext } from './use-case-context'

export const ExportParameterName = {
  Panel: 'panel',
  PanelId: 'panelId',
  ParentId: 'parentId',
  SubmissionId: 'submissionId',
  Result: 'result',
  Confirm: 'confirm',
  Notification: 'notification',
  Entry: 'entry',
  EntryId: 'entryId',
  Prompt: 'prompt',
  PromptId: 'promptId',
} as const

const SUBMISSION_ID_MIN = 0
const SubmissionIdSchema = v.pipe(
  v.number(ContractErrorCode.WrongType),
  v.safeInteger(ContractErrorCode.WrongType),
  v.minValue(SUBMISSION_ID_MIN, ContractErrorCode.OutOfRange),
)

export const PANEL_PARAMETER = { name: ExportParameterName.Panel, schema: PanelSchema }
export const PANEL_ID_PARAMETER = { name: ExportParameterName.PanelId, schema: IdentifierSchema }
const PARENT_ID_PARAMETER = { name: ExportParameterName.ParentId, schema: IdentifierSchema }
const SUBMISSION_ID_PARAMETER = { name: ExportParameterName.SubmissionId, schema: SubmissionIdSchema }
const RESULT_PARAMETER = { name: ExportParameterName.Result, schema: FormResultSchema }
const CONFIRM_PARAMETER = { name: ExportParameterName.Confirm, schema: ConfirmRequestSchema }

function releaseReservationFor(context: UseCaseContext, owner: string, result: CallResult): CallResult {
  if (result === CALL_DONE && context.store.read().gate.reservedFor === owner) endReservation(context)
  return result
}

function blockedOpening(context: UseCaseContext, call: ContractCall): CallResult | null {
  const blocker = ownerCallBlocker(context, call.owner)
  return blocker === null ? null : refuseOpening(context, call, blocker)
}

export const openPanelExport = withArguments([PANEL_PARAMETER], (context, call, [panel]) => {
  const blocked = blockedOpening(context, call)
  if (blocked !== null) return blocked
  return releaseReservationFor(context, call.owner, commitToRegistry(context, call, (registry) => openPanel(registry, call.owner, panel)))
})

export const pushPanelExport = withArguments([PANEL_PARAMETER, PARENT_ID_PARAMETER], (context, call, [panel, parentId]) =>
  commitToRegistry(context, call, (registry) => pushPanel(registry, call.owner, panel, parentId)),
)

export const updatePanelExport = withArguments([PANEL_PARAMETER], (context, call, [panel]) => {
  const result = commitToRegistry(context, call, (registry) => updatePanel(registry, call.owner, panel))
  if (result === CALL_DONE) sendToReadyPage(context, { type: ToPage.UpdatePanel, panel: toPagePanel(call.owner, panel) })
  return result
})

export const closePanelExport = withArguments([PANEL_ID_PARAMETER], (context, call, [panelId]) =>
  commitToRegistry(context, call, (registry) => closePanel(registry, call.owner, panelId)),
)

export const resolveFormExport = withArguments([PANEL_ID_PARAMETER, SUBMISSION_ID_PARAMETER, RESULT_PARAMETER], (context, call, [panelId, submissionId, result]) => {
  const notOwned = checkFormOwner(context.store.read().registry, call.owner, panelId)
  if (notOwned !== null) return refuseCall(context, call, [notOwned])
  sendToReadyPage(context, { type: ToPage.ResolveForm, panelId: namespaceId(call.owner, panelId), submissionId, result })
  return CALL_DONE
})

export const confirmExport = withArguments([CONFIRM_PARAMETER], (context, call, [confirm]) => {
  const blocked = blockedOpening(context, call)
  if (blocked !== null) return blocked
  return commitToRegistry(context, call, (registry) => showConfirm(registry, call.owner, confirm))
})
