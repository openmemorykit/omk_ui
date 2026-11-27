import { beforeEach, describe, expect, it } from 'vitest'
import { AnnounceUrgency } from '../../../src/page/application/ports'
import { ANNOUNCEMENT_MAX_UNITS, createLiveAnnouncer } from '../../../src/page/infrastructure/live-announcer'

const LONG_TEXT_UNITS = 5000

describe('live announcer', () => {
  let polite: HTMLElement
  let assertive: HTMLElement

  beforeEach(() => {
    polite = document.createElement('div')
    assertive = document.createElement('div')
  })

  it('writes a polite announcement in the polite region only', () => {
    createLiveAnnouncer(polite, assertive).announce('Panel opened', AnnounceUrgency.Polite)
    expect(polite.textContent).toBe('Panel opened')
    expect(assertive.textContent).toBe('')
  })

  it('writes an assertive announcement in the assertive region only', () => {
    createLiveAnnouncer(polite, assertive).announce('Name is required', AnnounceUrgency.Assertive)
    expect(assertive.textContent).toBe('Name is required')
    expect(polite.textContent).toBe('')
  })

  it('replaces the previous text, and lets the same text be announced again', () => {
    const announcer = createLiveAnnouncer(polite, assertive)
    announcer.announce('One', AnnounceUrgency.Polite)
    announcer.announce('Two', AnnounceUrgency.Polite)
    expect(polite.textContent).toBe('Two')
    const mutations: string[] = []
    new MutationObserver(() => void mutations.push(polite.textContent ?? '')).observe(polite, { childList: true, characterData: true, subtree: true })
    announcer.announce('Two', AnnounceUrgency.Polite)
    expect(polite.textContent).not.toBe('')
  })

  it('bounds the length of an announcement', () => {
    createLiveAnnouncer(polite, assertive).announce('x'.repeat(LONG_TEXT_UNITS), AnnounceUrgency.Polite)
    expect((polite.textContent ?? '').length).toBeLessThanOrEqual(ANNOUNCEMENT_MAX_UNITS)
    expect((polite.textContent ?? '').length).toBeGreaterThan(0)
  })
})
