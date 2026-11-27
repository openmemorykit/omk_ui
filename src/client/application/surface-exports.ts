import { CALL_DONE, IdentifierSchema, NotificationSchema, PromptSchema, RadialEntrySchema, type CallResult } from '@openmemorykit/ui/contract'
import { ToPage } from '../../protocol/to-page'
import { addRadialEntry, hidePrompt, radialOrder, removeRadialEntry, showPrompt, type RegistryOutcome, type RegistryState } from '../domain/owner-registry'
import type { ContractCall } from './call-refusals'
import { withArguments } from './export-arguments'
import { deliverNotification } from './notification-queue'
import { ExportParameterName } from './panel-exports'
import { afterPromptsChanged } from './prompt-sync'
import { commitToRegistry, sendToReadyPage } from './registry-commit'
import type { UseCaseContext } from './use-case-context'

type RegistryEdit = (registry: RegistryState) => RegistryOutcome

const ENTRY_PARAMETER = { name: ExportParameterName.Entry, schema: RadialEntrySchema }
const ENTRY_ID_PARAMETER = { name: ExportParameterName.EntryId, schema: IdentifierSchema }
const PROMPT_PARAMETER = { name: ExportParameterName.Prompt, schema: PromptSchema }
const PROMPT_ID_PARAMETER = { name: ExportParameterName.PromptId, schema: IdentifierSchema }
const NOTIFICATION_PARAMETER = { name: ExportParameterName.Notification, schema: NotificationSchema }

function changeRadialEntries(context: UseCaseContext, call: ContractCall, edit: RegistryEdit): CallResult {
  const previous = context.store.read().registry
  const result = commitToRegistry(context, call, edit)
  const { registry } = context.store.read()
  if (registry.radialEntries !== previous.radialEntries) sendToReadyPage(context, { type: ToPage.RadialEntries, entries: radialOrder(registry) })
  return result
}

function changePrompts(context: UseCaseContext, call: ContractCall, edit: RegistryEdit): CallResult {
  const previous = context.store.read().registry
  const result = commitToRegistry(context, call, edit)
  afterPromptsChanged(context, previous)
  return result
}

export const addRadialEntryExport = withArguments([ENTRY_PARAMETER], (context, call, [entry]) =>
  changeRadialEntries(context, call, (registry) => addRadialEntry(registry, call.owner, entry)),
)

export const removeRadialEntryExport = withArguments([ENTRY_ID_PARAMETER], (context, call, [entryId]) =>
  changeRadialEntries(context, call, (registry) => removeRadialEntry(registry, call.owner, entryId)),
)

export const showPromptExport = withArguments([PROMPT_PARAMETER], (context, call, [prompt]) =>
  changePrompts(context, call, (registry) => showPrompt(registry, call.owner, prompt)),
)

export const hidePromptExport = withArguments([PROMPT_ID_PARAMETER], (context, call, [promptId]) =>
  changePrompts(context, call, (registry) => hidePrompt(registry, call.owner, promptId)),
)

export const notifyExport = withArguments([NOTIFICATION_PARAMETER], (context, call, [notification]) => {
  deliverNotification(context, call.owner, notification)
  return CALL_DONE
})
