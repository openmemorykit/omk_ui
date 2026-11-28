import { mount, type VueWrapper } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'
import { confirmView, type ConfirmView } from '../../../src/page/application/views/confirm-view'
import ConfirmLayer from '../../../src/page/components/ConfirmLayer.vue'
import { UI_CONTEXT, type UiContext } from '../../../src/page/components/use-ui'
import { PageCommandType, type UiCommand } from '../../../src/page/domain/page-commands'
import { ConfirmChoice, ConfirmOrigin, LayerKind, createInitialState, type ConfirmLayer as ConfirmState } from '../../../src/page/domain/ui-state'
import { translate } from '../application/views/column-fixtures'

function viewOf(change: Partial<ConfirmState['content']> = {}, choice: ConfirmChoice = ConfirmChoice.Confirm): ConfirmView {
  const layer: ConfirmState = {
    kind: LayerKind.Confirm,
    origin: ConfirmOrigin.Request,
    content: { title: 'Refuser le dossier', text: 'Le dossier sera refusé.', confirmLabel: 'Refuser', cancelLabel: 'Garder', ...change },
    confirmId: 'whitelist/refuse',
    itemId: null,
    choice,
  }
  return confirmView(layer, translate)
}

function render(view: ConfirmView): { wrapper: VueWrapper; sent: UiCommand[] } {
  const sent: UiCommand[] = []
  const context: UiContext = {
    state: shallowRef(createInitialState()),
    dispatch: (command) => void sent.push(command),
    translate,
    viewport: shallowRef({ width: 1920, height: 1080 }),
  }
  return { wrapper: mount(ConfirmLayer, { props: { view }, global: { provide: { [UI_CONTEXT as symbol]: context } } }), sent }
}

describe('ConfirmLayer', () => {
  it('is a dialog named confirm, labelled by its title', () => {
    const { wrapper } = render(viewOf())
    expect(wrapper.attributes('role')).toBe('dialog')
    expect(wrapper.attributes('data-surface')).toBe('confirm')
    expect(wrapper.attributes('aria-modal')).toBe('true')
    expect(wrapper.text()).toContain('Refuser le dossier')
    expect(wrapper.text()).toContain('Le dossier sera refusé.')
  })

  it('does not need a column parent', () => {
    expect(() => render(viewOf())).not.toThrow()
  })

  it('renders a normal confirmation with the confirm choice focused', () => {
    const { wrapper } = render(viewOf())
    const rows = wrapper.findAll('.omk-row')
    expect(rows.map((row) => row.text())).toEqual(['Refuser', 'Garder'])
    expect(rows.map((row) => row.classes().includes('is-focused'))).toEqual([true, false])
    expect(wrapper.find('.omk-row--danger').exists()).toBe(false)
    expect(wrapper.find('.layer-head--danger').exists()).toBe(false)
  })

  it('renders the danger variant with the cancel choice focused', () => {
    const { wrapper } = render(viewOf({ danger: true }, ConfirmChoice.Cancel))
    expect(wrapper.find('.layer-head--danger').exists()).toBe(true)
    const rows = wrapper.findAll('.omk-row')
    expect(rows[0]?.classes()).toContain('omk-row--danger')
    expect(rows[1]?.classes()).not.toContain('omk-row--danger')
    expect(rows.map((row) => row.classes().includes('is-focused'))).toEqual([false, true])
  })

  it('hovers a choice by its identifier when the pointer moves over it', async () => {
    const { wrapper, sent } = render(viewOf())
    await wrapper.findAll('.omk-row')[1]?.trigger('mousemove')
    expect(sent).toEqual([{ type: PageCommandType.HoverItem, itemId: ConfirmChoice.Cancel }])
  })

  it('does not move the choice when a layer opens under a pointer that stays still', async () => {
    const { wrapper, sent } = render(viewOf({ danger: true }, ConfirmChoice.Cancel))
    await wrapper.findAll('.omk-row')[0]?.trigger('mouseenter')
    expect(sent).toEqual([])
  })

  it('is named by its title attribute and described by its text', () => {
    const { wrapper } = render(viewOf())
    expect(wrapper.attributes('aria-label')).toBe('Refuser le dossier')
    const describedBy = wrapper.attributes('aria-describedby') ?? ''
    expect(describedBy).not.toBe('')
    expect(wrapper.get(`#${describedBy}`).text()).toBe('Le dossier sera refusé.')
  })

  it('groups the choices as buttons, not as a list holding buttons', () => {
    const { wrapper } = render(viewOf())
    expect(wrapper.find('ul, li').exists()).toBe(false)
    expect(wrapper.get('.omk-confirm__choices').attributes('role')).toBe('group')
    expect(wrapper.findAll('.omk-row').map((row) => row.attributes('role'))).toEqual(['button', 'button'])
  })

  it('clicks a choice by its identifier', async () => {
    const { wrapper, sent } = render(viewOf())
    await wrapper.findAll('.omk-row')[0]?.trigger('click')
    expect(sent).toEqual([{ type: PageCommandType.ClickItem, itemId: ConfirmChoice.Confirm }])
  })
})
