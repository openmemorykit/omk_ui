import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest'

const RESOURCE_NAME = 'omk_ui'
const WRONG_NAME = 'omk_ui_copy'
const MAIN_PATH = '../../../src/server/main'

async function startWithResourceName(resourceName: string): Promise<MockInstance<(...data: unknown[]) => void>> {
  vi.resetModules()
  vi.stubGlobal('GetCurrentResourceName', () => resourceName)
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await import(MAIN_PATH)
  return error
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('server main', () => {
  it('starts silently under the folder name omk_ui', async () => {
    expect(await startWithResourceName(RESOURCE_NAME)).not.toHaveBeenCalled()
  })

  it('refuses to start under another folder name, with one clear line', async () => {
    const error = await startWithResourceName(WRONG_NAME)
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain(WRONG_NAME)
  })
})
