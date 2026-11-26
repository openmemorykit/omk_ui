import {
  CALL_DONE,
  ContractErrorCode,
  NOTIFICATION_QUEUE_LENGTH,
  refusedCall,
  ReplyKind,
  ReplySchema,
  type CallResult,
  type ContractError,
  type Reply,
} from '@openmemorykit/ui/contract'
import { validateContract, ValidationStatus } from '@openmemorykit/ui/validation'
import { EMPTY_REGISTRY, radialOrder, reconcileStack, settleConfirm, visiblePrompt, type RegistryState } from '../../src/client/domain/owner-registry'
import { FromPage, type FromPageMessage } from '../../src/protocol/from-page'
import { isNamespaceOwner } from '../../src/protocol/namespaced-id'
import { fromPageReply, toPageConfirm, toPagePanel, toPagePrompt } from '../../src/protocol/owned'
import type { OwnedReply } from '../../src/protocol/stack'
import { ToPage, type ToPageMessage, type ToPageMessageOf } from '../../src/protocol/to-page'
import { readCall } from './kit-exports'
import { PREVIEW_BINDINGS, previewLocale, previewTheme, type PreviewSettings } from './preview-settings'
import { LogKind, type FakeKit, type FakeResource, type LogEvent } from './types'

export interface FakeClientPorts {
  readonly send: (message: ToPageMessage) => void
  readonly record: (event: LogEvent) => void
  readonly resourceOf: (owner: string) => FakeResource | undefined
}

export interface FakeClient {
  kitFor(owner: string): FakeKit
  boot(settings: PreviewSettings): void
  receive(message: FromPageMessage): void
  registry(): RegistryState
}

type NotifyMessage = ToPageMessageOf<typeof ToPage.Notify>
interface PendingReply { readonly owner: string; readonly reply: Reply }

const UNREADABLE_REPLY: readonly ContractError[] = Object.freeze([{ path: '', code: ContractErrorCode.BadIdentifier }])
const BAD_OWNER: CallResult = refusedCall([{ path: '', code: ContractErrorCode.BadIdentifier }])

function bootMessage(registry: RegistryState, settings: PreviewSettings): ToPageMessage {
  const confirm = registry.confirms[0]
  const prompt = visiblePrompt(registry)
  return {
    type: ToPage.Boot,
    settings: previewTheme(settings),
    locale: previewLocale(settings.language),
    glyphSet: settings.glyphSet,
    bindings: PREVIEW_BINDINGS,
    radialEntries: radialOrder(registry),
    panels: registry.stack.map(({ owner, panel }) => toPagePanel(owner, panel)),
    confirm: confirm === undefined ? null : toPageConfirm(confirm.owner, confirm.confirm),
    prompt: prompt === null ? null : toPagePrompt(prompt.owner, prompt.prompt),
    commandSeq: registry.commandSeq,
  }
}

const ownerOf = (owned: OwnedReply): string => (typeof owned.owner === 'string' ? owned.owner : '')

interface Outbox {
  readonly emit: (message: ToPageMessage) => void
  readonly open: (boot: ToPageMessage) => void
}

function createOutbox(ports: FakeClientPorts): Outbox {
  let booted = false
  const queued: NotifyMessage[] = []
  const queue = (message: NotifyMessage): void => {
    queued.push(message)
    if (queued.length <= NOTIFICATION_QUEUE_LENGTH) return
    const dropped = queued.shift() as NotifyMessage
    ports.record({ kind: LogKind.NotificationDropped, owner: dropped.notification.owner })
  }
  return {
    emit(message) {
      if (booted) ports.send(message)
      else if (message.type === ToPage.Notify) queue(message)
    },
    open(boot) {
      booted = true
      ports.send(boot)
      queued.splice(0).forEach(ports.send)
    },
  }
}

interface ReplyDesk {
  readonly accept: (owned: OwnedReply) => PendingReply | null
  readonly deliverAll: (replies: readonly PendingReply[]) => void
}

function createReplyDesk(ports: FakeClientPorts): ReplyDesk {
  const pending: PendingReply[] = []
  let delivering = false
  const deliver = ({ owner, reply }: PendingReply): void => {
    ports.record({ kind: LogKind.Reply, owner, reply })
    try {
      ports.resourceOf(owner)?.onReply(reply)
    } catch {
      ports.record({ kind: LogKind.ReplyUndelivered, owner, reply })
    }
  }
  return {
    accept(owned) {
      const owner = ownerOf(owned)
      const local = fromPageReply(owned)
      const checked = local === null ? null : validateContract(ReplySchema, local.reply)
      if (checked !== null && checked.status === ValidationStatus.Accepted) return { owner, reply: checked.value }
      ports.record({ kind: LogKind.ReplyRefused, owner, errors: checked === null ? UNREADABLE_REPLY : checked.errors })
      return null
    },
    deliverAll(replies) {
      pending.push(...replies)
      if (delivering) return
      delivering = true
      try {
        for (let next = pending.shift(); next !== undefined; next = pending.shift()) deliver(next)
      } finally {
        delivering = false
      }
    },
  }
}

function settled(registry: RegistryState, { owner, reply }: PendingReply): RegistryState {
  return reply.kind === ReplyKind.ConfirmAnswered ? settleConfirm(registry, owner, reply.confirmId) : registry
}

export function createFakeClient(ports: FakeClientPorts, commandSeq = EMPTY_REGISTRY.commandSeq): FakeClient {
  let registry: RegistryState = { ...EMPTY_REGISTRY, commandSeq }
  const outbox = createOutbox(ports)
  const desk = createReplyDesk(ports)
  const perform = (owner: string, name: string, args: unknown): CallResult => {
    if (!isNamespaceOwner(owner)) return BAD_OWNER
    const reading = readCall(name, args)
    if (!reading.ok) return refusedCall(reading.errors)
    const applied = reading.apply(registry, owner)
    if (!applied.ok) return refusedCall([applied.error])
    registry = applied.registry
    applied.messages.forEach(outbox.emit)
    return CALL_DONE
  }
  return {
    kitFor: (owner) => ({
      call(name, args) {
        const result = perform(owner, name, args)
        ports.record({ kind: LogKind.Call, owner, name: String(name), result })
        return result
      },
    }),
    boot: (settings) => outbox.open(bootMessage(registry, settings)),
    receive(message) {
      if (message.type !== FromPage.Event) return
      const { stack, replies } = message.event
      if (stack !== null) registry = reconcileStack(registry, stack)
      const accepted = Object.freeze([...replies]).flatMap((owned) => desk.accept(owned) ?? [])
      registry = accepted.reduce(settled, registry)
      desk.deliverAll(accepted)
    },
    registry: () => registry,
  }
}
