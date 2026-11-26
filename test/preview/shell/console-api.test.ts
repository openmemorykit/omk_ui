import { describe, expect, it, vi, type Mock } from 'vitest'
import { installConsoleApi, type ConsoleHost } from '../../../preview/shell/console-api'
import { InputSource, Intent, IntentPhase } from '../../../src/protocol/intents'
import { ToPage } from '../../../src/protocol/to-page'

function install(): { host: ConsoleHost; dispatch: Mock; remove: () => void } {
  const host: ConsoleHost = {}
  const dispatch = vi.fn()
  return { host, dispatch, remove: installConsoleApi(host, dispatch) }
}

const HALF = 0.5
const FAR = 7

describe('installConsoleApi', () => {
  it('exposes ui.dispatch and ui.stick on the window', () => {
    const { host } = install()
    expect(typeof host.ui?.dispatch).toBe('function')
    expect(typeof host.ui?.stick).toBe('function')
  })

  it('sends a press then a release for an intent, from the console', () => {
    const { host, dispatch } = install()
    host.ui?.dispatch(Intent.Confirm)
    expect(dispatch.mock.calls).toEqual([
      [{ type: ToPage.Intent, intent: Intent.Confirm, phase: IntentPhase.Press, source: InputSource.Console }],
      [{ type: ToPage.Intent, intent: Intent.Confirm, phase: IntentPhase.Release, source: InputSource.Console }],
    ])
  })

  it('sends a single phase when one is given', () => {
    const { host, dispatch } = install()
    host.ui?.dispatch(Intent.Submit, IntentPhase.Press)
    expect(dispatch.mock.calls).toEqual([[{ type: ToPage.Intent, intent: Intent.Submit, phase: IntentPhase.Press, source: InputSource.Console }]])
  })

  it.each(['nope', '', 'constructor', '__proto__', 'toString', null, undefined, {}])('ignores the unknown intent %j', (value) => {
    const { host, dispatch } = install()
    expect(() => host.ui?.dispatch(value as never)).not.toThrow()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('ignores an unknown phase', () => {
    const { host, dispatch } = install()
    host.ui?.dispatch(Intent.Up, 'hold' as never)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('sends the stick position', () => {
    const { host, dispatch } = install()
    host.ui?.stick(HALF, -1)
    expect(dispatch).toHaveBeenCalledWith({ type: ToPage.Stick, x: HALF, y: -1 })
  })

  it('clamps the stick into the unit square', () => {
    const { host, dispatch } = install()
    host.ui?.stick(FAR, -FAR)
    expect(dispatch).toHaveBeenCalledWith({ type: ToPage.Stick, x: 1, y: -1 })
  })

  it.each([[Number.NaN, 0], [0, Number.POSITIVE_INFINITY], ['1', 0], [0, undefined]])('ignores the stick values %j, %j', (x, y) => {
    const { host, dispatch } = install()
    host.ui?.stick(x as never, y as never)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('removes the API on cleanup and leaves other properties alone', () => {
    const { host, remove } = install()
    remove()
    expect(host.ui).toBeUndefined()
  })

  it('does not remove an API installed by someone else', () => {
    const { host, remove } = install()
    const other = { dispatch: vi.fn(), stick: vi.fn() }
    host.ui = other
    remove()
    expect(host.ui).toBe(other)
  })
})
