import type { ToPageMessage, ToPageMessageOf, ToPage } from '../../protocol/to-page'
import type { NuiPort } from '../application/ports'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

const SESSION_TOKEN_FIELD = 'sessionToken'

export function createNuiPort(onFailure: FailureHandler): NuiPort {
  const postToPage = (body: object): void => {
    guardedCall(onFailure, 'SendNuiMessage', () => SendNuiMessage(JSON.stringify(body)), false)
  }
  return {
    send: (message: ToPageMessage) => postToPage(message),
    sendBoot: (message: ToPageMessageOf<typeof ToPage.Boot>, sessionToken: string) => postToPage({ ...message, [SESSION_TOKEN_FIELD]: sessionToken }),
    setFocus: (focus, cursor) => {
      guardedCall(onFailure, 'SetNuiFocus', () => SetNuiFocus(focus, cursor), undefined)
    },
    setKeepInput: (keep) => {
      guardedCall(onFailure, 'SetNuiFocusKeepInput', () => SetNuiFocusKeepInput(keep), undefined)
    },
    isKeepingInput: () => guardedCall(onFailure, 'IsNuiFocusKeepingInput', () => IsNuiFocusKeepingInput(), false),
  }
}
