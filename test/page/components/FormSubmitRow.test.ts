import { describe, expect, it } from 'vitest'
import FormSubmitRow from '../../../src/page/components/FormSubmitRow.vue'
import { SubmitState, type FormSubmitView } from '../../../src/page/application/views/form-submit-view'
import { PageCommandType } from '../../../src/page/domain/page-commands'
import { submitOf } from './fixtures/row-fixtures'
import { mountWithUi } from './fixtures/ui-harness'

function render(submit: FormSubmitView): ReturnType<typeof mountWithUi> {
  return mountWithUi(FormSubmitRow, { props: { submit } })
}

describe('FormSubmitRow states', () => {
  it('is a primary option with the submit label when ready', () => {
    const { wrapper } = render(submitOf())
    const option = wrapper.find('[role="option"]')
    expect(option.attributes('id')).toBe('omk-row-__submit')
    expect(option.attributes('aria-selected')).toBe('false')
    const row = wrapper.find('.omk-row')
    expect(row.classes()).toEqual(['omk-row', 'omk-row--primary'])
    expect(row.find('.omk-row__label').text()).toBe('Send')
    expect(wrapper.find('.omk-spinner').exists()).toBe(false)
    expect(wrapper.find('.omk-row__error').exists()).toBe(false)
  })

  it('is focused with its option selected', () => {
    const { wrapper } = render(submitOf({ focused: true }))
    expect(wrapper.find('.omk-row').classes()).toContain('is-focused')
    expect(wrapper.find('[role="option"]').attributes('aria-selected')).toBe('true')
  })

  it('shows the count of fields to fix as a warning value', () => {
    const { wrapper } = render(submitOf({ state: SubmitState.Invalid, errorCount: 2, countText: '2 champs à corriger' }))
    const count = wrapper.find('.omk-row__value')
    expect(count.text()).toBe('2 champs à corriger')
    expect(count.classes()).toContain('omk-row__value--warning')
  })

  it('shows a spinner while pending', () => {
    const { wrapper } = render(submitOf({ state: SubmitState.Pending }))
    expect(wrapper.find('.omk-row__value .omk-spinner').exists()).toBe(true)
  })

  it('shows the message of a refusal under the row', () => {
    const { wrapper } = render(submitOf({ state: SubmitState.Rejected, message: 'Refused by the server', errorCount: 0 }))
    const error = wrapper.find('.omk-row__error')
    expect(error.text()).toBe('Refused by the server')
    expect(error.attributes('role')).toBe('alert')
    expect(wrapper.find('.omk-row').find('.omk-row__error').exists()).toBe(false)
  })

  it('shows the no-reply message under the row', () => {
    const { wrapper } = render(submitOf({ state: SubmitState.NoReply, message: 'No reply, try again' }))
    expect(wrapper.find('.omk-row__error').text()).toBe('No reply, try again')
  })

  it('shows both the count and the message of a refusal with fields to fix', () => {
    const { wrapper } = render(submitOf({ state: SubmitState.Rejected, message: 'Refused', countText: '1 champ à corriger', errorCount: 1 }))
    expect(wrapper.find('.omk-row__value').text()).toBe('1 champ à corriger')
    expect(wrapper.find('.omk-row__error').text()).toBe('Refused')
  })
})

describe('FormSubmitRow commands', () => {
  it('sends ClickItem with the id of the submit row', async () => {
    const { wrapper, dispatch } = render(submitOf())
    await wrapper.find('[role="option"]').trigger('click')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: PageCommandType.ClickItem, itemId: '__submit' })
  })

  it('sends HoverItem with the id of the submit row', async () => {
    const { wrapper, dispatch } = render(submitOf())
    await wrapper.find('[role="option"]').trigger('mousemove')
    expect(dispatch).toHaveBeenCalledWith({ type: PageCommandType.HoverItem, itemId: '__submit' })
  })
})
