import type { ToPageMessage, ToPageMessageOf, ToPage } from '../../protocol/to-page'
import type { NuiPort } from '../application/ports'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

const SESSION_TOKEN_FIELD = 'sessionToken'

export function createNuiPort(onFailure: NativeFailureHandler): NuiPort {
  const postToPage = (body: object): void => {
    guardedNativeCall(onFailure, 'SendNuiMessage', () => SendNuiMessage(JSON.stringify(body)), false)
  }
  return {
    send: (message: ToPageMessage) => postToPage(message),
    sendBoot: (message: ToPageMessageOf<typeof ToPage.Boot>, sessionToken: string) => postToPage({ ...message, [SESSION_TOKEN_FIELD]: sessionToken }),
    setFocus: (focus, cursor) => {
      guardedNativeCall(onFailure, 'SetNuiFocus', () => SetNuiFocus(focus, cursor), undefined)
    },
    setKeepInput: (keep) => {
      guardedNativeCall(onFailure, 'SetNuiFocusKeepInput', () => SetNuiFocusKeepInput(keep), undefined)
    },
    isKeepingInput: () => guardedNativeCall(onFailure, 'IsNuiFocusKeepingInput', () => IsNuiFocusKeepingInput(), false),
  }
}
