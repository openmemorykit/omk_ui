import { STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { UiMode } from '../../protocol/page-vocabulary'
import type { OwnedPanel } from '../../protocol/owned'
import type { ToPage } from '../../protocol/to-page'
import { isGlyphSet, promptView } from './client-messages'
import { isCommandSeq, isList, NO_REPLIES } from './guards'
import { RELEASED_BACK } from './hold-detector'
import { openPanelFrame, pushPanelFrame, type StackChange } from './navigation'
import type { UiCommandOf } from './page-commands'
import { withRadialEntries } from './radial-navigation'
import { confirmChange } from './stack-commands'
import { stackEvent, withEffects, type CommandHandler } from './ui-effects'
import type { UiState } from './ui-state'

type BootMessage = UiCommandOf<typeof ToPage.Boot>

const NO_PARENT = ''
const FIRST_PANEL = 0
export const BOOT_PANEL_SCAN_MAX = STACK_MAX_DEPTH + STACK_MAX_DEPTH

export function bootPanels(panels: readonly OwnedPanel[]): readonly OwnedPanel[] {
  return isList(panels) ? panels.slice(FIRST_PANEL, BOOT_PANEL_SCAN_MAX) : []
}

function rebuiltBase(state: UiState, message: BootMessage): UiState {
  const { language } = message.locale
  return {
    ...state,
    mode: UiMode.Idle,
    stack: [],
    appliedCommandSeq: isCommandSeq(message.commandSeq) ? message.commandSeq : state.appliedCommandSeq,
    radial: withRadialEntries(state.radial, message.radialEntries),
    prompt: message.prompt === null ? null : promptView(message.prompt),
    held: [],
    backHold: RELEASED_BACK,
    backFromEscape: false,
    escapeHeld: false,
    glyphSet: isGlyphSet(message.glyphSet) ? message.glyphSet : state.glyphSet,
    settings: message.settings,
    binding: message.bindings,
    language: typeof language === 'string' ? language : state.language,
  }
}

function topPanelId(state: UiState): string {
  return state.stack[state.stack.length - 1]?.panel?.panel.id ?? NO_PARENT
}

function withFrame(change: StackChange, panel: OwnedPanel, index: number): StackChange {
  const { state } = change
  const next = index === FIRST_PANEL ? openPanelFrame(state, panel, state.appliedCommandSeq) : pushPanelFrame(state, panel, topPanelId(state), state.appliedCommandSeq)
  return { state: next.state, replies: change.replies.concat(next.replies) }
}

export const handleBoot: CommandHandler<BootMessage> = (state, message) => {
  const frames = bootPanels(message.panels).reduce(withFrame, { state: rebuiltBase(state, message), replies: NO_REPLIES })
  const confirmed = message.confirm === null ? { state: frames.state, replies: NO_REPLIES } : confirmChange(frames.state, message.confirm, frames.state.appliedCommandSeq)
  return withEffects(confirmed.state, [stackEvent(confirmed.state, frames.replies.concat(confirmed.replies))])
}
