import type { FrameRequester, TextFocus } from '../application/ports'

const TEXT_INPUT_ATTRIBUTE = 'data-text-input'

export const TEXT_FOCUS_MAX_ATTEMPTS = 4

function tryFocus(doc: Document, itemId: string): boolean {
  try {
    const target = [...doc.querySelectorAll(`[${TEXT_INPUT_ATTRIBUTE}]`)].find((element) => element.getAttribute(TEXT_INPUT_ATTRIBUTE) === itemId)
    if (!(target instanceof HTMLElement)) return false
    target.focus()
    return true
  } catch {
    return false
  }
}

export function createTextFocus(doc: Document, frames: FrameRequester): TextFocus {
  function attempt(itemId: string, remaining: number): void {
    if (tryFocus(doc, itemId) || remaining <= 1) return
    frames.request(() => attempt(itemId, remaining - 1))
  }

  return {
    focus(itemId) {
      attempt(itemId, TEXT_FOCUS_MAX_ATTEMPTS)
    },
  }
}
