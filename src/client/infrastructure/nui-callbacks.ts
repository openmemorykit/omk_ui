import { FromPage } from '../../protocol/from-page'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

export type PageMessageHandler = (type: FromPage, body: unknown) => void

type AnswerPage = (answer: unknown) => void

const EMPTY_ANSWER = {}

export function registerNuiCallbacks(handleMessage: PageMessageHandler, onFailure: NativeFailureHandler): void {
  for (const type of Object.values(FromPage)) {
    RegisterNuiCallback(type, (body: unknown, answerPage: AnswerPage) => {
      guardedNativeCall(onFailure, `answer to the page for ${type}`, () => answerPage(EMPTY_ANSWER), undefined)
      guardedNativeCall(onFailure, `NUI callback ${type}`, () => handleMessage(type, body), undefined)
    })
  }
}
