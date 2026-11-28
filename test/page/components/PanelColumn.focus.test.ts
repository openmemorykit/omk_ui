import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import PanelColumn from '../../../src/page/components/PanelColumn.vue'
import { ConfirmChoice, ConfirmOrigin, LayerKind } from '../../../src/page/domain/ui-state'
import { panelsState, pushedState, translate, withTop } from '../application/views/column-fixtures'
import { mountWithUi, type Harness } from './fixtures/ui-harness'

const COUNTER_KEY = 'ui.form.counter'
const COVER = { kind: LayerKind.Confirm, origin: ConfirmOrigin.Request, content: { title: 'T', text: 'X', confirmLabel: 'Go' }, confirmId: null, itemId: null, choice: ConfirmChoice.Cancel } as const

type State = ReturnType<typeof panelsState>

async function show(harness: Harness, state: State): Promise<void> {
  const { state: current } = harness.context
  current.value = state
  await nextTick()
}

describe('PanelColumn footer text', () => {
  it('writes the position as the locale gives it, not with a slash of its own', () => {
    const { wrapper } = mountWithUi(PanelColumn, { state: panelsState(), translate: (key, params) => (key === COUNTER_KEY ? `${String(params?.current)} of ${String(params?.total)}` : key) })
    expect(wrapper.find('.omk-foot__position').text()).toBe('1 of 5')
  })
})

describe('PanelColumn focus', () => {
  const attached: Harness[] = []
  const mountAttached = (state: State): Harness => {
    const harness = mountWithUi(PanelColumn, { state, translate, attach: true })
    attached.push(harness)
    return harness
  }

  afterEach(() => {
    while (attached.length > 0) attached.pop()?.wrapper.unmount()
  })

  it('makes the list focusable without a tab stop, and gives it the focus so that aria-activedescendant applies', () => {
    const list = mountAttached(panelsState()).wrapper.get('[role="listbox"]')
    expect(list.attributes('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(list.element)
  })

  it('gives the focus to the list of a deeper level', async () => {
    const harness = mountAttached(panelsState())
    await show(harness, pushedState(panelsState()))
    expect(document.activeElement).toBe(harness.wrapper.get('[role="listbox"]').element)
  })

  it('leaves the focus to a layer that covers the rows, and takes it back when the layer goes', async () => {
    const harness = mountAttached(withTop(panelsState(), { layers: [COVER] }))
    expect(document.activeElement).not.toBe(harness.wrapper.get('[role="listbox"]').element)
    await show(harness, panelsState())
    expect(document.activeElement).toBe(harness.wrapper.get('[role="listbox"]').element)
  })
})
