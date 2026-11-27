import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { FromPage } from '../../../src/protocol/from-page'

const MOUNT_ID = 'omk-ui'
const SETTLE_TICKS = 6
const RESOURCE = 'omk_ui'

let fetcher: Mock<typeof fetch>

async function settle(): Promise<void> {
  for (let tick = 0; tick < SETTLE_TICKS; tick += 1) await Promise.resolve()
}

async function startPage(): Promise<void> {
  vi.resetModules()
  await import('../../../src/page/main')
  await settle()
}

beforeEach(() => {
  document.body.replaceChildren()
  const mount = document.createElement('div')
  mount.id = MOUNT_ID
  document.body.append(mount)
  fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null)))
  vi.stubGlobal('fetch', fetcher)
  vi.stubGlobal('__OMK_PREVIEW__', false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'GetParentResourceName')
})

describe('page entry in production', () => {
  it('mounts the page and asks the client for its boot when GetParentResourceName exists', async () => {
    vi.stubGlobal('GetParentResourceName', () => RESOURCE)
    await startPage()
    expect(document.querySelector('.omk-app')).not.toBeNull()
    expect(fetcher).toHaveBeenCalledWith(`https://${RESOURCE}/${FromPage.Ready}`, expect.objectContaining({ method: 'POST' }))
  })

  it('mounts nothing and warns once outside FiveM, without any preview fallback', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await startPage()
    expect(document.querySelector('.omk-app')).toBeNull()
    expect(document.querySelector('[data-omk-preview]')).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('GetParentResourceName')
  })

  it('does nothing without the mount element', async () => {
    document.body.replaceChildren()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await startPage()
    expect(warn).not.toHaveBeenCalled()
  })

  it('mounts the preview, not the production host, when built for the preview', async () => {
    vi.stubGlobal('__OMK_PREVIEW__', true)
    await startPage()
    await vi.waitFor(() => expect(document.querySelector('[data-omk-preview]')).not.toBeNull())
    expect(fetcher).not.toHaveBeenCalled()
  })
})
