import type { Clock, PaintProbe } from '../application/ports'
import type { RequestFrame } from './frame-requester'

export function createPaintProbe(raf: RequestFrame, now: Clock['now']): PaintProbe {
  return {
    afterPaint(callback) {
      try {
        raf(() => {
          try {
            callback(now())
          } catch {
            return
          }
        })
      } catch {
        return
      }
    },
  }
}
