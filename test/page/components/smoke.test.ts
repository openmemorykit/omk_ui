import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SmokeFixture from './fixtures/smoke-fixture.vue'

describe('component smoke test', () => {
  it('mounts a single-file component in the dom project', () => {
    const wrapper = mount(SmokeFixture, { props: { label: 'Open' } })
    expect(wrapper.text()).toBe('Open')
    expect(wrapper.attributes('data-surface')).toBe('smoke')
  })

  it('emits when clicked', async () => {
    const wrapper = mount(SmokeFixture, { props: { label: 'Open' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('pick')).toHaveLength(1)
  })
})
