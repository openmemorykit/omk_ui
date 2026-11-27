import { hasOwnKey } from '@openmemorykit/core/shared'
import type french from '../../../omk_ui/locales/fr.json'
import type { ServerPorts } from './ports'

export const LOG_PREFIX = '[omk_ui]'
const LOCALE_CONVAR = 'omk_ui_locale'
const DEFAULT_LOCALE = 'fr'
export const UNKNOWN_VALUE = '?'
export const NOT_SET = '-'
const FALLBACK_LOCALE = 'en'
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g
const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTE_DIGITS = 2
const SECOND_DIGITS = 2
const MILLISECOND_DIGITS = 3
const ZERO = '0'
export const PRINTABLE_MAX_LENGTH = 200
const CONTROL_CHARACTERS = /[\p{Cc}\u2028\u2029]/gu
const COLOUR_CODE = /\^(?=\d)/g

export type LogKey = Extract<keyof typeof french, `log.${string}`>
export type LogParams = Readonly<Record<string, string | number>>
export type Translate = (key: LogKey, params?: LogParams) => string

export interface ServerLog {
  readonly translate: Translate
  readonly locale: () => string
  readonly printLine: (text: string) => void
  readonly printStamped: (text: string) => void
  readonly printPlayer: (player: number, text: string) => void
  readonly printBlock: (lines: readonly string[]) => void
}

export function printable(text: string): string {
  return text.replace(CONTROL_CHARACTERS, ' ').replace(COLOUR_CODE, '^ ').slice(0, PRINTABLE_MAX_LENGTH)
}

export function prefixBlock(lines: readonly string[]): readonly string[] {
  return lines.map((line, position) => (position === 0 ? `${LOG_PREFIX} ${line}` : line))
}

export function formatElapsed(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds))
  const minutes = Math.floor(total / (MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE))
  const seconds = Math.floor(total / MILLISECONDS_PER_SECOND) % SECONDS_PER_MINUTE
  const rest = total % MILLISECONDS_PER_SECOND
  const pad = (value: number, digits: number): string => String(value).padStart(digits, ZERO)
  return `${pad(minutes, MINUTE_DIGITS)}:${pad(seconds, SECOND_DIGITS)}.${pad(rest, MILLISECOND_DIGITS)}`
}

function messageOf(messages: Readonly<Record<string, string>> | undefined, key: string): string | undefined {
  return messages !== undefined && hasOwnKey(messages, key) ? messages[key] : undefined
}

function fillPlaceholders(template: string, params: LogParams | undefined): string {
  if (params === undefined) return template
  const own = new Map(Object.entries(params))
  return template.replace(PLACEHOLDER, (placeholder, name: string) => String(own.get(name) ?? placeholder))
}

export function createServerLog(ports: ServerPorts): ServerLog {
  const locale = (): string => ports.convars.read(LOCALE_CONVAR) ?? DEFAULT_LOCALE
  const translate: Translate = (key, params) => {
    const language = locale()
    const chosen = messageOf(ports.locales.read(language)?.messages, key)
    const template = chosen ?? messageOf(ports.locales.read(FALLBACK_LOCALE)?.messages, key) ?? key
    return fillPlaceholders(template, params)
  }
  const printBlock = (lines: readonly string[]): void => prefixBlock(lines).forEach((line) => ports.console.line(line))
  const printStamped = (text: string): void => printBlock([translate('log.line.server', { time: formatElapsed(ports.clock.now()), text })])
  const printPlayer = (player: number, text: string): void =>
    printBlock([translate('log.line.player', { time: formatElapsed(ports.clock.now()), player, text })])
  return { translate, locale, printLine: (text) => printBlock([text]), printStamped, printPlayer, printBlock }
}
