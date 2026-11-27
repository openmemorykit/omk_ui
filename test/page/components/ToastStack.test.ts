import { mount, type VueWrapper } from '@vue/test-utils'
import { NOTIFICATIONS_VISIBLE, NotificationTone } from '@openmemorykit/ui/contract'
import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'
import ToastStack from '../../../src/page/components/ToastStack.vue'
import { UI_CONTEXT } from '../../../src/page/components/use-ui'
import { EMPTY_TOASTS, pushToast } from '../../../src/page/domain/toasts'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import { notification, translate } from '../application/views/helpers'

const NOW = 1_000
const EXTRA = 3
const TWINS = 2
const VIEWPORT = { width: 1920, height: 1080 }

function stateWith(...owned: ReturnType<typeof notification>[]): UiState {
  const toasts = owned.reduce((queue, entry) => pushToast(queue, entry, NOW), EMPTY_TOASTS)
  const base = createInitialState()
  return { ...base, toasts }
}

function render(state: UiState): VueWrapper {
  const context = { state: shallowRef(state), dispatch: (): void => undefined, translate, viewport: shallowRef(VIEWPORT) }
  return mount(ToastStack, { global: { provide: { [UI_CONTEXT as symbol]: context } } })
}

describe('ToastStack', () => {
  it('renders nothing visible when there is no notification', () => {
    expect(render(createInitialState()).findAll('[data-surface="toast"]')).toHaveLength(0)
  })

  it.each(Object.values(NotificationTone))('shows the %s tone with its translated label, title and text', (tone) => {
    const toast = render(stateWith(notification(tone, 'Saved', 'All good'))).get('[data-surface="toast"]')
    expect(toast.attributes('data-tone')).toBe(tone)
    expect(toast.text()).toContain(`t:ui.tone.${tone}`)
    expect(toast.text()).toContain('Saved')
    expect(toast.text()).toContain('All good')
    expect(toast.find('svg').exists()).toBe(true)
  })

  it('plays the entry animation from the class of each toast, without the Vue transition machinery', () => {
    const wrapper = render(stateWith(notification(NotificationTone.Info, 'Saved')))
    expect(wrapper.get('[data-surface="toast"]').classes()).toContain('omk-anim-slide')
    expect(wrapper.html()).not.toContain('transition-group')
  })

  it('omits the message paragraph when the notification has no text', () => {
    const toast = render(stateWith(notification(NotificationTone.Info, 'Saved'))).get('[data-surface="toast"]')
    expect(toast.find('.omk-secondary').exists()).toBe(false)
  })

  it('shows at most the visible capacity when the queue is full', () => {
    const many = Array.from({ length: NOTIFICATIONS_VISIBLE + EXTRA }, (_unused, index) => notification(NotificationTone.Info, `Title ${index}`))
    const wrapper = render(stateWith(...many))
    expect(wrapper.findAll('[data-surface="toast"]')).toHaveLength(NOTIFICATIONS_VISIBLE)
    expect(wrapper.text()).not.toContain(`Title ${NOTIFICATIONS_VISIBLE}`)
  })

  it('keeps the waiting notifications out of the page', () => {
    const many = Array.from({ length: NOTIFICATIONS_VISIBLE + 1 }, (_unused, index) => notification(NotificationTone.Warning, `Wait ${index}`))
    expect(render(stateWith(...many)).text()).not.toContain(`Wait ${NOTIFICATIONS_VISIBLE}`)
  })

  it('tells how many notifications are still waiting, and nothing when none is', () => {
    const many = Array.from({ length: NOTIFICATIONS_VISIBLE + EXTRA }, (_unused, index) => notification(NotificationTone.Info, `Title ${index}`))
    const waiting = render(stateWith(...many)).get('.omk-toasts__waiting')
    expect(waiting.text()).toBe(`t:ui.toast.waiting:{"count":${EXTRA}}`)
    expect(waiting.attributes('data-surface')).toBe('toast-waiting')
    expect(render(stateWith(notification(NotificationTone.Info, 'Alone'))).find('.omk-toasts__waiting').exists()).toBe(false)
  })

  it('keeps twin notifications as separate toasts', () => {
    const twin = notification(NotificationTone.Error, 'Twin')
    expect(render(stateWith(twin, twin)).findAll('[data-surface="toast"]')).toHaveLength(TWINS)
  })

  it('does not carry the tone by colour alone', () => {
    const toast = render(stateWith(notification(NotificationTone.Error, 'Broken'))).get('[data-surface="toast"]')
    expect(toast.get('.omk-toast__tone').text()).toBe('t:ui.tone.error')
  })

  it('anchors the stack against the column side', () => {
    const right = createInitialState()
    const left = { ...right, settings: { ...right.settings, side: 'right' as const } }
    expect(render(right).attributes('data-column-side')).toBe('left')
    expect(render(left).attributes('data-column-side')).toBe('right')
  })
})
