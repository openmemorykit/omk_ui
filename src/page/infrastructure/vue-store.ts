import { shallowRef, type ShallowRef } from 'vue'
import type { UiStore } from '../application/ports'
import type { UiState } from '../domain/ui-state'

export interface VueStore {
  readonly state: ShallowRef<UiState>
  stop(): void
}

export function createVueStore(store: UiStore): VueStore {
  const state = shallowRef(store.state())
  const unsubscribe = store.subscribe((next) => {
    state.value = next
  })
  return { state, stop: unsubscribe }
}
