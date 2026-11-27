import { describe, expect, it } from 'vitest'
import { NotificationTone, NOTIFICATIONS_VISIBLE } from '@openmemorykit/ui/contract'
import { toastsView } from '../../../../src/page/application/views/toast-view'
import { EMPTY_TOASTS, pushToast } from '../../../../src/page/domain/toasts'
import { createInitialState, type UiState } from '../../../../src/page/domain/ui-state'
import { notification, translate } from './helpers'

const NOW = 1_000
const EXTRA = 3
const TWINS = 3

function stateWith(...notifications: ReturnType<typeof notification>[]): UiState {
  const toasts = notifications.reduce((queue, owned) => pushToast(queue, owned, NOW), EMPTY_TOASTS)
  return { ...createInitialState(), toasts }
}

describe('toastsView', () => {
  it('is empty without notifications', () => {
    expect(toastsView(createInitialState(), translate)).toEqual({ toasts: [], waiting: 0 })
  })

  it.each(Object.values(NotificationTone))('translates the %s tone label', (tone) => {
    const view = toastsView(stateWith(notification(tone, 'Title', 'Body')), translate)
    expect(view.toasts).toHaveLength(1)
    expect(view.toasts[0]).toMatchObject({ tone, toneLabel: `t:ui.tone.${tone}`, title: 'Title', text: 'Body' })
  })

  it('has a null text when the notification has none', () => {
    expect(toastsView(stateWith(notification(NotificationTone.Info, 'Title')), translate).toasts[0]?.text).toBeNull()
  })

  it('keeps the visible order', () => {
    const view = toastsView(stateWith(notification(NotificationTone.Info, 'First'), notification(NotificationTone.Error, 'Second')), translate)
    expect(view.toasts.map((toast) => toast.title)).toEqual(['First', 'Second'])
  })

  it('counts the waiting queue when the stack is full', () => {
    const many = Array.from({ length: NOTIFICATIONS_VISIBLE + EXTRA }, (_unused, index) => notification(NotificationTone.Info, `N${index}`))
    const view = toastsView(stateWith(...many), translate)
    expect(view.toasts).toHaveLength(NOTIFICATIONS_VISIBLE)
    expect(view.waiting).toBe(EXTRA)
  })

  it('identifies a keyed toast by owner and key', () => {
    const view = toastsView(stateWith(notification(NotificationTone.Info, 'Keyed', undefined, 'res/slot')), translate)
    expect(view.toasts[0]?.id).toBe('res:res/slot')
  })

  it('gives distinct identifiers to identical unkeyed toasts', () => {
    const twin = notification(NotificationTone.Info, 'Twin')
    const ids = toastsView(stateWith(...Array.from({ length: TWINS }, () => twin)), translate).toasts.map((toast) => toast.id)
    expect(new Set(ids).size).toBe(TWINS)
  })

  it('keeps the identifier of a toast stable when an earlier one expires', () => {
    const first = notification(NotificationTone.Info, 'A')
    const second = notification(NotificationTone.Info, 'B')
    const both = toastsView(stateWith(first, second), translate).toasts[1]?.id
    const alone = toastsView(stateWith(second), translate).toasts[0]?.id
    expect(alone).toBe(both)
  })

  it('identifies an unkeyed toast without a display time', () => {
    const state = stateWith(notification(NotificationTone.Info, 'Late'))
    const [toast] = state.toasts.visible
    const view = toastsView({ ...state, toasts: { ...state.toasts, visible: [{ ...toast, shownAt: null }] } } as UiState, translate)
    expect(view.toasts[0]?.id).toBe('res:0:Late')
  })
})
