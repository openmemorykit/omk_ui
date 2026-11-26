import type { ValueOf } from '@openmemorykit/core/shared'
import { Modality } from '../../protocol/intents'
import { GuardedControl } from './release-guard'
import { UiMode } from '../../protocol/page-vocabulary'

export const ControlGroup = { Main: 0, Frontend: 2 } as const
export type ControlGroup = ValueOf<typeof ControlGroup>

export interface ControlRef {
  readonly group: ControlGroup
  readonly control: number
}

export const PushToTalkPolicy = { Blocked: 'blocked', Reenabled: 'reenabled' } as const
export type PushToTalkPolicy = ValueOf<typeof PushToTalkPolicy>

export const PUSH_TO_TALK_CONTROL = 249
export const ALWAYS_BLOCKED_CONTROLS: readonly number[] = Object.freeze([GuardedControl.FrontendPause, GuardedControl.FrontendPauseAlternate, GuardedControl.FrontendEscape])

export interface FocusContext {
  readonly mode: UiMode
  readonly modality: Modality
  readonly paused: boolean
  readonly awaitingEscapeRelease: boolean
  readonly releaseGuardControls: readonly number[]
  readonly textEntryActive: boolean
  readonly pushToTalk: PushToTalkPolicy
}

export interface FocusDecision {
  readonly focus: boolean
  readonly cursor: boolean
  readonly keepInput: boolean | null
  readonly disableAllControls: boolean
  readonly blocked: readonly ControlRef[]
  readonly enabled: readonly ControlRef[]
  readonly suppressPauseMenu: boolean
}

const GROUPS: readonly ControlGroup[] = Object.freeze([ControlGroup.Main, ControlGroup.Frontend])
const NO_REFS: readonly ControlRef[] = Object.freeze([])

function everyGroup(controls: readonly number[]): readonly ControlRef[] {
  return Object.freeze(controls.flatMap((control) => GROUPS.map((group) => Object.freeze({ group, control }))))
}

const ALWAYS_BLOCKED_REFS = everyGroup(ALWAYS_BLOCKED_CONTROLS)

const PAUSED_DECISION: FocusDecision = Object.freeze({
  focus: false,
  cursor: false,
  keepInput: null,
  disableAllControls: false,
  blocked: NO_REFS,
  enabled: NO_REFS,
  suppressPauseMenu: false,
})

function isActiveMode(mode: UiMode): boolean {
  return mode === UiMode.Radial || mode === UiMode.Panels || mode === UiMode.Waiting
}

function holdingDecision(cursor: boolean, context: FocusContext): FocusDecision {
  const pushToTalkOpen = context.pushToTalk === PushToTalkPolicy.Reenabled && !context.textEntryActive
  return Object.freeze({
    focus: true,
    cursor,
    keepInput: false,
    disableAllControls: true,
    blocked: ALWAYS_BLOCKED_REFS,
    enabled: pushToTalkOpen ? Object.freeze([Object.freeze({ group: ControlGroup.Main, control: PUSH_TO_TALK_CONTROL })]) : NO_REFS,
    suppressPauseMenu: true,
  })
}

function idleDecision(guardControls: readonly number[]): FocusDecision {
  return Object.freeze({
    focus: false,
    cursor: false,
    keepInput: false,
    disableAllControls: false,
    blocked: everyGroup(Array.isArray(guardControls) ? guardControls : []),
    enabled: NO_REFS,
    suppressPauseMenu: false,
  })
}

export function decideFocus(context: FocusContext): FocusDecision {
  if (context.paused) return PAUSED_DECISION
  if (context.awaitingEscapeRelease) return holdingDecision(false, context)
  if (isActiveMode(context.mode)) return holdingDecision(context.mode !== UiMode.Waiting && context.modality === Modality.KeyboardMouse, context)
  return idleDecision(context.releaseGuardControls)
}
