import { expect } from 'vitest'
import { createSessionStore, INITIAL_CLIENT_SESSION, type ClientSession, type SessionStore } from '../../../src/client/application/session-state'
import type { ReportKind } from '../../../src/shared/report/report-kind'
import type { TraceLine } from '../../../src/client/domain/trace-buffer'
import type { Prompt } from '@openmemorykit/ui/contract'
import { EMPTY_REGISTRY, type RegistryState } from '../../../src/client/domain/owner-registry'
import { FixtureOwner } from '../../fixtures/owned'
import { GARAGE_RADIAL_ENTRY } from '../../fixtures/surfaces'
import { createClientPortsFake, type ClientPortsFake } from '../fakes/client-ports-fake'

const portsOfThisTest: ClientPortsFake[] = []

export function watchedPorts(startAt = 0): ClientPortsFake {
  const ports = createClientPortsFake(startAt)
  portsOfThisTest.push(ports)
  return ports
}

export function expectKeepInputNeverTurnedOn(): void {
  const turnedOn = portsOfThisTest.filter((ports) => ports.nui.keepInputChanges.includes(true))
  portsOfThisTest.length = 0
  expect(turnedOn).toHaveLength(0)
}

export function storeWith(change: Partial<ClientSession> = {}): SessionStore {
  return createSessionStore({ ...INITIAL_CLIENT_SESSION, ...change })
}

export function linesOf(store: SessionStore, kind: ReportKind): readonly TraceLine[] {
  return store.read().trace.buffer.lines.filter((line) => line.kind === kind)
}

export const REGISTRY_WITH_RADIAL_ENTRY: RegistryState = Object.freeze({ ...EMPTY_REGISTRY, radialEntries: Object.freeze([{ owner: FixtureOwner.Garage, entry: GARAGE_RADIAL_ENTRY }]) })

export function registryWithPrompt(prompt: Prompt): RegistryState {
  return { ...EMPTY_REGISTRY, prompts: [{ owner: FixtureOwner.Garage, prompt }] }
}
