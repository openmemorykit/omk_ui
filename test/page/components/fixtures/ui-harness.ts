import { mount, type VueWrapper } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { vi, type Mock } from 'vitest'
import type { Component } from 'vue'
import type { Dispatch } from '../../../../src/page/application/ports'
import { UI_CONTEXT, type UiContext } from '../../../../src/page/components/use-ui'
import { createInitialState, type UiState } from '../../../../src/page/domain/ui-state'
import type { Translate } from '../../../../src/page/i18n/messages'

export interface Harness {
  readonly wrapper: VueWrapper
  readonly dispatch: Mock<Dispatch>
  readonly context: UiContext
}

export interface MountOptions {
  readonly props?: Record<string, unknown>
  readonly state?: UiState
  readonly slots?: Record<string, string>
  readonly translate?: Translate
  readonly attach?: boolean
}

const FULL_HD = { width: 1920, height: 1080 }
const echo: Translate = (key) => key

export function mountWithUi(component: Component, options: MountOptions = {}): Harness {
  const dispatch = vi.fn<Dispatch>()
  const context: UiContext = {
    state: shallowRef(options.state ?? createInitialState()),
    dispatch,
    translate: options.translate ?? echo,
    viewport: shallowRef(FULL_HD),
  }
  const wrapper = mount(component, {
    props: options.props ?? {},
    slots: options.slots ?? {},
    ...(options.attach === true ? { attachTo: document.body } : {}),
    global: { provide: { [UI_CONTEXT as unknown as symbol]: context } },
  })
  return { wrapper: wrapper as VueWrapper, dispatch, context }
}
