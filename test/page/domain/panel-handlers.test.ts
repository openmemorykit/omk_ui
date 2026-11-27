import { describe, expect, it } from 'vitest'
import { handleConfirmLayer } from '../../../src/page/domain/confirm-handler'
import { handleKeyboardLayer } from '../../../src/page/domain/keyboard-handler'
import { handleList } from '../../../src/page/domain/list-handler'
import * as panelHandlers from '../../../src/page/domain/panel-handlers'

describe('panel-handlers', () => {
  it('exposes the three handlers of a panel frame, each the one of its own module', () => {
    expect(Object.keys(panelHandlers).sort()).toEqual(['handleConfirmLayer', 'handleKeyboardLayer', 'handleList'])
    expect(panelHandlers.handleList).toBe(handleList)
    expect(panelHandlers.handleConfirmLayer).toBe(handleConfirmLayer)
    expect(panelHandlers.handleKeyboardLayer).toBe(handleKeyboardLayer)
  })
})
