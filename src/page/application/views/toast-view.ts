import type { NotificationTone } from '@openmemorykit/ui/contract'
import type { Toast } from '../../domain/toasts'
import type { UiState } from '../../domain/ui-state'
import type { Translate } from '../../i18n/messages'

export interface ToastView {
  readonly id: string
  readonly tone: NotificationTone
  readonly toneLabel: string
  readonly title: string
  readonly text: string | null
}

export interface ToastsView {
  readonly toasts: readonly ToastView[]
  readonly waiting: number
  readonly waitingLabel: string | null
}

const FIRST_OCCURRENCE = 0
const NONE_WAITING = 0

function baseId(toast: Toast): string {
  const { owner, notification } = toast.owned
  return notification.key === undefined ? `${owner}:${toast.shownAt ?? FIRST_OCCURRENCE}:${notification.title}` : `${owner}:${notification.key}`
}

export function toastsView(state: UiState, translate: Translate): ToastsView {
  const seen = new Map<string, number>()
  const toasts = state.toasts.visible.map((toast) => {
    const base = baseId(toast)
    const occurrence = seen.get(base) ?? FIRST_OCCURRENCE
    seen.set(base, occurrence + 1)
    const { notification } = toast.owned
    return {
      id: occurrence === FIRST_OCCURRENCE ? base : `${base}#${occurrence}`,
      tone: notification.tone,
      toneLabel: translate(`ui.tone.${notification.tone}`),
      title: notification.title,
      text: notification.text ?? null,
    }
  })
  const waiting = state.toasts.waiting.length
  return { toasts, waiting, waitingLabel: waiting === NONE_WAITING ? null : translate('ui.toast.waiting', { count: waiting }) }
}
