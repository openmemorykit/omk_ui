import type { TextFocus } from '../application/ports'

const TEXT_INPUT_ATTRIBUTE = 'data-text-input'

export function createTextFocus(doc: Document): TextFocus {
  return {
    focus(itemId) {
      try {
        const target = [...doc.querySelectorAll(`[${TEXT_INPUT_ATTRIBUTE}]`)].find((element) => element.getAttribute(TEXT_INPUT_ATTRIBUTE) === itemId)
        if (target instanceof HTMLElement) target.focus()
      } catch {
        return
      }
    },
  }
}
