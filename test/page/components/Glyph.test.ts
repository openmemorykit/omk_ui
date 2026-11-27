import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Glyph from '../../../src/page/components/Glyph.vue'
import { KeyGlyph, PadGlyph } from '../../../src/page/domain/legend'
import { BINDING_GLYPH } from '../../../src/page/theme/glyph-view'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'

const SETS = Object.values(GlyphSet)
const LABEL = 'Libellé lu'
const SHELLS: ReadonlySet<string> = new Set(['omk-keycap', 'omk-pad'])

function render(glyph: string, glyphSet: GlyphSet, label: string = LABEL): VueWrapper {
  return mount(Glyph, { props: { glyph: glyph as never, glyphSet, label } })
}

describe('Glyph', () => {
  it.each(SETS.flatMap((set) => [...Object.values(KeyGlyph), ...Object.values(PadGlyph), BINDING_GLYPH].map((glyph) => [glyph, set] as const)))(
    'renders %s for %s with the received label',
    (glyph, set) => {
      const wrapper = render(glyph, set)
      expect(wrapper.attributes('aria-label')).toBe(LABEL)
      expect(wrapper.attributes('role')).toBe('img')
      expect(wrapper.classes().some((name) => SHELLS.has(name))).toBe(true)
      expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)
    },
  )

  it('draws a keyboard glyph as a keycap', () => {
    expect(render(KeyGlyph.Enter, GlyphSet.Xbox).classes()).toContain('omk-keycap')
    expect(render(KeyGlyph.Enter, GlyphSet.Xbox).classes()).not.toContain('omk-pad')
  })

  it('shows the label read in game for a binding', () => {
    expect(render(BINDING_GLYPH, GlyphSet.Xbox, 'F1').text()).toBe('F1')
  })

  it('keeps a readable fallback label for an unknown b_ binding', () => {
    expect(render(BINDING_GLYPH, GlyphSet.Xbox, 'touche liée').text()).toBe('touche liée')
  })

  it('draws arrows and the mouse instead of text', () => {
    for (const glyph of [KeyGlyph.Arrows, KeyGlyph.ArrowsHorizontal, KeyGlyph.ArrowsVertical, KeyGlyph.Mouse]) {
      const wrapper = render(glyph, GlyphSet.Xbox)
      expect(wrapper.find('svg').exists(), glyph).toBe(true)
      expect(wrapper.text(), glyph).toBe('')
    }
  })

  it('writes the face buttons as letters on Xbox', () => {
    expect(['a', 'b', 'x', 'y'].map((glyph) => render(glyph, GlyphSet.Xbox).text())).toEqual(['A', 'B', 'X', 'Y'])
  })

  it('draws the face buttons as cross, circle, square and triangle on PlayStation', () => {
    const drawn = [PadGlyph.A, PadGlyph.B, PadGlyph.X, PadGlyph.Y].map((glyph) => render(glyph, GlyphSet.PlayStation))
    for (const wrapper of drawn) {
      expect(wrapper.find('svg').exists()).toBe(true)
      expect(wrapper.text()).toBe('')
    }
    const shapes = drawn.map((wrapper) => wrapper.find('svg').html())
    expect(new Set(shapes).size).toBe(shapes.length)
  })

  it('names the shoulders by set', () => {
    expect([PadGlyph.Lb, PadGlyph.Rb].map((glyph) => render(glyph, GlyphSet.Xbox).text())).toEqual(['LB', 'RB'])
    expect([PadGlyph.Lb, PadGlyph.Rb].map((glyph) => render(glyph, GlyphSet.PlayStation).text())).toEqual(['L1', 'R1'])
  })

  it('draws the stick as a round button with its side', () => {
    const wrapper = render(PadGlyph.LeftStick, GlyphSet.Xbox)
    expect(wrapper.classes()).toContain('omk-pad--stick')
    expect(wrapper.text()).toBe('L')
  })

  it('draws a different view and create shape for each set', () => {
    const xbox = render(PadGlyph.View, GlyphSet.Xbox).find('svg').html()
    const station = render(PadGlyph.View, GlyphSet.PlayStation).find('svg').html()
    expect(xbox).not.toBe(station)
  })

  it('draws the three directional cross variants differently', () => {
    const shapes = [PadGlyph.Dpad, PadGlyph.DpadHorizontal, PadGlyph.DpadVertical].map((glyph) => render(glyph, GlyphSet.Xbox).find('svg').html())
    expect(new Set(shapes).size).toBe(shapes.length)
  })

  it('passes a muted class through to the root', () => {
    const wrapper = mount(Glyph, { props: { glyph: KeyGlyph.Enter, glyphSet: GlyphSet.Xbox, label: LABEL }, attrs: { class: 'is-muted' } })
    expect(wrapper.classes()).toContain('is-muted')
  })

  it('has no brand image, only inline shapes', () => {
    const html = render(PadGlyph.A, GlyphSet.PlayStation).html()
    expect(html).not.toContain('<img')
    expect(html).not.toContain('url(')
  })
})
