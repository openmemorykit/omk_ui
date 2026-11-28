import { createSessionStore, INITIAL_CLIENT_SESSION, type ClientSession, type SessionStore } from '../../../src/client/application/session-state'
import { createUseCaseContext, type UseCaseContext } from '../../../src/client/application/use-case-context'
import { receiveReady, SESSION_TOKEN_FIELD } from '../../../src/client/application/page-link'
import type { ReportEnvelope } from '../../../src/shared/report/report-envelope'
import type { ReportKind } from '../../../src/shared/report/report-kind'
import { createClientPortsFake, type ClientPortsFake } from '../fakes/client-ports-fake'

export const HARNESS_START = 10_000
export const KIT_VERSION = '0.3.0'

export interface UseCaseHarness {
  readonly ports: ClientPortsFake
  readonly store: SessionStore
  readonly context: UseCaseContext
}

export function createHarness(initial: ClientSession = INITIAL_CLIENT_SESSION): UseCaseHarness {
  const ports = createClientPortsFake(HARNESS_START)
  const store = createSessionStore(initial)
  return { ports, store, context: createUseCaseContext(ports, store, KIT_VERSION) }
}

export function createReadyHarness(initial: ClientSession = INITIAL_CLIENT_SESSION): UseCaseHarness {
  const harness = createHarness(initial)
  receiveReady(harness.context)
  return harness
}

export function withToken(harness: UseCaseHarness, body: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { ...body, [SESSION_TOKEN_FIELD]: harness.store.read().link.token }
}

export function tracedOfKind<Kind extends ReportKind>(harness: UseCaseHarness, kind: Kind): readonly Extract<ReportEnvelope, { readonly kind: Kind }>[] {
  return harness.store.read().trace.buffer.lines.filter((line): line is Extract<ReportEnvelope, { readonly kind: Kind }> => line.kind === kind)
}
