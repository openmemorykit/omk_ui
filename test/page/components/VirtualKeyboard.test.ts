import { mount, type VueWrapper } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'
import { keyboardView, type KeyboardView } from '../../../src/page/application/views/keyboard-view'
import VirtualKeyboard from '../../../src/page/components/VirtualKeyboard.vue'
import { UI_CONTEXT, type UiContext } from '../../../src/page/components/use-ui'
import { KeyAction, KeyboardLanguage, KeyboardLayer } from '../../../src/page/domain/keyboard-layouts'
import { PageCommandType, type UiCommand } from '../../../src/page/domain/page-commands'
import { LayerKind, createInitialState } from '../../../src/page/domain/ui-state'
import { openKeyboard, type KeyboardState } from '../../../src/page/domain/virtual-keyboard'
import { translate } from '../application/views/column-fixtures'

const LIMIT = 40
const ITEM = 'note'
const SPACE_ROW = 3
const SPACE_UNIT = 3
const SPACE_INDEX = 2

function viewOf(change: Partial<KeyboardState> = {}): KeyboardView {
  const keyboard = { ...openKeyboard(KeyboardLanguage.French, '', LIMIT), ...change }
  return keyboardView({ kind: LayerKind.Keyboard, itemId: ITEM, initialValue: '', keyboard }, KeyboardLanguage.French, translate)
}

function render(view: KeyboardView, title?: string): { wrapper: VueWrapper; sent: UiCommand[] } {
  const sent: UiCommand[] = []
  const context: UiContext = {
    state: shallowRef(createInitialState()),
    dispatch: (command) => void sent.push(command),
    translate,
    viewport: shallowRef({ width: 1920, height: 1080 }),
  }
  const wrapper = mount(VirtualKeyboard, { props: { view, ...(title === undefined ? {} : { title }) }, global: { provide: { [UI_CONTEXT as symbol]: context } }, attachTo: document.body })
  sent.length = 0
  return { wrapper, sent }
}

function inputOf(wrapper: VueWrapper): HTMLInputElement {
  return wrapper.get('input').element
}

function typeInto(wrapper: VueWrapper, value: string, isComposing: boolean): void {
  const element = inputOf(wrapper)
  element.value = value
  element.dispatchEvent(new InputEvent('input', { isComposing, bubbles: true }))
}

describe('VirtualKeyboard', () => {
  it('is a dialog named keyboard', () => {
    const { wrapper } = render(viewOf())
    expect(wrapper.attributes('role')).toBe('dialog')
    expect(wrapper.attributes('data-surface')).toBe('keyboard')
  })

  it('renders a real input bound to the item and the limit', () => {
    const { wrapper } = render(viewOf({ value: 'ab' }))
    const input = inputOf(wrapper)
    expect(input.value).toBe('ab')
    expect(input.maxLength).toBe(LIMIT)
    expect(input.dataset['textInput']).toBe(ITEM)
  })

  it('focuses the input on mount', () => {
    const { wrapper } = render(viewOf())
    expect(document.activeElement).toBe(inputOf(wrapper))
    wrapper.unmount()
  })

  it('reports the focus of the input as TextInputFocused', async () => {
    const { wrapper, sent } = render(viewOf())
    await wrapper.get('input').trigger('focus')
    expect(sent).toContainEqual({ type: PageCommandType.TextInputFocused, itemId: ITEM })
  })

  it.each([KeyboardLayer.Letters, KeyboardLayer.AccentsDigits, KeyboardLayer.Symbols])('renders the %s layer with four rows', (layer) => {
    const { wrapper } = render(viewOf({ layer }))
    expect(wrapper.findAll('[data-key-row]')).toHaveLength(SPACE_ROW + 1)
    expect(wrapper.text()).toContain(viewOf({ layer }).layerName)
  })

  it('writes letters in capitals with shift and marks the shift key active', () => {
    const { wrapper } = render(viewOf({ shift: true }))
    expect(wrapper.findAll('.omk-key').map((key) => key.text())).toContain('A')
    expect(wrapper.findAll('.omk-key.is-active')).toHaveLength(1)
  })

  it('marks only the focused key', () => {
    const { wrapper } = render(viewOf({ row: SPACE_ROW, unit: SPACE_UNIT }))
    const focused = wrapper.findAll('.omk-key.is-focused')
    expect(focused).toHaveLength(1)
    expect(focused[0]?.attributes('aria-label')).toBe(viewOf().rows[SPACE_ROW]?.find((key) => key.action === KeyAction.Space)?.accessibleLabel)
  })

  it('shows the counter and warns at the limit', () => {
    const calm = render(viewOf({ value: 'abc' })).wrapper
    expect(calm.get('[data-counter]').text()).toBe('3 / 40')
    expect(calm.find('.is-limit').exists()).toBe(false)
    const full = render(viewOf({ value: 'a'.repeat(LIMIT) })).wrapper
    expect(full.get('[data-counter]').classes()).toContain('is-limit')
  })

  it('shows the title only when given', () => {
    expect(render(viewOf(), 'Note du staff').wrapper.get('.omk-layer-title').text()).toBe('Note du staff')
    expect(render(viewOf()).wrapper.find('.omk-layer-title').exists()).toBe(false)
  })

  it('sends the whole value on input', () => {
    const { wrapper, sent } = render(viewOf({ value: 'ab' }))
    typeInto(wrapper, 'abc', false)
    expect(sent).toContainEqual({ type: PageCommandType.TypeText, value: 'abc' })
  })

  it('ignores input during composition and sends the result at compositionend', () => {
    const { wrapper, sent } = render(viewOf())
    typeInto(wrapper, '^', true)
    expect(sent).toEqual([])
    typeInto(wrapper, 'ê', true)
    expect(sent).toEqual([])
    inputOf(wrapper).dispatchEvent(new CompositionEvent('compositionend', { data: 'ê', bubbles: true }))
    expect(sent).toEqual([{ type: PageCommandType.TypeText, value: 'ê' }])
  })

  it('sends the whole field at compositionend when it already holds text', () => {
    const { wrapper, sent } = render(viewOf({ value: 'ab' }))
    typeInto(wrapper, 'abê', true)
    inputOf(wrapper).dispatchEvent(new CompositionEvent('compositionend', { data: 'ê', bubbles: true }))
    expect(sent).toEqual([{ type: PageCommandType.TypeText, value: 'abê' }])
  })

  it('puts the field back to the domain value when the domain refuses the text', async () => {
    const { wrapper } = render(viewOf({ value: 'ab' }))
    typeInto(wrapper, 'abc', false)
    await wrapper.vm.$nextTick()
    expect(inputOf(wrapper).value).toBe('ab')
  })

  it('moves the cursor to the end after a render from the pad', async () => {
    const { wrapper } = render(viewOf({ value: 'ab' }))
    inputOf(wrapper).value = 'abcd'
    inputOf(wrapper).setSelectionRange(0, 0)
    await wrapper.setProps({ view: viewOf({ value: 'abcd' }) })
    await wrapper.vm.$nextTick()
    const input = inputOf(wrapper)
    expect(input.value).toBe('abcd')
    expect(input.selectionStart).toBe('abcd'.length)
    expect(input.selectionEnd).toBe('abcd'.length)
  })

  it('sends ClickKey with the coordinates of the clicked key', async () => {
    const { wrapper, sent } = render(viewOf())
    const rows = wrapper.findAll('[data-key-row]')
    const bottom = rows[SPACE_ROW]?.findAll('.omk-key') ?? []
    await bottom[SPACE_INDEX]?.trigger('click')
    const expected = viewOf().rows[SPACE_ROW]?.[SPACE_INDEX]
    expect(sent).toEqual([{ type: PageCommandType.ClickKey, row: SPACE_ROW, unit: expected?.unit }])
  })

  it('keeps the focus in the field when a key is pressed', () => {
    const { wrapper } = render(viewOf())
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    wrapper.get('.omk-key').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
