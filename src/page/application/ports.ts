import type { ValueOf } from '@openmemorykit/core/shared'
import type { FromPageMessage } from '../../protocol/from-page'
import type { ToPageMessage } from '../../protocol/to-page'
import type { TimerKind } from '../domain/page-commands'
import type { UiCommand } from '../domain/page-commands'
import type { UiState } from '../domain/ui-state'
import type { Translator } from '../i18n/messages'

export const AnnounceUrgency = { Polite: 'polite', Assertive: 'assertive' } as const
export type AnnounceUrgency = ValueOf<typeof AnnounceUrgency>

export type Dispatch = (command: UiCommand) => void

export interface HostBridge {
  send(message: FromPageMessage): void
  listen(listener: (message: ToPageMessage) => void): () => void
}

export interface Scheduler {
  schedule(timer: TimerKind, delayMs: number, fire: () => void): void
  cancel(timer: TimerKind): void
}

export interface FrameRequester { request(callback: () => void): void }
export interface Clock { now(): number }
export interface Announcer { announce(text: string, urgency: AnnounceUrgency): void }
export interface PaintProbe { afterPaint(callback: (paintedAt: number) => void): void }
export interface TextFocus { focus(itemId: string): void }

export interface ViewportSize { readonly width: number; readonly height: number }
export interface Viewport {
  read(): ViewportSize
  listen(listener: (size: ViewportSize) => void): () => void
}

export interface UiPorts {
  readonly host: HostBridge
  readonly scheduler: Scheduler
  readonly frames: FrameRequester
  readonly clock: Clock
  readonly announcer: Announcer
  readonly translator: Translator
  readonly paint: PaintProbe
  readonly textFocus: TextFocus
}

export interface UiStore {
  dispatch: Dispatch
  state(): UiState
  subscribe(listener: (state: UiState) => void): () => void
}
