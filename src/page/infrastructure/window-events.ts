import { PageCommandType } from '../domain/page-commands'
import type { Dispatch } from '../application/ports'

export type Detach = () => void

export function createWindowEvents(target: Window, dispatch: Dispatch): Detach {
  const onBlur = (): void => dispatch({ type: PageCommandType.WindowBlurred })
  const onFocus = (): void => dispatch({ type: PageCommandType.WindowFocused })
  target.addEventListener('blur', onBlur)
  target.addEventListener('focus', onFocus)
  return () => {
    target.removeEventListener('blur', onBlur)
    target.removeEventListener('focus', onFocus)
  }
}
