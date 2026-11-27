import { afterEach, describe, expect, it } from 'vitest'
import type { FrameRequester } from '../../../src/page/application/ports'
import { createTextFocus, TEXT_FOCUS_MAX_ATTEMPTS } from '../../../src/page/infrastructure/text-focus'

function addInput(itemId: string): HTMLInputElement {
  const input = document.createElement('input')
  input.setAttribute('data-text-input', itemId)
  document.body.append(input)
  return input
}

interface ManualFrames extends FrameRequester {
  readonly pending: () => number
  readonly flush: () => void
}

function manualFrames(): ManualFrames {
  let callback: (() => void) | null = null
  return {
    request(next) {
      callback = next
    },
    pending: () => (callback === null ? 0 : 1),
    flush() {
      const run = callback
      callback = null
      run?.()
    },
  }
}

describe('text focus', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('focuses the input of the item', () => {
    const first = addInput('first')
    const second = addInput('second')
    createTextFocus(document, manualFrames()).focus('second')
    expect(document.activeElement).toBe(second)
    expect(document.activeElement).not.toBe(first)
  })

  it('finds an identifier that contains quotes and brackets', () => {
    const odd = addInput('a"]b[c')
    createTextFocus(document, manualFrames()).focus('a"]b[c')
    expect(document.activeElement).toBe(odd)
  })

  it('does nothing for an unknown item', () => {
    const input = addInput('known')
    createTextFocus(document, manualFrames()).focus('missing')
    expect(document.activeElement).not.toBe(input)
  })

  it('does not throw when the document fails', () => {
    const broken = { querySelectorAll: () => { throw new Error('boom') } } as unknown as Document
    expect(() => createTextFocus(broken, manualFrames()).focus('x')).not.toThrow()
  })

  it('focuses an input that renders after the effect, on a later frame', () => {
    const frames = manualFrames()
    createTextFocus(document, frames).focus('late')
    expect(frames.pending()).toBe(1)
    const late = addInput('late')
    frames.flush()
    expect(document.activeElement).toBe(late)
    expect(frames.pending()).toBe(0)
  })

  it('gives up after a bounded number of frames when the input never appears', () => {
    const frames = manualFrames()
    createTextFocus(document, frames).focus('never')
    let flushed = 0
    while (frames.pending() === 1 && flushed < TEXT_FOCUS_MAX_ATTEMPTS + TEXT_FOCUS_MAX_ATTEMPTS) {
      frames.flush()
      flushed += 1
    }
    expect(flushed).toBe(TEXT_FOCUS_MAX_ATTEMPTS - 1)
  })

  it('does not throw when the document fails on a later frame', () => {
    const frames = manualFrames()
    let broken = false
    const doc = { querySelectorAll: () => { if (broken) throw new Error('boom'); return [] } } as unknown as Document
    createTextFocus(doc, frames).focus('x')
    broken = true
    expect(() => frames.flush()).not.toThrow()
  })
})
