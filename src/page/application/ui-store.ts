import { ToPage } from '../../protocol/to-page'
import { PageCommandType, type UiCommand } from '../domain/page-commands'
import { transition } from '../domain/intent-engine'
import { createInitialState, type UiState } from '../domain/ui-state'
import { createEffectRunner } from './effect-runner'
import type { Dispatch, FrameRequester, UiPorts, UiStore } from './ports'

type Listener = (state: UiState) => void

function notifyAll(listeners: ReadonlySet<Listener>, state: UiState): void {
  for (const listener of [...listeners]) {
    try {
      listener(state)
    } catch {
      continue
    }
  }
}

function singleFrame(frames: FrameRequester, dispatch: Dispatch): () => void {
  let requested = false
  return () => {
    if (requested) return
    requested = true
    frames.request(() => {
      requested = false
      dispatch({ type: PageCommandType.FrameTick })
    })
  }
}

export function createUiStore(ports: UiPorts, initial: UiState = createInitialState()): UiStore {
  let current = initial
  const listeners = new Set<Listener>()
  const queue: UiCommand[] = []
  let draining = false
  const requestFrame = singleFrame(ports.frames, (command) => dispatch(command))
  const run = createEffectRunner(ports, (command) => dispatch(command))

  const apply = (command: UiCommand): void => {
    const now = ports.clock.now()
    if (command.type === ToPage.Boot) ports.translator.load(command.locale)
    const result = transition(current, command, now)
    current = result.state
    notifyAll(listeners, current)
    run(result.effects, now)
    if (current.ackPending) requestFrame()
  }

  function dispatch(command: UiCommand): void {
    queue.push(command)
    if (draining) return
    draining = true
    try {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) apply(next)
    } finally {
      draining = false
    }
  }

  return {
    dispatch,
    state: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
