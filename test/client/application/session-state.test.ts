import { describe, expect, it } from 'vitest'
import { Modality } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { createSessionStore, EMPTY_PAGE_LINK, INACTIVE_TRACE, INITIAL_CLIENT_SESSION } from '../../../src/client/application/session-state'
import type { ClientSession } from '../../../src/client/application/session-state'
import { SHOWN_PROMPT } from '../../../src/client/domain/hold-prompt'
import { IDLE_GESTURE } from '../../../src/client/domain/open-gesture'
import { OPEN_GATE } from '../../../src/client/domain/open-blockers'
import { EMPTY_REGISTRY } from '../../../src/client/domain/owner-registry'
import { NO_GUARD } from '../../../src/client/domain/release-guard'
import { EMPTY_TRACE } from '../../../src/client/domain/trace-buffer'

describe('initial client session', () => {
  it('starts idle, unpaused, on keyboard and mouse, with every domain state at rest', () => {
    expect(INITIAL_CLIENT_SESSION).toStrictEqual({
      registry: EMPTY_REGISTRY,
      gate: OPEN_GATE,
      mode: UiMode.Idle,
      paused: false,
      modality: Modality.KeyboardMouse,
      gesture: IDLE_GESTURE,
      guard: NO_GUARD,
      pad: null,
      link: EMPTY_PAGE_LINK,
      prompt: SHOWN_PROMPT,
      textEntry: false,
      trace: INACTIVE_TRACE,
    })
  })

  it('starts with a page that is not ready, no token and no intent sent', () => {
    expect(EMPTY_PAGE_LINK).toStrictEqual({ ready: false, token: null, lastReadyAt: null, intentSeq: 0, lastAckSeq: 0, unackedSince: null, queuedNotifications: [] })
  })

  it('starts with the journal off, an empty ring and no limited line', () => {
    expect(INACTIVE_TRACE.active).toBe(false)
    expect(INACTIVE_TRACE.buffer).toBe(EMPTY_TRACE)
    expect(INACTIVE_TRACE.lastLimitedAt.size).toBe(0)
  })

  it('is frozen so that no use case can change it in place', () => {
    expect(Object.isFrozen(INITIAL_CLIENT_SESSION)).toBe(true)
    expect(Object.isFrozen(EMPTY_PAGE_LINK)).toBe(true)
    expect(Object.isFrozen(EMPTY_PAGE_LINK.queuedNotifications)).toBe(true)
    expect(Object.isFrozen(INACTIVE_TRACE)).toBe(true)
  })
})

describe('session store', () => {
  it('reads the session it was created with', () => {
    expect(createSessionStore(INITIAL_CLIENT_SESSION).read()).toBe(INITIAL_CLIENT_SESSION)
  })

  it('reads back the last session written, without copying it', () => {
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    const paused: ClientSession = { ...INITIAL_CLIENT_SESSION, paused: true }
    store.write(paused)
    expect(store.read()).toBe(paused)
    expect(INITIAL_CLIENT_SESSION.paused).toBe(false)
  })

  it('keeps two stores independent', () => {
    const first = createSessionStore(INITIAL_CLIENT_SESSION)
    const second = createSessionStore(INITIAL_CLIENT_SESSION)
    first.write({ ...INITIAL_CLIENT_SESSION, textEntry: true })
    expect(second.read()).toBe(INITIAL_CLIENT_SESSION)
  })
})
