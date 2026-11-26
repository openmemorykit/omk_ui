import { afterEach, describe, expect, it } from 'vitest'
import { createTextFocus } from '../../../src/page/infrastructure/text-focus'

function addInput(itemId: string): HTMLInputElement {
  const input = document.createElement('input')
  input.setAttribute('data-text-input', itemId)
  document.body.append(input)
  return input
}

describe('text focus', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('focuses the input of the item', () => {
    const first = addInput('first')
    const second = addInput('second')
    createTextFocus(document).focus('second')
    expect(document.activeElement).toBe(second)
    expect(document.activeElement).not.toBe(first)
  })

  it('finds an identifier that contains quotes and brackets', () => {
    const odd = addInput('a"]b[c')
    createTextFocus(document).focus('a"]b[c')
    expect(document.activeElement).toBe(odd)
  })

  it('does nothing for an unknown item', () => {
    const input = addInput('known')
    createTextFocus(document).focus('missing')
    expect(document.activeElement).not.toBe(input)
  })

  it('does not throw when the document fails', () => {
    const broken = { querySelectorAll: () => { throw new Error('boom') } } as unknown as Document
    expect(() => createTextFocus(broken).focus('x')).not.toThrow()
  })
})
