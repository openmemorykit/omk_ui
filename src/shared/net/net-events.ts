import type { ValueOf } from '@openmemorykit/core/shared'
import { NotificationSchema, TEXT_MAX_LENGTH } from '@openmemorykit/ui/contract'
import * as v from 'valibot'
import { Intent } from '../../protocol/intents'

export const NetEvent = { Trace: 'omk_ui:trace', Report: 'omk_ui:report', Notify: 'omk_ui:notify', Command: 'omk_ui:command' } as const
export type NetEvent = ValueOf<typeof NetEvent>

export const CommandKind = { Trace: 'trace', Notify: 'notify', Snapshot: 'snapshot', Demo: 'demo', Intent: 'intent', Close: 'close', Ask: 'ask' } as const
export type CommandKind = ValueOf<typeof CommandKind>

export const DemoName = {
  Radial: 'radial',
  List: 'list',
  LongList: 'long-list',
  Form: 'form',
  Confirm: 'confirm',
  Keyboard: 'keyboard',
  Toasts: 'toasts',
  Prompt: 'prompt',
} as const
export type DemoName = ValueOf<typeof DemoName>

export const INTENT_COUNT_MIN = 1
export const INTENT_COUNT_MAX = 50
export const ASK_TEXT_MIN_LENGTH = 1
export const ASK_TEXT_MAX_LENGTH = TEXT_MAX_LENGTH
const IDENTIFIER_MIN = 0
const RESERVED_KEY_SCAN_DEPTH = 4
const PROTOTYPE_PROPERTY = 'prototype'
const RESERVED_KEYS: readonly string[] = Object.freeze([...Object.getOwnPropertyNames(Object.prototype), PROTOTYPE_PROPERTY])

const RequestIdentifierSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(IDENTIFIER_MIN))

export const TraceCommandSchema = v.strictObject({ kind: v.literal(CommandKind.Trace), active: v.boolean() })
export const NotifyCommandSchema = v.strictObject({ kind: v.literal(CommandKind.Notify), notification: NotificationSchema })
export const SnapshotCommandSchema = v.strictObject({ kind: v.literal(CommandKind.Snapshot), requestId: RequestIdentifierSchema })
export const DemoCommandSchema = v.strictObject({ kind: v.literal(CommandKind.Demo), demo: v.picklist(Object.values(DemoName)) })
export const IntentCommandSchema = v.strictObject({
  kind: v.literal(CommandKind.Intent),
  intent: v.picklist(Object.values(Intent)),
  count: v.pipe(v.number(), v.integer(), v.minValue(INTENT_COUNT_MIN), v.maxValue(INTENT_COUNT_MAX)),
})
export const CloseCommandSchema = v.strictObject({ kind: v.literal(CommandKind.Close) })
export const AskCommandSchema = v.strictObject({
  kind: v.literal(CommandKind.Ask),
  askId: RequestIdentifierSchema,
  text: v.pipe(v.string(), v.minLength(ASK_TEXT_MIN_LENGTH), v.maxLength(ASK_TEXT_MAX_LENGTH)),
})

export type TraceCommand = v.InferOutput<typeof TraceCommandSchema>
export type NotifyCommand = v.InferOutput<typeof NotifyCommandSchema>
export type SnapshotCommand = v.InferOutput<typeof SnapshotCommandSchema>
export type DemoCommand = v.InferOutput<typeof DemoCommandSchema>
export type IntentCommand = v.InferOutput<typeof IntentCommandSchema>
export type CloseCommand = v.InferOutput<typeof CloseCommandSchema>
export type AskCommand = v.InferOutput<typeof AskCommandSchema>
export type ServerToClientCommand = TraceCommand | NotifyCommand | SnapshotCommand | DemoCommand | IntentCommand | CloseCommand | AskCommand

function isContainer(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function hasReservedOwnKey(value: unknown, depth: number): boolean {
  if (!isContainer(value)) return false
  if (depth >= RESERVED_KEY_SCAN_DEPTH) return true
  if (RESERVED_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key))) return true
  return Object.values(value).some((child) => hasReservedOwnKey(child, depth + 1))
}

const REFUSED = v.never()

function refusingReservedKeys<Schema extends v.GenericSchema>(schema: Schema): v.LazySchema<Schema | typeof REFUSED> {
  return v.lazy((input) => (hasReservedOwnKey(input, 0) ? REFUSED : schema))
}

const CommandEventSchema = v.variant('kind', [SnapshotCommandSchema, DemoCommandSchema, IntentCommandSchema, CloseCommandSchema, AskCommandSchema])

export const NET_EVENT_SCHEMAS = {
  [NetEvent.Trace]: refusingReservedKeys(TraceCommandSchema),
  [NetEvent.Notify]: refusingReservedKeys(NotifyCommandSchema),
  [NetEvent.Command]: refusingReservedKeys(CommandEventSchema),
  [NetEvent.Report]: v.unknown(),
} as const

export function netEventOf(command: ServerToClientCommand): NetEvent {
  switch (command.kind) {
    case CommandKind.Trace:
      return NetEvent.Trace
    case CommandKind.Notify:
      return NetEvent.Notify
    case CommandKind.Snapshot:
    case CommandKind.Demo:
    case CommandKind.Intent:
    case CommandKind.Close:
    case CommandKind.Ask:
      return NetEvent.Command
  }
}
