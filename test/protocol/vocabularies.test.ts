import { describe, expect, it } from 'vitest'
import { InputSource, Intent, IntentPhase, Modality } from '../../src/protocol/intents'
import { GlyphSet, PromptState, UiMode } from '../../src/protocol/page-vocabulary'

describe('protocol vocabularies', () => {
  it('names the twelve intents of the spec', () => {
    expect(Object.values(Intent)).toStrictEqual(['up', 'down', 'left', 'right', 'confirm', 'back', 'tabNext', 'tabPrev', 'radial', 'erase', 'space', 'submit'])
  })

  it('names the phases, sources and modalities of the spec', () => {
    expect(Object.values(IntentPhase)).toStrictEqual(['press', 'release'])
    expect(Object.values(InputSource)).toStrictEqual(['keyboard', 'pointer', 'pad', 'console'])
    expect(Object.values(Modality)).toStrictEqual(['keyboardMouse', 'gamepad'])
  })

  it('names the page modes, glyph sets and prompt states', () => {
    expect(Object.values(UiMode)).toStrictEqual(['idle', 'radial', 'waiting', 'panels'])
    expect(Object.values(GlyphSet)).toStrictEqual(['xbox', 'playStation'])
    expect(Object.values(PromptState)).toStrictEqual(['holding', 'cancelled', 'completed'])
  })
})
