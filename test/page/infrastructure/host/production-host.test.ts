import { afterEach, describe, expect, it, vi } from 'vitest'
import { FromPage } from '../../../../src/protocol/from-page'
import { createProductionHost } from '../../../../src/page/infrastructure/host/production-host'

const RESOURCE = 'omk_ui'

const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null)))

function windowWith(extra: Record<string, unknown>): Window {
  return Object.assign(Object.create(window) as Window, { fetch: fetcher }, extra)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createProductionHost', () => {
  it('is null outside FiveM, where GetParentResourceName does not exist', () => {
    expect(createProductionHost(windowWith({}))).toBeNull()
  })

  it.each([
    ['a value that is not a function', 'omk_ui'],
    ['a function returning nothing', () => undefined],
    ['a function returning an empty name', () => ''],
    ['a function that throws', () => {
      throw new Error('native missing')
    }],
  ])('is null for %s', (_name, value) => {
    expect(createProductionHost(windowWith({ GetParentResourceName: value }))).toBeNull()
  })

  it('posts to the callbacks of the resource when GetParentResourceName exists', () => {
    const win = windowWith({ GetParentResourceName: () => RESOURCE })
    const host = createProductionHost(win)
    expect(host).not.toBeNull()
    host?.listen(() => undefined)
    expect(fetcher).toHaveBeenCalledWith(`https://${RESOURCE}/${FromPage.Ready}`, expect.objectContaining({ method: 'POST' }))
  })

  it('sends host warnings to the console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const win = windowWith({ GetParentResourceName: () => RESOURCE })
    const host = createProductionHost(win)
    host?.send({ type: FromPage.EscapeReleased })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sendWithoutToken'))
  })
})
