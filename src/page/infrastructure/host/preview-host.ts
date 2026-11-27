import type { HostBridge } from '../../application/ports'
import { FromPage, type FromPageMessage } from '../../../protocol/from-page'
import type { ToPageMessage } from '../../../protocol/to-page'
import type { PreviewRuntime } from '../../../../preview/runtime/types'

type Listener = (message: ToPageMessage) => void

function guarded(listener: Listener): Listener {
  return (message) => {
    try {
      listener(message)
    } catch {
      return
    }
  }
}

export function createPreviewHost(runtime: PreviewRuntime): HostBridge {
  let listening = 0
  const send = (message: FromPageMessage): void => {
    try {
      runtime.deliver(message)
    } catch {
      return
    }
  }
  return {
    send,
    listen(listener) {
      const stop = runtime.listen(guarded(listener))
      listening += 1
      if (listening === 1) send({ type: FromPage.Ready })
      let stopped = false
      return () => {
        if (stopped) return
        stopped = true
        listening -= 1
        stop()
      }
    },
  }
}
