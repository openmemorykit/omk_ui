import { afterEach, describe, expect, it } from 'vitest'
import { sendIntent } from '../../../src/client/application/pump-inputs'
import { INITIAL_CLIENT_SESSION } from '../../../src/client/application/session-state'
import { InputSource, Intent, IntentPhase } from '../../../src/protocol/intents'
import { ToPage } from '../../../src/protocol/to-page'
import { expectKeepInputNeverTurnedOn, watchedPorts } from './watched-ports'

const NOW = 4000
const SECOND_SEQUENCE = 2
const PRESS = { intent: Intent.Down, phase: IntentPhase.Press, source: InputSource.Pad } as const

afterEach(expectKeepInputNeverTurnedOn)

describe('sendIntent', () => {
  it('sends the intent to the page with the next sequence number and remembers it', () => {
    const ports = watchedPorts(NOW)
    const link = sendIntent(ports, INITIAL_CLIENT_SESSION.link, PRESS)
    expect(ports.nui.sentOfType(ToPage.Intent)).toStrictEqual([{ type: ToPage.Intent, ...PRESS, seq: 1 }])
    expect(link.intentSeq).toBe(1)
    expect(link.unackedSince).toBe(NOW)
    expect(link.lastIntent).toStrictEqual({ intent: PRESS.intent, source: PRESS.source, seq: 1, at: NOW })
  })

  it('keeps the date of the oldest intent the page has not acknowledged', () => {
    const ports = watchedPorts(NOW)
    const first = sendIntent(ports, INITIAL_CLIENT_SESSION.link, PRESS)
    ports.clock.advance(NOW)
    const second = sendIntent(ports, first, PRESS)
    expect(second.intentSeq).toBe(SECOND_SEQUENCE)
    expect(second.unackedSince).toBe(NOW)
  })
})
