import { BadgeTone, IconName } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import CycleValue from '../../../src/page/components/CycleValue.vue'
import ItemRow from '../../../src/page/components/ItemRow.vue'
import SectionHeader from '../../../src/page/components/SectionHeader.vue'
import TextValue from '../../../src/page/components/TextValue.vue'
import ToggleSwitch from '../../../src/page/components/ToggleSwitch.vue'
import { RowKind, RowVariant, rowElementId, type RowView } from '../../../src/page/application/views/row-view'
import { PageCommandType } from '../../../src/page/domain/page-commands'
import { ICON_PATHS } from '../../../src/page/theme/icons'
import { rowOf } from './fixtures/row-fixtures'
import { mountWithUi } from './fixtures/ui-harness'

function render(row: RowView): ReturnType<typeof mountWithUi> {
  return mountWithUi(ItemRow, { props: { row } })
}

describe('ItemRow kind', () => {
  it('chooses CycleValue for a cycle and passes the option label', () => {
    const { wrapper } = render(rowOf({ id: 'role', kind: RowKind.Cycle, value: 'Admin' }))
    const cycle = wrapper.findComponent(CycleValue)
    expect(cycle.exists()).toBe(true)
    expect(cycle.props()).toEqual({ itemId: 'role', value: 'Admin' })
    expect(wrapper.findComponent(ToggleSwitch).exists()).toBe(false)
    expect(wrapper.findComponent(TextValue).exists()).toBe(false)
  })

  it('chooses ToggleSwitch for a toggle', () => {
    const { wrapper } = render(rowOf({ id: 'enabled', kind: RowKind.Toggle, on: true }))
    expect(wrapper.findComponent(ToggleSwitch).props()).toEqual({ itemId: 'enabled', on: true })
    expect(wrapper.findComponent(CycleValue).exists()).toBe(false)
    expect(wrapper.findComponent(TextValue).exists()).toBe(false)
  })

  it('chooses TextValue for a text field', () => {
    const { wrapper } = render(rowOf({ kind: RowKind.Text, value: '', empty: true, placeholder: 'No note' }))
    expect(wrapper.findComponent(TextValue).props()).toEqual({ text: '', empty: true, placeholder: 'No note' })
    expect(wrapper.findComponent(CycleValue).exists()).toBe(false)
    expect(wrapper.findComponent(ToggleSwitch).exists()).toBe(false)
  })

  it('chooses no control for a plain row and shows its value', () => {
    const { wrapper } = render(rowOf({ kind: RowKind.Plain, value: 'Online' }))
    expect(wrapper.findComponent(CycleValue).exists()).toBe(false)
    expect(wrapper.findComponent(ToggleSwitch).exists()).toBe(false)
    expect(wrapper.findComponent(TextValue).exists()).toBe(false)
    expect(wrapper.find('.omk-row__value').text()).toBe('Online')
  })

  it('chooses SectionHeader for a section, without an option', () => {
    const { wrapper } = render(rowOf({ kind: RowKind.Section, label: 'Players' }))
    expect(wrapper.findComponent(SectionHeader).props('label')).toBe('Players')
    expect(wrapper.find('[role="option"]').exists()).toBe(false)
    expect(wrapper.find('.omk-row').exists()).toBe(false)
  })
})

describe('ItemRow states', () => {
  it('is a plain option at rest', () => {
    const { wrapper } = render(rowOf({ id: 'alex', label: 'Alex' }))
    const option = wrapper.find('[role="option"]')
    expect(option.attributes('id')).toBe(rowElementId('alex'))
    expect(option.attributes('aria-selected')).toBe('false')
    expect(option.attributes('aria-disabled')).toBeUndefined()
    const row = wrapper.find('.omk-row')
    expect(row.classes()).toEqual(['omk-row'])
    expect(row.find('.omk-row__label').text()).toBe('Alex')
  })

  it('marks the focused row', () => {
    const { wrapper } = render(rowOf({ focused: true }))
    expect(wrapper.find('[role="option"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('.omk-row').classes()).toContain('is-focused')
  })

  it('marks a disabled row as disabled for assistive technology', () => {
    const { wrapper } = render(rowOf({ disabled: true }))
    expect(wrapper.find('[role="option"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('.omk-row').classes()).toContain('is-disabled')
    expect(wrapper.find('.omk-row').classes()).not.toContain('is-focused')
  })

  it('combines disabled and focused classes for the outlined look', () => {
    const { wrapper } = render(rowOf({ disabled: true, focused: true, disabledFocused: true }))
    expect(wrapper.find('.omk-row').classes()).toEqual(expect.arrayContaining(['is-disabled', 'is-focused']))
  })

  it.each([
    [RowVariant.Primary, 'omk-row--primary'],
    [RowVariant.Danger, 'omk-row--danger'],
  ])('carries the %s variant class', (variant, name) => {
    const { wrapper } = render(rowOf({ variant }))
    expect(wrapper.find('.omk-row').classes()).toContain(name)
  })

  it('has no variant class by default', () => {
    const { wrapper } = render(rowOf())
    expect(wrapper.find('.omk-row').classes().some((name) => name.startsWith('omk-row--'))).toBe(false)
  })

  it('shows a spinner before the value while pending', () => {
    const { wrapper } = render(rowOf({ pending: true, value: 'Checking' }))
    const value = wrapper.find('.omk-row__value')
    expect(value.find('.omk-spinner').exists()).toBe(true)
    expect(value.text()).toBe('Checking')
    expect(value.element.firstElementChild?.classList.contains('omk-spinner')).toBe(true)
  })

  it('shows no spinner when not pending', () => {
    expect(render(rowOf({ value: 'x' })).wrapper.find('.omk-spinner').exists()).toBe(false)
  })

  it.each(Object.values(BadgeTone))('shows a %s badge with its label', (tone) => {
    const { wrapper } = render(rowOf({ badge: { tone, label: 'Staff' } }))
    const badge = wrapper.find('.omk-badge')
    expect(badge.attributes('data-tone')).toBe(tone)
    expect(badge.text()).toBe('Staff')
  })

  it('draws the icon of the row before its label', () => {
    const { wrapper } = render(rowOf({ icon: IconName.Check, label: 'Accept' }))
    const row = wrapper.find('.omk-row')
    const icon = row.element.firstElementChild
    expect(icon?.tagName.toLowerCase()).toBe('svg')
    expect(icon?.classList.contains('omk-icon')).toBe(true)
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.findAll('.omk-row > svg path').map((path) => path.attributes('d'))).toEqual(ICON_PATHS[IconName.Check])
  })

  it('draws no icon without one', () => {
    expect(render(rowOf()).wrapper.find('.omk-row > svg').exists()).toBe(false)
  })

  it('shows its error under the row, outside the fixed-height row', () => {
    const { wrapper } = render(rowOf({ error: 'Three characters at least' }))
    const error = wrapper.find('.omk-row__error')
    expect(error.text()).toBe('Three characters at least')
    expect(error.attributes('role')).toBe('alert')
    expect(wrapper.find('.omk-row').find('.omk-row__error').exists()).toBe(false)
    expect(error.find('svg.omk-icon').exists()).toBe(true)
  })

  it('has no error block without an error', () => {
    expect(render(rowOf()).wrapper.find('.omk-row__error').exists()).toBe(false)
  })
})

describe('ItemRow commands', () => {
  it('sends HoverItem when the pointer moves over it', async () => {
    const { wrapper, dispatch } = render(rowOf({ id: 'alex' }))
    await wrapper.find('[role="option"]').trigger('mousemove')
    expect(dispatch).toHaveBeenCalledWith({ type: PageCommandType.HoverItem, itemId: 'alex' })
  })

  it('sends ClickItem when clicked', async () => {
    const { wrapper, dispatch } = render(rowOf({ id: 'alex' }))
    await wrapper.find('[role="option"]').trigger('click')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: PageCommandType.ClickItem, itemId: 'alex' })
  })

  it('sends one ClickItem when its toggle is clicked', async () => {
    const { wrapper, dispatch } = render(rowOf({ id: 'enabled', kind: RowKind.Toggle }))
    await wrapper.find('.omk-switch').trigger('click')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: PageCommandType.ClickItem, itemId: 'enabled' })
  })

  it('sends one StepItem and no ClickItem when a cycle arrow is clicked', async () => {
    const { wrapper, dispatch } = render(rowOf({ id: 'role', kind: RowKind.Cycle, value: 'Admin' }))
    await wrapper.findAll('.omk-cycle__arrow')[1]?.trigger('click')
    expect(dispatch.mock.calls).toEqual([[{ type: PageCommandType.StepItem, itemId: 'role', step: 1 }]])
  })

  it('sends nothing for a section', async () => {
    const { wrapper, dispatch } = render(rowOf({ kind: RowKind.Section }))
    await wrapper.trigger('click')
    await wrapper.trigger('mousemove')
    expect(dispatch).not.toHaveBeenCalled()
  })
})
