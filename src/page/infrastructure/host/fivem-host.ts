import type { ValueOf } from '@openmemorykit/core/shared'
import type { HostBridge } from '../../application/ports'
import { FromPage, type FromPageMessage } from '../../../protocol/from-page'
import { ToPage, type ToPageMessage } from '../../../protocol/to-page'
import { createOriginJournal } from './origin-journal'

export const SESSION_TOKEN_KEY = 'sessionToken'
export const SESSION_TOKEN_MAX_LENGTH = 128
export const WARNING_INTERVAL_MS = 60_000
export const READY_RETRY_DELAY_MS = 2_000
export const READY_MAX_RETRIES = 5
export const PENDING_PAGE_ERRORS_MAX = 10

export const HostWarning = {
  BootRefused: 'bootRefused',
  SendWithoutToken: 'sendWithoutToken',
  UnknownCallback: 'unknownCallback',
  CallbackFailed: 'callbackFailed',
  ListenerFailed: 'listenerFailed',
  MessageUnreadable: 'messageUnreadable',
  QueuedBeforeBoot: 'queuedBeforeBoot',
} as const
export type HostWarning = ValueOf<typeof HostWarning>

const TYPE_KEY = 'type'
const MESSAGE_EVENT = 'message'
const POST_METHOD = 'POST'
const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8'
const LINE_PREFIX = '[omk_ui] host'
const DETAIL_MAX_LENGTH = 200
const REDACTED = '<session token>'
const START = 0
const UNKNOWN_ERROR = 'unknown error'
const TO_PAGE_TYPES: ReadonlySet<unknown> = new Set(Object.values(ToPage))
const FROM_PAGE_TYPES: ReadonlySet<unknown> = new Set(Object.values(FromPage))

type PlainRecord = Readonly<Record<string, unknown>>
type Listener = (message: ToPageMessage) => void
type Warn = (kind: HostWarning, detail: string) => void
type Poster = (type: FromPage, body: PlainRecord, onFailure?: () => void) => void
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

function refused(response: Response): boolean {
  try {
    return !response.ok
  } catch {
    return false
  }
}

function createPoster(resourceName: string, post: typeof fetch, warn: Warn): Poster {
  return (type, body, onFailure = () => undefined) => {
    const fail = (error: unknown): void => {
      warn(HostWarning.CallbackFailed, `${type}: ${describeError(error)}`)
      onFailure()
    }
    const answered = (response: Response): void => {
      if (refused(response)) fail(new Error(`status ${String(response.status)}`))
    }
    try {
      const request: RequestInit = { method: POST_METHOD, headers: { 'Content-Type': JSON_CONTENT_TYPE }, body: JSON.stringify(body) }
      void Promise.resolve(post(`https://${resourceName}/${type}`, request)).then(answered, fail)
    } catch (error) {
      fail(error)
    }
  }
}

interface PendingErrors {
  readonly add: (message: FromPageMessage) => void
  readonly flush: () => void
}

function createPendingErrors(post: (message: FromPageMessage) => void): PendingErrors {
  const pending: FromPageMessage[] = []
  return {
    add(message) {
      if (pending.length < PENDING_PAGE_ERRORS_MAX) pending.push(message)
    },
    flush: () => pending.splice(START).forEach(post),
  }
}

function keepUntilBoot(message: FromPageMessage, pending: PendingErrors, warn: Warn): void {
  if (message.type === FromPage.PageError) warn(HostWarning.QueuedBeforeBoot, message.message)
  pending.add(message)
}

function createSender(currentToken: TokenReader, poster: Poster, ready: () => void, pending: PendingErrors, warn: Warn): (message: FromPageMessage) => void {
  return (message) => {
    const { type } = message
    if (!FROM_PAGE_TYPES.has(type)) return warn(HostWarning.UnknownCallback, 'message type outside FromPage')
    if (type === FromPage.Ready) return ready()
    const token = currentToken()
    if (token === null) return type === FromPage.PageError ? keepUntilBoot(message, pending, warn) : warn(HostWarning.SendWithoutToken, type)
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

function recordOrigin(journal: (event: MessageEvent<unknown>) => void, event: MessageEvent<unknown>): void {
  try {
    journal(event)
  } catch {
    return
  }
}

function createMessageHandler(journal: (event: MessageEvent<unknown>) => void, adoptToken: (token: string) => void, registrations: ReadonlySet<Registration>, warn: Warn): (event: MessageEvent<unknown>) => void {
  return (event) => {
    try {
      recordOrigin(journal, event)
      const read = readMessage(event.data, warn)
      if (read === null) return
      if (read.token !== null) adoptToken(read.token)
      notify(registrations, read.message, warn)
    } catch (error) {
      warn(HostWarning.MessageUnreadable, describeError(error))
    }
  }
}

interface ReadyRetry {
  readonly send: () => void
  readonly stop: () => void
  readonly reset: () => void
}

function createReadyRetry(win: Window, poster: Poster, shouldRetry: () => boolean): ReadyRetry {
  let retries = 0
  let timer: number | null = null
  const stop = (): void => {
    if (timer !== null) win.clearTimeout(timer)
    timer = null
  }
  function send(): void {
    poster(FromPage.Ready, { type: FromPage.Ready }, retryLater)
  }
  function retryLater(): void {
    if (timer !== null || retries >= READY_MAX_RETRIES || !shouldRetry()) return
    retries += 1
    timer = win.setTimeout(() => {
      timer = null
      if (shouldRetry()) send()
    }, READY_RETRY_DELAY_MS)
  }
  return { send, stop, reset: () => void (retries = 0) }
}

export function createFivemHost(win: Window, resourceName: string, post: typeof fetch, warn: (line: string) => void): HostBridge {
  let token: string | null = null
  const currentToken = (): string | null => token
  const gate = createWarningGate(() => win.performance.now(), warn, currentToken)
  const poster = createPoster(resourceName, post, gate)
  const registrations = new Set<Registration>()
  const retry = createReadyRetry(win, poster, () => token === null && registrations.size > 0)
  const pending = createPendingErrors((message) => send(message))
  const send = createSender(currentToken, poster, retry.send, pending, gate)
  const adoptToken = (next: string): void => {
    token = next
    pending.flush()
  }
  const onMessage = createMessageHandler(createOriginJournal(win, (message) => (token === null ? pending.add(message) : send(message))), adoptToken, registrations, gate)
  return {
    send,
    listen(listener) {
      const registration: Registration = { listener }
      registrations.add(registration)
      if (registrations.size === 1) {
        win.addEventListener(MESSAGE_EVENT, onMessage)
        retry.reset()
        send({ type: FromPage.Ready })
      }
      return () => {
        if (!registrations.delete(registration) || registrations.size > 0) return
        retry.stop()
        win.removeEventListener(MESSAGE_EVENT, onMessage)
      }
    },
  }
}
