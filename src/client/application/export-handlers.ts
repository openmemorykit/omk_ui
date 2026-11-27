import { KitExport } from '@openmemorykit/ui/contract'
import type { ExportHandler } from './export-arguments'
import { closePanelExport, confirmExport, openPanelExport, pushPanelExport, resolveFormExport, updatePanelExport } from './panel-exports'
import { addRadialEntryExport, hidePromptExport, notifyExport, removeRadialEntryExport, showPromptExport } from './surface-exports'

export const EXPORT_HANDLERS: Readonly<Record<KitExport, ExportHandler>> = Object.freeze({
  [KitExport.OpenPanel]: openPanelExport,
  [KitExport.PushPanel]: pushPanelExport,
  [KitExport.UpdatePanel]: updatePanelExport,
  [KitExport.ClosePanel]: closePanelExport,
  [KitExport.ResolveForm]: resolveFormExport,
  [KitExport.Confirm]: confirmExport,
  [KitExport.Notify]: notifyExport,
  [KitExport.AddRadialEntry]: addRadialEntryExport,
  [KitExport.RemoveRadialEntry]: removeRadialEntryExport,
  [KitExport.ShowPrompt]: showPromptExport,
  [KitExport.HidePrompt]: hidePromptExport,
})
