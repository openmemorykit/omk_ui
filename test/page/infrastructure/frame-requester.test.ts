import { describe, expect, it } from 'vitest'
import { createFrameRequester } from '../../../src/page/infrastructure/frame-requester'

const TWO = 2

function fakeRaf(): { raf: (callback: FrameRequestCallback) => number; frames: FrameRequestCallback[]; cancelled: number[] } {
  const frames: FrameRequestCallback[] = []
  return { raf: (callback) => frames.push(callback), frames, cancelled: [] }
}

describe('frame requester', () => {
  it('asks the browser once while a request is pending, and runs the latest callback', () => {
    const { raf, frames } = fakeRaf()
    const requester = createFrameRequester(raf)
    const ran: string[] = []
    requester.request(() => void ran.push('first'))
    requester.request(() => void ran.push('second'))
    expect(frames).toHaveLength(1)
    frames[0]?.(0)
    expect(ran).toEqual(['second'])
  })

  it('accepts a new request after the frame', () => {
    const { raf, frames } = fakeRaf()
    const requester = createFrameRequester(raf)
    let count = 0
    requester.request(() => void (count += 1))
    frames[0]?.(0)
    requester.request(() => void (count += 1))
    expect(frames).toHaveLength(TWO)
    frames[TWO - 1]?.(0)
    expect(count).toBe(TWO)
  })

  it('allows a callback to request the next frame', () => {
    const { raf, frames } = fakeRaf()
    const requester = createFrameRequester(raf)
    let count = 0
    const loop = (): void => {
      count += 1
      requester.request(loop)
    }
    requester.request(loop)
    frames[0]?.(0)
    expect(frames).toHaveLength(TWO)
    expect(count).toBe(1)
  })

  it('swallows a throwing callback and stays usable', () => {
    const { raf, frames } = fakeRaf()
    const requester = createFrameRequester(raf)
    requester.request(() => {
      throw new Error('boom')
    })
    expect(() => frames[0]?.(0)).not.toThrow()
    requester.request(() => undefined)
    expect(frames).toHaveLength(TWO)
  })

  it('stays usable when requestAnimationFrame throws', () => {
    let fail = true
    const frames: FrameRequestCallback[] = []
    const requester = createFrameRequester((callback) => {
      if (fail) throw new Error('no frames')
      return frames.push(callback)
    })
    expect(() => requester.request(() => undefined)).not.toThrow()
    fail = false
    requester.request(() => undefined)
    expect(frames).toHaveLength(1)
  })
})
