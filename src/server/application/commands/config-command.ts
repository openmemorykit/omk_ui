import { configSummaryLines } from '../config-summary'
import type { SubcommandHandler } from './command-arguments'

export const configCommand: SubcommandHandler = (context) => [context.log.translate('log.command.config'), ...configSummaryLines(context)]
