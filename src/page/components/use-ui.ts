import { inject, type InjectionKey, type ShallowRef } from 'vue'
import type { Dispatch, ViewportSize } from '../application/ports'
import type { UiState } from '../domain/ui-state'
import type { Translate } from '../i18n/messages'

export interface UiContext {
  readonly state: ShallowRef<UiState>
  readonly dispatch: Dispatch
  readonly translate: Translate
  readonly viewport: ShallowRef<ViewportSize>
}

export const UI_CONTEXT: InjectionKey<UiContext> = Symbol('omk-ui-context')

export function useUi(): UiContext {
  const context = inject(UI_CONTEXT, null)
  if (context === null) throw new Error('useUi() needs UI_CONTEXT, provided by createPageApp')
  return context
}
