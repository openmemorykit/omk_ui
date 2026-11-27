import { CloseReason, ReplyKind, ReplySchema, type Reply } from '@openmemorykit/ui/contract'
import { validateContract, ValidationStatus } from '@openmemorykit/ui/validation'

export interface Ledger {
  readonly opened: Map<string, number>
  readonly closed: Map<string, number>
  readonly confirmsShown: Map<string, number>
  readonly confirmsAnswered: Map<string, number>
  readonly acceptedAnswers: Map<string, number>
  readonly acceptAttempts: Map<string, number>
  readonly violations: string[]
  readonly closedInstances: Set<string>
  readonly discardedDuringCall: Set<string>
}

export function createLedger(): Ledger {
  return {
    opened: new Map(),
    closed: new Map(),
    confirmsShown: new Map(),
    confirmsAnswered: new Map(),
    acceptedAnswers: new Map(),
    acceptAttempts: new Map(),
    violations: [],
    closedInstances: new Set(),
    discardedDuringCall: new Set(),
  }
}

const TOTAL = 'total'
const keyOf = (owner: string, localId: string): string => `${owner}/${localId}`
const increment = (counts: Map<string, number>, key: string): void => void counts.set(key, (counts.get(key) ?? 0) + 1)

export function recordOpened(ledger: Ledger, owner: string, panelId: string): void {
  const key = keyOf(owner, panelId)
  increment(ledger.opened, key)
  if (!ledger.discardedDuringCall.has(key)) ledger.closedInstances.delete(key)
}

export function beginCall(ledger: Ledger): void {
  ledger.discardedDuringCall.clear()
}

export function recordUserAcceptance(ledger: Ledger): void {
  increment(ledger.acceptAttempts, TOTAL)
}

export function recordConfirmShown(ledger: Ledger, owner: string, confirmId: string): void {
  increment(ledger.confirmsShown, keyOf(owner, confirmId))
}

function recordPanelReply(ledger: Ledger, owner: string, reply: Reply & { readonly panelId: string }): void {
  const key = keyOf(owner, reply.panelId)
  if (reply.kind !== ReplyKind.PanelClosed) {
    if (ledger.closedInstances.has(key)) ledger.violations.push(`reply ${reply.kind} after PanelClosed of ${key}`)
    return
  }
  if (ledger.closedInstances.has(key)) ledger.violations.push(`second PanelClosed of ${key}`)
  increment(ledger.closed, key)
  ledger.closedInstances.add(key)
  if (reply.reason === CloseReason.Discarded) ledger.discardedDuringCall.add(key)
}

export function recordReply(ledger: Ledger, owner: string, reply: Reply): void {
  if (validateContract(ReplySchema, reply).status !== ValidationStatus.Accepted) ledger.violations.push(`reply refused by ReplySchema: ${JSON.stringify(reply)}`)
  switch (reply.kind) {
    case ReplyKind.ItemSelected:
    case ReplyKind.ValueChanged:
    case ReplyKind.FormSubmitted:
    case ReplyKind.PanelClosed:
      recordPanelReply(ledger, owner, reply)
      return
    case ReplyKind.ConfirmAnswered:
      increment(ledger.confirmsAnswered, keyOf(owner, reply.confirmId))
      if (reply.confirmed) increment(ledger.acceptedAnswers, TOTAL)
      return
    default:
      return
  }
}

function unbalanced(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>, exact: boolean): readonly string[] {
  const keys = new Set([...left.keys(), ...right.keys()])
  return [...keys].filter((key) => {
    const opened = left.get(key) ?? 0
    const closed = right.get(key) ?? 0
    return exact ? opened !== closed : closed > opened
  })
}

function unexplainedAcceptances(ledger: Ledger): readonly string[] {
  const accepted = ledger.acceptedAnswers.get(TOTAL) ?? 0
  const attempts = ledger.acceptAttempts.get(TOTAL) ?? 0
  return accepted > attempts ? [`${accepted} confirmed=true answers for ${attempts} user acceptances: a destroyed confirmation was answered true`] : []
}

export function overClosed(ledger: Ledger): readonly string[] {
  return [...unexplainedAcceptances(ledger), ...unbalanced(ledger.opened, ledger.closed, false), ...unbalanced(ledger.confirmsShown, ledger.confirmsAnswered, false)]
}

export function unsettled(ledger: Ledger): readonly string[] {
  return [...unbalanced(ledger.opened, ledger.closed, true), ...unbalanced(ledger.confirmsShown, ledger.confirmsAnswered, true)]
}
