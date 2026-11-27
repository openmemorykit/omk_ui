import type { InputSource, Intent } from '../../protocol/intents'
import { Modality } from '../../protocol/intents'
import type { OwnedNotification } from '../../protocol/owned'
import { UiMode } from '../../protocol/page-vocabulary'
import { SHOWN_PROMPT, type PromptHold } from '../domain/hold-prompt'
import { OPEN_GATE, type OpenGate } from '../domain/open-blockers'
import { IDLE_GESTURE, type GestureState } from '../domain/open-gesture'
import { EMPTY_REGISTRY, type RegistryState } from '../domain/owner-registry'
import type { PadSnapshotState } from '../domain/pad-snapshot'
import { NO_GUARD, type ReleaseGuard } from '../domain/release-guard'
import { EMPTY_TRACE, type TraceBuffer } from '../domain/trace-buffer'

export interface LastIntent {
  readonly intent: Intent
  readonly source: InputSource
  readonly seq: number
  readonly at: number
}

export interface PageLink {
  readonly ready: boolean
  readonly token: string | null
  readonly lastReadyAt: number | null
  readonly intentSeq: number
  readonly lastAckSeq: number
  readonly unackedSince: number | null
  readonly lastIntent: LastIntent | null
  readonly queuedNotifications: readonly OwnedNotification[]
}

export interface TraceState {
  readonly active: boolean
  readonly buffer: TraceBuffer
  readonly lastLimitedAt: ReadonlyMap<string, number>
}

export interface ClientSession {
  readonly registry: RegistryState
  readonly gate: OpenGate
  readonly mode: UiMode
  readonly paused: boolean
  readonly modality: Modality
  readonly gesture: GestureState
  readonly guard: ReleaseGuard
  readonly pad: PadSnapshotState | null
  readonly link: PageLink
  readonly prompt: PromptHold
  readonly textEntry: boolean
  readonly trace: TraceState
}

export interface SessionStore {
  read(): ClientSession
  write(next: ClientSession): void
}

export const EMPTY_PAGE_LINK: PageLink = Object.freeze({
  ready: false,
  token: null,
  lastReadyAt: null,
  intentSeq: 0,
  lastAckSeq: 0,
  unackedSince: null,
  lastIntent: null,
  queuedNotifications: Object.freeze([]),
})

export const INACTIVE_TRACE: TraceState = Object.freeze({ active: false, buffer: EMPTY_TRACE, lastLimitedAt: new Map<string, number>() })

export const INITIAL_CLIENT_SESSION: ClientSession = Object.freeze({
  registry: EMPTY_REGISTRY,
  gate: OPEN_GATE,
  mode: UiMode.Idle,
  paused: false,
  modality: Modality.KeyboardMouse,
  gesture: IDLE_GESTURE,
  guard: NO_GUARD,
  pad: null,
  link: EMPTY_PAGE_LINK,
  prompt: SHOWN_PROMPT,
  textEntry: false,
  trace: INACTIVE_TRACE,
})

export function createSessionStore(initial: ClientSession): SessionStore {
  let current = initial
  return {
    read: () => current,
    write: (next) => {
      current = next
    },
  }
}
