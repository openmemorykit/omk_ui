import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServerConsole } from '../../../src/server/infrastructure/server-console'

const PREFIXED_LINE = '[omk_ui] 01:00.000 · joueur 2 · Mode : from=idle, to=radial'
const CONTINUATION_LINE = 'mode panels · pause non'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('server console', () => {
  it('prints each line as the application wrote it: the block already carries the [omk_ui] prefix', () => {
    const print = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const serverConsole = createServerConsole()
    serverConsole.line(PREFIXED_LINE)
    serverConsole.line(CONTINUATION_LINE)
    expect(print.mock.calls).toStrictEqual([[PREFIXED_LINE], [CONTINUATION_LINE]])
  })
})
