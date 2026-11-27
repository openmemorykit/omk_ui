import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { FromPage } from '../../../src/protocol/from-page'
import { mountScripted, type MountedPage, type ScriptedHost } from './rig'

vi.mock('../../../src/page/components/ToastStack.vue', () => ({
  default: defineComponent({
    render() {
      throw new Error('toast stack exploded')
    },
  }),
}))

let page: MountedPage<ScriptedHost>

afterEach(() => {
  page.unmount()
})

describe('component errors', () => {
  it('sends one page error to the host when a component throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    page = mountScripted()
    const errors = page.host.sent.filter((message) => message.type === FromPage.PageError)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ type: FromPage.PageError, message: 'toast stack exploded' })
  })
})
