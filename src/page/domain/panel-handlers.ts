import type { UiCommand } from './page-commands'
import { unchanged, type CommandHandler } from './ui-effects'

export const handleList: CommandHandler<UiCommand> = (state) => unchanged(state)

export const handleConfirmLayer: CommandHandler<UiCommand> = (state) => unchanged(state)

export const handleKeyboardLayer: CommandHandler<UiCommand> = (state) => unchanged(state)
