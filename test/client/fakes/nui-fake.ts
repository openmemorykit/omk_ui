import type { NuiPort } from '../../../src/client/application/ports'
import type { ToPage, ToPageMessage, ToPageMessageOf } from '../../../src/protocol/to-page'
import type { PortCall } from '../../shared/fakes/port-call'

export interface BootSent {
  readonly message: ToPageMessageOf<typeof ToPage.Boot>
  readonly sessionToken: string
}

export interface FocusChange {
  readonly focus: boolean
  readonly cursor: boolean
}

export interface NuiFake extends NuiPort {
  readonly calls: readonly PortCall<NuiPort>[]
  readonly sent: readonly ToPageMessage[]
  readonly boots: readonly BootSent[]
  readonly focusChanges: readonly FocusChange[]
  readonly keepInputChanges: readonly boolean[]
  sentOfType<Type extends ToPage>(type: Type): readonly ToPageMessageOf<Type>[]
  keepInputFromAnotherResource(keep: boolean): void
}

export function createNuiFake(): NuiFake {
  const calls: PortCall<NuiPort>[] = []
  const sent: ToPageMessage[] = []
  const boots: BootSent[] = []
  const focusChanges: FocusChange[] = []
  const keepInputChanges: boolean[] = []
  let keepingInput = false
  return {
    send(message) {
      calls.push({ method: 'send', args: [message] })
      sent.push(message)
    },
    sendBoot(message, sessionToken) {
      calls.push({ method: 'sendBoot', args: [message, sessionToken] })
      boots.push({ message, sessionToken })
    },
    setFocus(focus, cursor) {
      calls.push({ method: 'setFocus', args: [focus, cursor] })
      focusChanges.push({ focus, cursor })
    },
    setKeepInput(keep) {
      calls.push({ method: 'setKeepInput', args: [keep] })
      keepInputChanges.push(keep)
      keepingInput = keep
    },
    isKeepingInput() {
      calls.push({ method: 'isKeepingInput', args: [] })
      return keepingInput
    },
    sentOfType: <Type extends ToPage>(type: Type) => sent.filter((message): message is ToPageMessageOf<Type> => message.type === type),
    keepInputFromAnotherResource(keep) {
      keepingInput = keep
    },
    calls,
    sent,
    boots,
    focusChanges,
    keepInputChanges,
  }
}
