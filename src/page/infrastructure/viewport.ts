import type { Viewport, ViewportSize } from '../application/ports'

function deliver(listener: (size: ViewportSize) => void, size: ViewportSize): void {
  try {
    listener(size)
  } catch {
    return
  }
}

export function createWindowViewport(target: Window): Viewport {
  const read = (): ViewportSize => ({ width: target.innerWidth, height: target.innerHeight })
  return {
    read,
    listen(listener) {
      const onResize = (): void => deliver(listener, read())
      target.addEventListener('resize', onResize)
      return () => target.removeEventListener('resize', onResize)
    },
  }
}

export function createElementViewport(element: Element): Viewport {
  return {
    read: () => ({ width: element.clientWidth, height: element.clientHeight }),
    listen(listener) {
      if (typeof ResizeObserver === 'undefined') return () => undefined
      const observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1]
        if (entry !== undefined) deliver(listener, { width: entry.contentRect.width, height: entry.contentRect.height })
      })
      observer.observe(element)
      return () => observer.disconnect()
    },
  }
}
