import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, shallowRef } from 'vue'
import type { UiStore } from '../../../src/page/application/ports'
import { UI_CONTEXT, useUi, type UiContext } from '../../../src/page/components/use-ui'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import { createVueStore } from '../../../src/page/infrastructure/vue-store'
import { UiMode } from '../../../src/protocol/page-vocabulary'

const VIEWPORT = { width: 1920, height: 1080 }

interface FakeStore {
  readonly store: UiStore
  push(state: UiState): void
  subscribers(): number
}

function createFakeStore(initial: UiState): FakeStore {
  const listeners = new Set<(state: UiState) => void>()
  let current = initial
  return {
    store: {
      dispatch: () => undefined,
      state: () => current,
      subscribe(listener) {
        listeners.add(listener)
        return () => void listeners.delete(listener)
      },
    },
    push(state) {
      current = state
      listeners.forEach((listener) => listener(state))
    },
    subscribers: () => listeners.size,
  }
}

describe('createVueStore', () => {
  it('starts from the store state', () => {
    const initial = createInitialState()
    expect(createVueStore(createFakeStore(initial).store).state.value).toBe(initial)
  })

  it('replaces the shallow ref with each new state, without deep proxies', () => {
    const fake = createFakeStore(createInitialState())
    const { state } = createVueStore(fake.store)
    const next = { ...createInitialState(), mode: UiMode.Radial }
    fake.push(next)
    expect(state.value).toBe(next)
  })

  it('re-renders a reader on each transition', async () => {
    const fake = createFakeStore(createInitialState())
    const { state } = createVueStore(fake.store)
    const wrapper = mount(defineComponent({ setup: () => () => h('p', state.value.mode) }))
    fake.push({ ...createInitialState(), mode: UiMode.Panels })
    await nextTick()
    expect(wrapper.text()).toBe(UiMode.Panels)
  })

  it('stops following the store once stopped', () => {
    const fake = createFakeStore(createInitialState())
    const bound = createVueStore(fake.store)
    const before = bound.state.value
    bound.stop()
    bound.stop()
    fake.push({ ...createInitialState(), mode: UiMode.Waiting })
    expect(bound.state.value).toBe(before)
    expect(fake.subscribers()).toBe(0)
  })
})

describe('useUi', () => {
  function context(): UiContext {
    return {
      state: shallowRef(createInitialState()),
      dispatch: () => undefined,
      translate: (key) => key,
      viewport: shallowRef(VIEWPORT),
    }
  }

  it('returns the provided context', () => {
    const provided = context()
    let seen: UiContext | null = null
    mount(defineComponent({
      setup() {
        seen = useUi()
        const mode = computed(() => seen?.state.value.mode)
        return () => h('p', mode.value)
      },
    }), { global: { provide: { [UI_CONTEXT as symbol]: provided } } })
    expect(seen).toBe(provided)
  })

  it('fails loudly when no context is provided', () => {
    const Reader = defineComponent({
      setup() {
        useUi()
        return () => h('p')
      },
    })
    expect(() => mount(Reader, { global: { config: { warnHandler: () => undefined } } })).toThrow()
  })
})
