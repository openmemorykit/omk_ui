import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import ToggleSwitch from '../../../src/page/components/ToggleSwitch.vue'
import { PageCommandType } from '../../../src/page/domain/page-commands'
import { mountWithUi } from './fixtures/ui-harness'

describe('ToggleSwitch', () => {
  it('is on with the on class and a checked state', () => {
    const { wrapper } = mountWithUi(ToggleSwitch, { props: { itemId: 'enabled', on: true } })
    expect(wrapper.classes()).toContain('omk-switch')
    expect(wrapper.classes()).toContain('is-on')
    expect(wrapper.attributes('role')).toBe('switch')
    expect(wrapper.attributes('aria-checked')).toBe('true')
  })

  it('is off without the on class', () => {
    const { wrapper } = mountWithUi(ToggleSwitch, { props: { itemId: 'enabled', on: false } })
    expect(wrapper.classes()).not.toContain('is-on')
    expect(wrapper.attributes('aria-checked')).toBe('false')
  })

  it('sends a click on its item when clicked', async () => {
    const { wrapper, dispatch } = mountWithUi(ToggleSwitch, { props: { itemId: 'enabled', on: false } })
    await wrapper.trigger('click')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: PageCommandType.ClickItem, itemId: 'enabled' })
  })

  it('does not let the click reach the row, which would click twice', async () => {
    const onRowClick = vi.fn()
    const { wrapper } = mountWithUi({ render: () => h('div', { onClick: onRowClick }, [h(ToggleSwitch, { itemId: 'enabled', on: true })]) })
    await wrapper.find('.omk-switch').trigger('click')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('fails loudly without the page context', () => {
    expect(() => mount(ToggleSwitch, { props: { itemId: 'enabled', on: true } })).toThrow(/UI_CONTEXT/)
  })
})
