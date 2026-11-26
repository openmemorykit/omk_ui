import { describe, expect, it } from 'vitest'
import { createPaintProbe } from '../../../src/page/infrastructure/paint-probe'

const START = 100
const PAINTED = 112
const FIXED = 5
const TWO_FRAMES = 2

describe('paint probe', () => {
  it('reads the clock after the next frame, not before', () => {
    const frames: FrameRequestCallback[] = []
    let time = START
    const probe = createPaintProbe((callback) => frames.push(callback), () => time)
    const painted: number[] = []
    probe.afterPaint((paintedAt) => void painted.push(paintedAt))
    expect(painted).toEqual([])
    time = PAINTED
    frames[0]?.(0)
    expect(painted).toEqual([PAINTED])
  })

  it('serves each request with its own frame', () => {
    const frames: FrameRequestCallback[] = []
    const probe = createPaintProbe((callback) => frames.push(callback), () => FIXED)
    const painted: number[] = []
    probe.afterPaint((paintedAt) => void painted.push(paintedAt))
    probe.afterPaint((paintedAt) => void painted.push(paintedAt + 1))
    expect(frames).toHaveLength(TWO_FRAMES)
    frames.forEach((frame) => frame(0))
    expect(painted).toEqual([FIXED, FIXED + 1])
  })

  it('swallows a throwing callback or a throwing frame request', () => {
    const frames: FrameRequestCallback[] = []
    const probe = createPaintProbe((callback) => frames.push(callback), () => 1)
    probe.afterPaint(() => {
      throw new Error('boom')
    })
    expect(() => frames[0]?.(0)).not.toThrow()
    const failing = createPaintProbe(() => {
      throw new Error('no frames')
    }, () => 1)
    expect(() => failing.afterPaint(() => undefined)).not.toThrow()
  })
})
