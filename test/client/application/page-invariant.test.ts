import { CALL_DONE, KitExport, ReplyKind, type Panel } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { READY_INTERVAL_MS, receiveReady } from '../../../src/client/application/page-link'
import { namespaceId } from '../../../src/protocol/namespaced-id'
import { FixtureOwner } from '../../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { createPageSimulator, type PageSimulator } from './page-simulator'
import { createReadyHarness, type UseCaseHarness } from './use-case-harness'

const CYCLES = 200
const SEED_COUNT = 20
const SEED_STRIDE = 7919
const SEEDS = Array.from({ length: SEED_COUNT }, (_, index) => index * SEED_STRIDE + 1)
const STEP_MS = 100
const UINT32_RANGE = 4_294_967_296
const LCG_MULTIPLIER = 1_664_525
const LCG_INCREMENT = 1_013_904_223
const TWO_BOOTS = 2
const OWNERS = [FixtureOwner.Whitelist, FixtureOwner.Garage] as const
const PANELS: readonly Panel[] = [LIST_PANEL, ADD_PANEL]

type Draw = () => number
type Step = (world: World) => void

interface World {
  readonly harness: UseCaseHarness
  readonly page: PageSimulator
  readonly draw: Draw
  readonly openings: Map<string, number>
}

function seededDraw(seed: number): Draw {
  let state = seed
  return () => {
    state = (Math.imul(state, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0
    return state / UINT32_RANGE
  }
}

function pick<Item>(draw: Draw, items: readonly Item[]): Item {
  const item = items[Math.floor(draw() * items.length)]
  if (item === undefined) throw new RangeError('empty choice')
  return item
}

function countOpening(world: World, owner: string, panelId: string): void {
  const key = namespaceId(owner, panelId)
  world.openings.set(key, (world.openings.get(key) ?? 0) + 1)
}

function closings(harness: UseCaseHarness): Map<string, number> {
  const counted = new Map<string, number>()
  harness.ports.replies.attempts.forEach(({ owner, reply }) => {
    if (reply.kind !== ReplyKind.PanelClosed) return
    const key = namespaceId(owner, reply.panelId)
    counted.set(key, (counted.get(key) ?? 0) + 1)
  })
  return counted
}

const open: Step = (world) => {
  const owner = pick(world.draw, OWNERS)
  const panel = pick(world.draw, PANELS)
  if (handleContractCall(world.harness.context, KitExport.OpenPanel, owner, [panel]) === CALL_DONE) countOpening(world, owner, panel.id)
}

const push: Step = (world) => {
  const owner = pick(world.draw, OWNERS)
  if (handleContractCall(world.harness.context, KitExport.PushPanel, owner, [ADD_PANEL, LIST_PANEL.id]) === CALL_DONE) countOpening(world, owner, ADD_PANEL.id)
}

const close: Step = (world) => {
  handleContractCall(world.harness.context, KitExport.ClosePanel, pick(world.draw, OWNERS), [pick(world.draw, PANELS).id])
}

const deliver: Step = (world) => {
  world.page.receive()
  world.page.process()
}

const pressBack: Step = (world) => {
  if (world.page.isAlive()) world.page.pressBack()
}

const crash: Step = (world) => {
  world.page.crash()
}

const STEPS: readonly Step[] = [open, open, push, close, deliver, deliver, deliver, pressBack, pressBack, crash]

function reloadIfCrashed(world: World): void {
  if (world.page.isAlive()) return
  receiveReady(world.harness.context)
  deliver(world)
}

function drain(world: World): void {
  world.harness.ports.clock.advance(READY_INTERVAL_MS)
  reloadIfCrashed(world)
  deliver(world)
  world.harness.store.read().registry.stack.forEach(({ owner, panel }) => handleContractCall(world.harness.context, KitExport.ClosePanel, owner, [panel.id]))
  deliver(world)
}

function runCycles(seed: number): World {
  const harness = createReadyHarness()
  const world: World = { harness, page: createPageSimulator(harness), draw: seededDraw(seed), openings: new Map() }
  deliver(world)
  Array.from({ length: CYCLES }, () => {
    harness.ports.clock.advance(STEP_MS)
    pick(world.draw, STEPS)(world)
    reloadIfCrashed(world)
    closings(harness).forEach((closed, key) => expect(closed).toBeLessThanOrEqual(world.openings.get(key) ?? 0))
  })
  drain(world)
  return world
}

describe('one PanelClosed per opening answered Done', () => {
  it.each(SEEDS)('holds over 200 random cycles with page restarts (seed %i)', (seed) => {
    const world = runCycles(seed)
    expect(world.page.panelCount()).toBe(0)
    expect(world.harness.store.read().registry.stack).toStrictEqual([])
    expect(closings(world.harness)).toStrictEqual(world.openings)
  })
})

describe('a forged Ready', () => {
  it('costs only a Boot: same registry, same panels on the page, no reply', () => {
    const harness = createReadyHarness()
    const page = createPageSimulator(harness)
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    page.receive()
    page.process()
    const registry = harness.store.read().registry.stack
    harness.ports.clock.advance(READY_INTERVAL_MS)
    receiveReady(harness.context)
    page.receive()
    page.process()
    expect(harness.store.read().registry.stack).toStrictEqual(registry)
    expect(harness.ports.nui.boots).toHaveLength(TWO_BOOTS)
    expect(page.panelCount()).toBe(1)
    expect(harness.ports.replies.attempts).toStrictEqual([])
  })
})
