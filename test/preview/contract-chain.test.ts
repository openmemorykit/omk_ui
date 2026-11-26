import { CallStatus, ContractVersion, IconName, KitExport, STACK_MAX_DEPTH, type CallResult } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREVIEW_SETTINGS } from '../../preview/runtime/preview-settings'
import { LogKind } from '../../preview/runtime/types'
import { stackSnapshot } from '../../src/page/domain/page-event'
import { ConfirmOrigin, LayerKind } from '../../src/page/domain/ui-state'
import { UiMode } from '../../src/protocol/page-vocabulary'
import { FromPage } from '../../src/protocol/from-page'
import { Intent, IntentPhase } from '../../src/protocol/intents'
import { ToPage, type ToPageMessage } from '../../src/protocol/to-page'
import { beginCall, createLedger, overClosed, recordConfirmShown, recordOpened, recordReply, unsettled, type Ledger } from './chain-ledger'
import { createPageHarness, type PageHarness } from './runtime/client-harness'
import { clientIntent, menu } from './runtime/runtime-helpers'

const SEED_COUNT = 6
const SEED_STRIDE = 7_919
const SEEDS = Array.from({ length: SEED_COUNT }, (_, index) => 1 + index * SEED_STRIDE)
const STEPS_PER_SEED = 400
const MIN_OPENS_AND_CLOSES = 200
const DRAIN_ATTEMPTS = 24
const OWNERS = ['alpha', 'beta'] as const
const PANEL_IDS = ['main', 'sub', 'deep', 'side'] as const
const CONFIRM_IDS = ['ask', 'warn'] as const
const PARK_MILLER_MULTIPLIER = 48_271
const PARK_MILLER_MODULUS = 2_147_483_647

interface Chain {
  readonly harness: PageHarness
  readonly ledger: Ledger
  readonly draw: <Choice>(choices: readonly Choice[]) => Choice
  readonly nextIntentSeq: () => number
  readonly acceptAppliedSeq: (appliedCommandSeq: number) => void
}

function draw<Choice>(chain: Chain, choices: readonly Choice[]): Choice {
  return chain.draw(choices)
}

function createCounters(seed: number): Pick<Chain, 'draw' | 'nextIntentSeq' | 'acceptAppliedSeq'> {
  let random = seed
  let intentSeq = 0
  let lastAppliedSeq = 0
  return {
    draw<Choice>(choices: readonly Choice[]): Choice {
      random = (random * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS
      return choices[random % choices.length] as Choice
    },
    nextIntentSeq: () => (intentSeq += 1),
    acceptAppliedSeq(appliedCommandSeq) {
      expect(appliedCommandSeq).toBeGreaterThanOrEqual(lastAppliedSeq)
      lastAppliedSeq = appliedCommandSeq
    },
  }
}

function createChain(seed: number): Chain {
  const harness = createPageHarness()
  const ledger = createLedger()
  OWNERS.forEach((owner) => harness.resources.set(owner, { call: () => undefined, onReply: (reply) => recordReply(ledger, owner, reply) }))
  harness.client.boot(DEFAULT_PREVIEW_SETTINGS)
  OWNERS.forEach((owner) => harness.call(owner, KitExport.AddRadialEntry, { version: ContractVersion.V1, id: 'entry', label: owner, description: owner, icon: IconName.List }))
  return { harness, ledger, ...createCounters(seed) }
}

function kitCall(chain: Chain, owner: string, name: KitExport, ...args: unknown[]): CallResult {
  beginCall(chain.ledger)
  return chain.harness.call(owner, name, ...args)
}

function intent(chain: Chain, value: Intent): void {
  const seq = chain.nextIntentSeq()
  chain.harness.page.dispatch(clientIntent(seq, value, IntentPhase.Press))
  chain.harness.page.dispatch(clientIntent(seq, value, IntentPhase.Release))
}

function topLocalId(chain: Chain, owner: string): string {
  const { stack } = chain.harness.client.registry()
  const top = stack[stack.length - 1]
  return top?.owner === owner ? top.panel.id : draw(chain, PANEL_IDS)
}

function openStep(chain: Chain, owner: string, pushed: boolean): void {
  const panelId = draw(chain, PANEL_IDS)
  const result = pushed ? kitCall(chain, owner, KitExport.PushPanel, menu(panelId), topLocalId(chain, owner)) : kitCall(chain, owner, KitExport.OpenPanel, menu(panelId))
  if (result.status === CallStatus.Done) recordOpened(chain.ledger, owner, panelId)
}

function confirmStep(chain: Chain, owner: string): void {
  const confirmId = draw(chain, CONFIRM_IDS)
  const result = kitCall(chain, owner, KitExport.Confirm, { version: ContractVersion.V1, id: confirmId, title: 'Sure?', text: 'Really?', confirmLabel: 'Yes', danger: draw(chain, [true, false]) })
  if (result.status === CallStatus.Done) recordConfirmShown(chain.ledger, owner, confirmId)
}

function radialStep(chain: Chain): void {
  chain.harness.page.dispatch({ type: ToPage.OpenRadial })
  intent(chain, draw(chain, [Intent.Right, Intent.Left]))
  intent(chain, draw(chain, [Intent.Confirm, Intent.Back]))
}

const ACTIONS: readonly ((chain: Chain, owner: string) => void)[] = [
  (chain, owner) => openStep(chain, owner, false),
  (chain, owner) => openStep(chain, owner, true),
  (chain, owner) => openStep(chain, owner, true),
  (chain, owner) => void kitCall(chain, owner, KitExport.ClosePanel, draw(chain, PANEL_IDS)),
  (chain, owner) => void kitCall(chain, owner, KitExport.UpdatePanel, menu(draw(chain, PANEL_IDS), 'Updated')),
  confirmStep,
  (chain) => intent(chain, Intent.Confirm),
  (chain) => intent(chain, Intent.Back),
  (chain) => intent(chain, Intent.Down),
  radialStep,
]

function namespacedRegistryStack(chain: Chain): readonly string[] {
  return chain.harness.client.registry().stack.map(({ owner, panel }) => `${owner}/${panel.id}`)
}

function shownConfirmIds(chain: Chain): readonly string[] {
  return chain.harness.page.state().stack.flatMap((frame) =>
    frame.layers.flatMap((layer) => (layer.kind === LayerKind.Confirm && layer.origin === ConfirmOrigin.Request && layer.confirmId !== null ? [layer.confirmId] : [])))
}

function expectCoherent(chain: Chain): void {
  const pageState = chain.harness.page.state()
  const pageIds = stackSnapshot(pageState).entries.map((entry) => entry.panelId)
  const registryIds = namespacedRegistryStack(chain)
  expect(pageState.stack.length).toBeLessThanOrEqual(STACK_MAX_DEPTH)
  expect(registryIds.length).toBeLessThanOrEqual(STACK_MAX_DEPTH)
  expect(pageIds.every((panelId) => registryIds.includes(panelId))).toBe(true)
  expect(pageIds).toEqual(registryIds)
  expect(pageState.appliedCommandSeq).toBe(chain.harness.client.registry().commandSeq)
  expect(chain.harness.client.registry().confirms.map(({ owner, confirm }) => `${owner}/${confirm.id}`)).toEqual(shownConfirmIds(chain))
  expect(overClosed(chain.ledger)).toEqual([])
  expect(chain.ledger.violations).toEqual([])
}

function expectEventsInOrder(chain: Chain): void {
  chain.harness.page.sent.forEach((message) => {
    if (message.type !== FromPage.Event || message.event.stack === null) return
    chain.acceptAppliedSeq(message.event.stack.appliedCommandSeq)
  })
  chain.harness.page.sent.splice(0, chain.harness.page.sent.length)
}

function commandSeqOf(message: ToPageMessage): readonly number[] {
  switch (message.type) {
    case ToPage.OpenPanel:
    case ToPage.PushPanel:
    case ToPage.ClosePanel:
    case ToPage.ShowConfirm:
    case ToPage.DropOwner:
      return [message.commandSeq]
    default:
      return []
  }
}

function drain(chain: Chain): void {
  for (let attempt = 0; attempt < DRAIN_ATTEMPTS && chain.harness.page.state().mode !== UiMode.Idle; attempt += 1) intent(chain, Intent.Back)
}

function runChain(seed: number): Chain {
  const chain = createChain(seed)
  for (let step = 0; step < STEPS_PER_SEED; step += 1) {
    draw(chain, ACTIONS)(chain, draw(chain, OWNERS))
    expectEventsInOrder(chain)
    expectCoherent(chain)
  }
  drain(chain)
  expectCoherent(chain)
  return chain
}

describe('contract chain: registry, message, transition, Event, reconcileStack, ReplySchema', () => {
  it.each(SEEDS)('keeps every invariant on the sequence drawn from seed %i', (seed) => {
    const chain = runChain(seed)
    expect(chain.harness.page.state().stack).toEqual([])
    expect(chain.harness.client.registry().stack).toEqual([])
    expect(unsettled(chain.ledger)).toEqual([])
    const seqs = chain.harness.sent.flatMap(commandSeqOf)
    expect(seqs).toEqual(seqs.map((_, index) => index + 1))
    expect(chain.harness.events.filter((event) => event.kind === LogKind.ReplyRefused)).toEqual([])
  })

  it('opens, closes and confirms often enough for the invariants to mean something', () => {
    const chains = SEEDS.map(runChain)
    const total = (pick: (ledger: Ledger) => ReadonlyMap<string, number>): number =>
      chains.reduce((sum, chain) => sum + [...pick(chain.ledger).values()].reduce((left, right) => left + right, 0), 0)
    expect(total((ledger) => ledger.opened)).toBeGreaterThan(MIN_OPENS_AND_CLOSES)
    expect(total((ledger) => ledger.closed)).toBeGreaterThan(MIN_OPENS_AND_CLOSES)
    expect(total((ledger) => ledger.confirmsShown)).toBeGreaterThan(SEEDS.length)
  })
})
