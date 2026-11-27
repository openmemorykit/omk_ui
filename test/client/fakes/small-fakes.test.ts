import { describe, expect, it } from 'vitest'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { createConsoleFake } from './console-fake'
import { createLocalEventsFake } from './local-events-fake'
import { createRandomFake, MIDDLE_DRAW } from './random-fake'
import { createServerChannelFake } from './server-channel-fake'

const LINE = '[omk_ui] ready'
const LOW_DRAW = 0.1
const HIGH_DRAW = 0.9
const DRAWS = [LOW_DRAW, HIGH_DRAW]

describe('ConsolePort fake', () => {
  it('keeps every printed line', () => {
    const console = createConsoleFake()
    console.print(LINE)
    expect(console.printed).toStrictEqual([LINE])
  })
})

describe('ServerChannel fake', () => {
  it('keeps every report sent', () => {
    const server = createServerChannelFake()
    const report = { kind: ReportKind.PagePaused, at: 1, data: { paused: true } }
    server.report(report)
    expect(server.reports).toStrictEqual([report])
  })
})

describe('LocalEvents fake', () => {
  it('counts the ready events', () => {
    const events = createLocalEventsFake()
    events.emitReady()
    expect(events.readyCount).toBe(1)
    events.emitReady()
    expect(events.readyCount).toBe(1 + 1)
  })
})

describe('RandomSource fake', () => {
  it('draws the middle value by default', () => {
    expect(createRandomFake().next()).toBe(MIDDLE_DRAW)
  })

  it('draws the given values in a loop and counts the draws', () => {
    const random = createRandomFake(DRAWS)
    expect([random.next(), random.next(), random.next()]).toStrictEqual([...DRAWS, DRAWS[0]])
    expect(random.drawCount).toBe(DRAWS.length + 1)
  })

  it('refuses to be built without a draw', () => {
    expect(() => createRandomFake([])).toThrow(RangeError)
  })
})
