import { FromPage } from '../../protocol/from-page'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

export type PageMessageHandler = (type: FromPage, body: unknown) => void

type AnswerPage = (answer: unknown) => void

const EMPTY_ANSWER = {}

export function registerNuiCallbacks(handleMessage: PageMessageHandler, onFailure: FailureHandler): void {
  for (const type of Object.values(FromPage)) {
    guardedCall(onFailure, `register NUI callback ${type}`, () => {
      RegisterNuiCallback(type, (body: unknown, answerPage: AnswerPage) => {
        guardedCall(onFailure, `answer to the page for ${type}`, () => answerPage(EMPTY_ANSWER), undefined)
        guardedCall(onFailure, `NUI callback ${type}`, () => handleMessage(type, body), undefined)
      })
    }, undefined)
  }
}
