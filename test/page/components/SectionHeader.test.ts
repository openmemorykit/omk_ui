import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SectionHeader from '../../../src/page/components/SectionHeader.vue'

describe('SectionHeader', () => {
  it('shows its label with the shared section class', () => {
    const wrapper = mount(SectionHeader, { props: { label: 'Players' } })
    expect(wrapper.text()).toBe('Players')
    expect(wrapper.classes()).toContain('omk-section')
  })

  it('is not an option of the list', () => {
    const wrapper = mount(SectionHeader, { props: { label: 'Players' } })
    expect(wrapper.attributes('role')).toBe('presentation')
  })
})
