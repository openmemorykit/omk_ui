import { ContractErrorCode, type ContractError } from '@openmemorykit/ui/contract'
import type { Scheduler } from '../../src/page/application/ports'
import { TimerKind } from '../../src/page/domain/page-commands'
import { FromPage } from '../../src/protocol/from-page'
import { isNamespaceOwner } from '../../src/protocol/namespaced-id'
import { ToPage, type ToPageMessage } from '../../src/protocol/to-page'
import { createFakeClient, type FakeClient } from './fake-client'
import { readCall } from './kit-exports'
import type { PreviewSettings } from './preview-settings'
import {
  LogKind,
  StepKind,
  type ClientMessage,
  type FakeResource,
  type LogEntry,
  type LogEvent,
  type PreviewRuntime,
  type PreviewRuntimeOptions,
  type Scenario,
  type ScenarioCatalog,
  type ScenarioEntry,
  type ScenarioStep,
} from './types'

export const SCENARIO_TIMER: TimerKind = TimerKind.WaitingTimeout
export const LOG_MAX_ENTRIES = 500
export const WAIT_MAX_MS = 60_000

const CLIENT_MESSAGE_TYPES: ReadonlySet<unknown> = new Set([ToPage.OpenRadial, ToPage.Modality, ToPage.GlyphSet, ToPage.Stick, ToPage.Intent, ToPage.PromptProgress])
const EMPTY_CATALOG: ScenarioCatalog = new Map()
const NO_STEPS: readonly ScenarioStep[] = Object.freeze([])
const PATH_SEPARATOR = '.'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null
const joinPath = (base: string, path: string): string => (path.length === 0 ? base : `${base}${PATH_SEPARATOR}${path}`)
const isWaitDelay = (delayMs: unknown): boolean => typeof delayMs === 'number' && Number.isSafeInteger(delayMs) && delayMs >= 0 && delayMs <= WAIT_MAX_MS

function callErrors(step: Readonly<Record<string, unknown>>, path: string): readonly ContractError[] {
  if (typeof step.owner !== 'string' || !isNamespaceOwner(step.owner)) return [{ path: joinPath(path, 'owner'), code: ContractErrorCode.BadIdentifier }]
  const reading = readCall(step.name, step.args)
  return reading.ok ? [] : reading.errors.map((error) => ({ ...error, path: joinPath(joinPath(path, 'args'), error.path) }))
}

function clientErrors(step: Readonly<Record<string, unknown>>, path: string): readonly ContractError[] {
  const type = isRecord(step.message) ? step.message.type : undefined
  return CLIENT_MESSAGE_TYPES.has(type) ? [] : [{ path: joinPath(path, 'message.type'), code: ContractErrorCode.UnknownValue, detail: String(type) }]
}

function stepErrors(step: unknown, index: number): readonly ContractError[] {
  const path = joinPath('steps', String(index))
  const kind = isRecord(step) ? step.kind : undefined
  if (isRecord(step) && kind === StepKind.Call) return callErrors(step, path)
  if (isRecord(step) && kind === StepKind.Client) return clientErrors(step, path)
  if (isRecord(step) && kind === StepKind.Wait) return isWaitDelay(step.delayMs) ? [] : [{ path: joinPath(path, 'delayMs'), code: ContractErrorCode.OutOfRange }]
  return [{ path: joinPath(path, 'kind'), code: ContractErrorCode.UnknownValue }]
}

export function validateScenario(scenario: Scenario): readonly ContractError[] {
  const steps: unknown = scenario.steps
  return Array.isArray(steps) ? steps.flatMap(stepErrors) : [{ path: 'steps', code: ContractErrorCode.WrongType }]
}

interface Run {
  readonly settings: PreviewSettings
  readonly steps: readonly ScenarioStep[]
  readonly refused: boolean
  readonly client: FakeClient
  readonly resources: Map<string, FakeResource>
}

interface RunPorts {
  readonly send: (message: ToPageMessage) => void
  readonly record: (event: LogEvent) => void
}

function scenarioErrors(id: string, entry: ScenarioEntry | undefined): readonly ContractError[] {
  return entry === undefined ? [{ path: 'id', code: ContractErrorCode.UnknownValue, detail: id }] : validateScenario(entry.scenario)
}

function createRun(id: string, entry: ScenarioEntry | undefined, ports: RunPorts, commandSeq: number, settings: PreviewSettings): Run {
  const errors = scenarioErrors(id, entry)
  if (errors.length > 0) ports.record({ kind: LogKind.ScenarioRefused, scenarioId: id, errors })
  const resources = new Map<string, FakeResource>()
  const client = createFakeClient({ ...ports, resourceOf: (owner) => resources.get(owner) }, commandSeq)
  entry?.resources.forEach((factory, owner) => resources.set(owner, factory(client.kitFor(owner))))
  const steps = entry === undefined || errors.length > 0 ? NO_STEPS : entry.scenario.steps
  return { settings, steps, refused: errors.length > 0, client, resources }
}

function resourceFor(run: Run, owner: string): FakeResource {
  const known = run.resources.get(owner)
  if (known !== undefined) return known
  const kit = run.client.kitFor(owner)
  const forwarder: FakeResource = { call: (name, payload) => kit.call(name, payload), onReply: () => undefined }
  run.resources.set(owner, forwarder)
  return forwarder
}

interface LogBook {
  readonly record: (event: LogEvent) => void
  readonly entries: () => readonly LogEntry[]
  readonly onLog: (listener: () => void) => () => void
}

function createLogBook(now: () => number): LogBook {
  const entries: LogEntry[] = []
  const listeners = new Set<() => void>()
  return {
    record(event) {
      entries.push({ at: now(), event })
      if (entries.length > LOG_MAX_ENTRIES) entries.splice(0, entries.length - LOG_MAX_ENTRIES)
      ;[...listeners].forEach((listener) => listener())
    },
    entries: () => entries.slice(),
    onLog(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}

interface StepPlayer {
  send(message: ClientMessage): void
  wait(run: Run, delayMs: number): void
}

function playStep(run: Run, step: ScenarioStep, player: StepPlayer): void {
  if (step.kind === StepKind.Call) resourceFor(run, step.owner).call(step.name, step.args)
  else if (step.kind === StepKind.Client) player.send(step.message)
  else player.wait(run, step.delayMs)
}

interface Stepper {
  readonly current: () => Run | null
  readonly reset: (run: Run) => void
  readonly begin: () => void
  readonly settled: () => boolean
}

interface Progress { nextStep: number; waiting: boolean; started: boolean }

const freshProgress = (): Progress => ({ nextStep: 0, waiting: false, started: false })

function intentNumbering(): (message: ClientMessage) => ToPageMessage {
  let intentSeq = 0
  return (message) => {
    if (message.type !== ToPage.Intent) return message
    intentSeq += 1
    return { ...message, seq: intentSeq }
  }
}

function createStepper(scheduler: Scheduler, send: (message: ToPageMessage) => void): Stepper {
  let run: Run | null = null
  let progress = freshProgress()
  const toPage = intentNumbering()
  const resume = (active: Run): void => {
    if (run !== active) return
    progress.waiting = false
    advance(active)
  }
  const player: StepPlayer = {
    send: (message) => send(toPage(message)),
    wait(active, delayMs) {
      progress.waiting = true
      scheduler.schedule(SCENARIO_TIMER, delayMs, () => resume(active))
    },
  }
  function advance(active: Run): void {
    for (let step = active.steps[progress.nextStep]; !progress.waiting && step !== undefined; step = active.steps[progress.nextStep]) {
      progress.nextStep += 1
      playStep(active, step, player)
    }
  }
  return {
    current: () => run,
    reset(next) {
      scheduler.cancel(SCENARIO_TIMER)
      run = next
      progress = freshProgress()
    },
    begin() {
      if (run === null) return
      run.client.boot(run.settings)
      if (progress.started) return
      progress.started = true
      advance(run)
    },
    settled: () => run !== null && !run.refused && progress.started && !progress.waiting && progress.nextStep >= run.steps.length,
  }
}

export function createPreviewRuntime({ clock, scheduler, catalog = EMPTY_CATALOG }: PreviewRuntimeOptions): PreviewRuntime {
  const book = createLogBook(() => clock.now())
  const listeners = new Set<(message: ToPageMessage) => void>()
  const send = (message: ToPageMessage): void => {
    book.record({ kind: LogKind.ToPage, message })
    ;[...listeners].forEach((listener) => listener(message))
  }
  const stepper = createStepper(scheduler, send)
  let pageReady = false
  return {
    start(id, settings) {
      const commandSeq = stepper.current()?.client.registry().commandSeq ?? 0
      stepper.reset(createRun(id, catalog.get(id), { send, record: book.record }, commandSeq, settings))
      if (pageReady) stepper.begin()
    },
    deliver(message) {
      book.record({ kind: LogKind.FromPage, message })
      if (message.type === FromPage.Ready) {
        pageReady = true
        stepper.begin()
      } else stepper.current()?.client.receive(message)
    },
    listen(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    log: book.entries,
    onLog: book.onLog,
    settled: stepper.settled,
  }
}
