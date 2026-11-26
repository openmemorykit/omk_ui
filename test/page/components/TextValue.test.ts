import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TextValue from '../../../src/page/components/TextValue.vue'

const LONG_TEXT_LENGTH = 300

describe('TextValue', () => {
  it('shows the example text as a placeholder when empty', () => {
    const wrapper = mount(TextValue, { props: { text: '', empty: true, placeholder: 'No note' } })
    expect(wrapper.find('.omk-row__placeholder').text()).toBe('No note')
    expect(wrapper.find('.omk-row__text').exists()).toBe(false)
  })

  it('shows nothing when empty without an example', () => {
    const wrapper = mount(TextValue, { props: { text: '', empty: true, placeholder: null } })
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('.omk-row__placeholder').exists()).toBe(false)
  })

  it('shows the entered text in the truncating element', () => {
    const wrapper = mount(TextValue, { props: { text: 'Arrived with a friend', empty: false, placeholder: 'No note' } })
    expect(wrapper.find('.omk-row__text').text()).toBe('Arrived with a friend')
    expect(wrapper.find('.omk-row__placeholder').exists()).toBe(false)
  })

  it('keeps the whole text in the document for truncation by the stylesheet', () => {
    const long = 'x'.repeat(LONG_TEXT_LENGTH)
    expect(mount(TextValue, { props: { text: long, empty: false, placeholder: null } }).text()).toBe(long)
  })
})
