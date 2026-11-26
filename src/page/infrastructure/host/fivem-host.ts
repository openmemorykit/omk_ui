import type { ValueOf } from '@openmemorykit/core/shared'
import type { HostBridge } from '../../application/ports'
import { FromPage, type FromPageMessage } from '../../../protocol/from-page'
import { ToPage, type ToPageMessage } from '../../../protocol/to-page'

export const SESSION_TOKEN_KEY = 'sessionToken'
export const SESSION_TOKEN_MAX_LENGTH = 128
export const WARNING_INTERVAL_MS = 60_000

export const HostWarning = {
  BootRefused: 'bootRefused',
  SendWithoutToken: 'sendWithoutToken',
  UnknownCallback: 'unknownCallback',
  CallbackFailed: 'callbackFailed',
  ListenerFailed: 'listenerFailed',
  MessageUnreadable: 'messageUnreadable',
} as const
export type HostWarning = ValueOf<typeof HostWarning>

const TYPE_KEY = 'type'
const MESSAGE_EVENT = 'message'
const POST_METHOD = 'POST'
const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8'
const LINE_PREFIX = '[omk_ui] host'
const DETAIL_MAX_LENGTH = 200
const REDACTED = '<session token>'
const UNKNOWN_ERROR = 'unknown error'
const TO_PAGE_TYPES: ReadonlySet<unknown> = new Set(Object.values(ToPage))
const FROM_PAGE_TYPES: ReadonlySet<unknown> = new Set(Object.values(FromPage))

type PlainRecord = Readonly<Record<string, unknown>>
type Listener = (message: ToPageMessage) => void
type Warn = (kind: HostWarning, detail: string) => void
type Poster = (type: FromPage, body: PlainRecord) => void
interface Registration { readonly listener: Listener }
type TokenReader = () => string | null
interface ReadMessage { readonly message: ToPageMessage; readonly token: string | null }
interface GateEntry { readonly lastAt: number; readonly suppressed: number }

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function ownValue(record: PlainRecord, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value
}

function isSessionToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= SESSION_TOKEN_MAX_LENGTH
}

function withoutToken(record: PlainRecord): PlainRecord {
  if (!Object.hasOwn(record, SESSION_TOKEN_KEY)) return record
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== SESSION_TOKEN_KEY))
}

function describeError(error: unknown): string {
  try {
    return error instanceof Error ? `${error.name}: ${error.message}` : typeof error
  } catch {
    return UNKNOWN_ERROR
  }
}

function suppressedSuffix(entry: GateEntry | undefined): string {
  return entry !== undefined && entry.suppressed > 0 ? ` (${entry.suppressed} more since the last line)` : ''
}

function createWarningGate(now: () => number, warn: (line: string) => void, currentToken: TokenReader): Warn {
  const entries = new Map<HostWarning, GateEntry>()
  return (kind, detail) => {
    const at = now()
    const entry = entries.get(kind)
    if (entry !== undefined && at - entry.lastAt < WARNING_INTERVAL_MS) {
      entries.set(kind, { ...entry, suppressed: entry.suppressed + 1 })
      return
    }
    entries.set(kind, { lastAt: at, suppressed: 0 })
    const token = currentToken()
    const redacted = token === null ? detail : detail.split(token).join(REDACTED)
    try {
      warn(`${LINE_PREFIX} ${kind}: ${redacted.slice(0, DETAIL_MAX_LENGTH)}${suppressedSuffix(entry)}`)
    } catch {
      return
    }
  }
}

function createPoster(resourceName: string, post: typeof fetch, warn: Warn): Poster {
  const fail = (type: FromPage) => (error: unknown): void => warn(HostWarning.CallbackFailed, `${type}: ${describeError(error)}`)
  return (type, body) => {
    try {
      const request: RequestInit = { method: POST_METHOD, headers: { 'Content-Type': JSON_CONTENT_TYPE }, body: JSON.stringify(body) }
      void Promise.resolve(post(`https://${resourceName}/${type}`, request)).then(undefined, fail(type))
    } catch (error) {
      fail(type)(error)
    }
  }
}

function createSender(currentToken: TokenReader, poster: Poster, warn: Warn): (message: FromPageMessage) => void {
  return (message) => {
    const { type } = message
    if (!FROM_PAGE_TYPES.has(type)) return warn(HostWarning.UnknownCallback, 'message type outside FromPage')
    if (type === FromPage.Ready) return poster(type, { ...message })
    const token = currentToken()
    if (token === null) return warn(HostWarning.SendWithoutToken, type)
    poster(type, { ...message, [SESSION_TOKEN_KEY]: token })
  }
}

function readMessage(data: unknown, warn: Warn): ReadMessage | null {
  if (!isPlainObject(data)) return null
  const type = ownValue(data, TYPE_KEY)
  if (!TO_PAGE_TYPES.has(type)) return null
  const stripped = (): ToPageMessage => withoutToken(data) as unknown as ToPageMessage
  if (type !== ToPage.Boot) return { message: stripped(), token: null }
  const token = ownValue(data, SESSION_TOKEN_KEY)
  if (isSessionToken(token)) return { message: stripped(), token }
  warn(HostWarning.BootRefused, 'boot without a valid session token')
  return null
}

function notify(registrations: ReadonlySet<Registration>, message: ToPageMessage, warn: Warn): void {
  for (const { listener } of [...registrations]) {
    try {
      listener(message)
    } catch (error) {
      warn(HostWarning.ListenerFailed, `${message.type}: ${describeError(error)}`)
    }
  }
}

function createMessageHandler(adoptToken: (token: string) => void, registrations: ReadonlySet<Registration>, warn: Warn): (event: MessageEvent<unknown>) => void {
  return (event) => {
    try {
      const read = readMessage(event.data, warn)
      if (read === null) return
      if (read.token !== null) adoptToken(read.token)
      notify(registrations, read.message, warn)
    } catch (error) {
      warn(HostWarning.MessageUnreadable, describeError(error))
    }
  }
}

export function createFivemHost(win: Window, resourceName: string, post: typeof fetch, warn: (line: string) => void): HostBridge {
  let token: string | null = null
  const currentToken = (): string | null => token
  const gate = createWarningGate(() => win.performance.now(), warn, currentToken)
  const send = createSender(currentToken, createPoster(resourceName, post, gate), gate)
  const registrations = new Set<Registration>()
  const onMessage = createMessageHandler((next) => void (token = next), registrations, gate)
  return {
    send,
    listen(listener) {
      const registration: Registration = { listener }
      registrations.add(registration)
      if (registrations.size === 1) {
        win.addEventListener(MESSAGE_EVENT, onMessage)
        send({ type: FromPage.Ready })
      }
      return () => {
        if (!registrations.delete(registration) || registrations.size > 0) return
        win.removeEventListener(MESSAGE_EVENT, onMessage)
      }
    },
  }
}
