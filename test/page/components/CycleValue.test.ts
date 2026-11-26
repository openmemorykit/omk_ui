import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import CycleValue from '../../../src/page/components/CycleValue.vue'
import { PageCommandType } from '../../../src/page/domain/page-commands'
import { mountWithUi } from './fixtures/ui-harness'

const ARROWS = 2
const PROPS = { itemId: 'role', value: 'Moderator' }

describe('CycleValue', () => {
  it('shows the current option between two arrows', () => {
    const { wrapper } = mountWithUi(CycleValue, { props: PROPS })
    expect(wrapper.classes()).toContain('omk-cycle')
    expect(wrapper.find('.omk-cycle__value').text()).toBe('Moderator')
    expect(wrapper.findAll('.omk-cycle__arrow')).toHaveLength(ARROWS)
  })

  it('steps back by one on the left arrow', async () => {
    const { wrapper, dispatch } = mountWithUi(CycleValue, { props: PROPS })
    await wrapper.findAll('.omk-cycle__arrow')[0]?.trigger('click')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: PageCommandType.StepItem, itemId: 'role', step: -1 })
  })

  it('steps forward by one on the right arrow', async () => {
    const { wrapper, dispatch } = mountWithUi(CycleValue, { props: PROPS })
    await wrapper.findAll('.omk-cycle__arrow')[1]?.trigger('click')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: PageCommandType.StepItem, itemId: 'role', step: 1 })
  })

  it('never sends a click on the item from an arrow', async () => {
    const { wrapper, dispatch } = mountWithUi(CycleValue, { props: PROPS })
    for (const arrow of wrapper.findAll('.omk-cycle__arrow')) await arrow.trigger('click')
    expect(dispatch.mock.calls.map(([command]) => command.type)).toEqual([PageCommandType.StepItem, PageCommandType.StepItem])
  })

  it('keeps the arrow click from reaching the row', async () => {
    const onRowClick = vi.fn()
    const { wrapper } = mountWithUi({ render: () => h('div', { onClick: onRowClick }, [h(CycleValue, PROPS)]) })
    for (const arrow of wrapper.findAll('.omk-cycle__arrow')) await arrow.trigger('click')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('hides the decorative arrows from assistive technology', () => {
    const { wrapper } = mountWithUi(CycleValue, { props: PROPS })
    for (const arrow of wrapper.findAll('.omk-cycle__arrow')) expect(arrow.attributes('aria-hidden')).toBe('true')
  })
})
