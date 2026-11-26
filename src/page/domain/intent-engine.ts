import { ToPage } from '../../protocol/to-page'
import { handleBoot } from './boot'
import {
  handleGlyphSet,
  handleHidePrompt,
  handleModality,
  handleNotify,
  handlePromptProgress,
  handleResolveForm,
  handleShowPrompt,
  handleSnapshotRequest,
  handleUpdatePanel,
} from './client-messages'
import { fallbackTransition } from './command-fallback'
import {
  handleClientIntent,
  handleEscapeKeyUp,
  handleFrameTick,
  handleInput,
  handleLocalIntent,
  handleLocalModality,
  handleWindowBlurred,
  handleWindowFocused,
} from './intent-input'
import { settleMode } from './mode-change'
import { PageCommandType, TimerKind, type UiCommand, type UiCommandOf, type UiCommandType } from './page-commands'
import { handleOpenRadial, handleRadialEntries } from './radial-handler'
import { handleClosePanel, handleDropOwner, handleOpenPanel, handlePushPanel, handleShowConfirm } from './stack-commands'
import { settleTextEntry } from './text-entry'
import { handleTimerFired } from './timers'
import { unchanged, type CommandHandler, type Transition } from './ui-effects'
import type { UiState } from './ui-state'

export type { Transition, UiEffect } from './ui-effects'

type HandlerTable = { readonly [Type in UiCommandType]: CommandHandler<UiCommandOf<Type>> }

const HANDLERS: HandlerTable = {
  [ToPage.Boot]: handleBoot,
  [ToPage.Intent]: handleClientIntent,
  [ToPage.Stick]: handleInput,
  [ToPage.Modality]: handleModality,
  [ToPage.OpenRadial]: handleOpenRadial,
  [ToPage.RadialEntries]: handleRadialEntries,
  [ToPage.OpenPanel]: handleOpenPanel,
  [ToPage.PushPanel]: handlePushPanel,
  [ToPage.UpdatePanel]: handleUpdatePanel,
  [ToPage.ClosePanel]: handleClosePanel,
  [ToPage.ResolveForm]: handleResolveForm,
  [ToPage.ShowConfirm]: handleShowConfirm,
  [ToPage.Notify]: handleNotify,
  [ToPage.ShowPrompt]: handleShowPrompt,
  [ToPage.PromptProgress]: handlePromptProgress,
  [ToPage.HidePrompt]: handleHidePrompt,
  [ToPage.DropOwner]: handleDropOwner,
  [ToPage.GlyphSet]: handleGlyphSet,
  [ToPage.SnapshotRequest]: handleSnapshotRequest,
  [PageCommandType.LocalIntent]: handleLocalIntent,
  [PageCommandType.LocalModality]: handleLocalModality,
  [PageCommandType.HoverItem]: handleInput,
  [PageCommandType.ClickItem]: handleInput,
  [PageCommandType.PointerAim]: handleInput,
  [PageCommandType.TypeText]: handleInput,
  [PageCommandType.FrameTick]: handleFrameTick,
  [PageCommandType.TimerFired]: handleTimerFired,
  [PageCommandType.WindowBlurred]: handleWindowBlurred,
  [PageCommandType.WindowFocused]: handleWindowFocused,
  [PageCommandType.EscapeKeyUp]: handleEscapeKeyUp,
}

const HANDLER_BY_TYPE: ReadonlyMap<string, CommandHandler<UiCommand>> = new Map(Object.entries(HANDLERS) as Array<[string, CommandHandler<UiCommand>]>)

function endsWaitingItself(command: UiCommand): boolean {
  return command.type === PageCommandType.TimerFired && command.timer === TimerKind.WaitingTimeout
}

function settled(before: UiState, next: Transition, endsWaiting: boolean): Transition {
  return settleTextEntry(before, settleMode(before, next, endsWaiting))
}

function recovered(state: UiState, command: UiCommand): Transition {
  try {
    return settled(state, fallbackTransition(state, command), false)
  } catch {
    return unchanged(state)
  }
}

export function transition(state: UiState, command: UiCommand, now: number): Transition {
  try {
    const handler = HANDLER_BY_TYPE.get(command.type)
    if (handler === undefined) return unchanged(state)
    return settled(state, handler(state, command, now), endsWaitingItself(command))
  } catch {
    return recovered(state, command)
  }
}
