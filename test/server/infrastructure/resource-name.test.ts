import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { isRunningAsKit, KIT_RESOURCE_NAME } from '../../../src/server/infrastructure/resource-name'

const COPIED_FOLDER = 'omk_ui_copy'

let recorder: NativeRecorder | null = null

function runningUnder(name: string): NativeRecorder {
  recorder = installNatives({ GetCurrentResourceName: () => name })
  return recorder
}

afterEach(() => {
  recorder?.restore()
  recorder = null
})

describe('resource name', () => {
  it('GetCurrentResourceName() other than omk_ui: refused at start, with the name found', () => {
    runningUnder(COPIED_FOLDER)
    const refused: string[] = []
    expect(isRunningAsKit((found) => refused.push(found))).toBe(false)
    expect(refused).toStrictEqual([COPIED_FOLDER])
  })

  it('accepts the folder name omk_ui without any refusal', () => {
    const installed = runningUnder(KIT_RESOURCE_NAME)
    const refused: string[] = []
    expect(isRunningAsKit((found) => refused.push(found))).toBe(true)
    expect(refused).toStrictEqual([])
    expect(installed.callsOf('GetCurrentResourceName')).toStrictEqual([[]])
  })

  it('still answers no when the refusal handler fails', () => {
    runningUnder(COPIED_FOLDER)
    expect(isRunningAsKit(() => {
      throw new Error('console failed')
    })).toBe(false)
  })
})
