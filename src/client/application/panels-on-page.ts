import { namespaceId } from '../../protocol/namespaced-id'
import type { StackSnapshot } from '../../protocol/stack'
import { StackCommandKind, type RegisteredPanel, type RegistryState, type StackCommand } from '../domain/owner-registry'

export interface SentPanel {
  readonly owner: string
  readonly panelId: string
  readonly seq: number
}

export type PanelsOnPage = readonly SentPanel[]

export const NO_PANELS_ON_PAGE: PanelsOnPage = Object.freeze([])

function namespacedIdOfRegistered({ owner, panel }: RegisteredPanel): string {
  return namespaceId(owner, panel.id)
}

function namespacedIdOfSent({ owner, panelId }: SentPanel): string {
  return namespaceId(owner, panelId)
}

function sentBy(registered: RegisteredPanel, seq: number): SentPanel {
  return { owner: registered.owner, panelId: registered.panel.id, seq }
}

function openedNamespacedId(command: StackCommand): string | null {
  return command.kind === StackCommandKind.Open || command.kind === StackCommandKind.Push ? command.panel.panel.id : null
}

function latestPerId(sentPanels: PanelsOnPage): ReadonlyMap<string, SentPanel> {
  return new Map(sentPanels.map((sent) => [namespacedIdOfSent(sent), sent] as const))
}

export function panelsShownByBoot(registry: RegistryState): PanelsOnPage {
  return registry.stack.map((registered) => sentBy(registered, registry.commandSeq))
}

export function withPanelsSentBy(panels: PanelsOnPage, registry: RegistryState, command: StackCommand): PanelsOnPage {
  const opened = openedNamespacedId(command)
  return [...panels, ...registry.stack.filter((registered) => namespacedIdOfRegistered(registered) === opened).map((registered) => sentBy(registered, command.seq))]
}

export function panelsLostByPage(panels: PanelsOnPage, registry: RegistryState): PanelsOnPage {
  const open = new Set(registry.stack.map(namespacedIdOfRegistered))
  const latest = latestPerId(panels)
  return panels.filter((sent) => !open.has(namespacedIdOfSent(sent)) || latest.get(namespacedIdOfSent(sent)) !== sent)
}

export function panelsKeptAfterSnapshot(panels: PanelsOnPage, reconciled: RegistryState, snapshot: StackSnapshot): PanelsOnPage {
  const latestApplied = latestPerId(panels.filter((sent) => sent.seq <= snapshot.appliedCommandSeq))
  const kept = new Set([...snapshot.entries.flatMap((entry) => latestApplied.get(entry.panelId) ?? []), ...panels.filter((sent) => sent.seq > snapshot.appliedCommandSeq)])
  const remaining = panels.filter((sent) => kept.has(sent))
  const unsent = reconciled.stack.filter((registered) => !remaining.some((sent) => namespacedIdOfSent(sent) === namespacedIdOfRegistered(registered)))
  return [...remaining, ...unsent.map((registered) => sentBy(registered, reconciled.commandSeq))]
}

export function panelsWithoutOwner(panels: PanelsOnPage, owner: string): PanelsOnPage {
  return panels.filter((sent) => sent.owner !== owner)
}
