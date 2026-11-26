import { beforeEach, describe, expect, it } from 'vitest'
import { themeView } from '../../../src/page/application/views/theme-view'
import { applyTheme, FONT_STYLE_ATTRIBUTE } from '../../../src/page/infrastructure/theme-applier'
import { FontFamily, THEME_DEFAULTS } from '../../../src/shared/config/theme-defaults'

const FULL_HD = { width: 1920, height: 1080 }
const SMALL = { width: 1280, height: 720 }

let root: HTMLElement

function fontRules(): string[] {
  return [...document.head.querySelectorAll(`style[${FONT_STYLE_ATTRIBUTE}]`)].map((element) => element.textContent)
}

beforeEach(() => {
  document.head.replaceChildren()
  root = document.createElement('div')
})

describe('applyTheme', () => {
  it('sets every CSS variable of the theme view on the root', () => {
    const view = themeView({ ...THEME_DEFAULTS, accent: '#3DDC97' }, FULL_HD)
    applyTheme(root, view, document)
    Object.entries(view.cssVariables).forEach(([name, value]) => expect(root.style.getPropertyValue(name)).toBe(value))
  })

  it('sets the root font size from the scale', () => {
    applyTheme(root, themeView(THEME_DEFAULTS, FULL_HD), document)
    expect(root.style.fontSize).toBe('16px')
    applyTheme(root, themeView(THEME_DEFAULTS, SMALL), document)
    expect(root.style.fontSize).toBe('12.8px')
  })

  it('declares only the font face of the chosen family', () => {
    applyTheme(root, themeView({ ...THEME_DEFAULTS, font: FontFamily.ArchivoNarrow }, FULL_HD), document)
    const [rule, ...others] = fontRules()
    expect(others).toEqual([])
    expect(rule).toContain("font-family: 'Archivo Narrow'")
    expect(rule).not.toContain('Sofia Sans')
    expect(rule).toContain('fonts/archivo-narrow-latin-700-normal.woff2')
  })

  it('replaces the font face when the family changes, without piling up rules', () => {
    applyTheme(root, themeView({ ...THEME_DEFAULTS, font: FontFamily.ArchivoNarrow }, FULL_HD), document)
    applyTheme(root, themeView({ ...THEME_DEFAULTS, font: FontFamily.SofiaSansSemiCondensed }, FULL_HD), document)
    const rules = fontRules()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toContain('Sofia Sans Semi Condensed')
    expect(rules[0]).not.toContain('Archivo')
  })

  it('leaves the font face alone when only the size changes', () => {
    applyTheme(root, themeView(THEME_DEFAULTS, FULL_HD), document)
    const element = document.head.querySelector(`style[${FONT_STYLE_ATTRIBUTE}]`)
    applyTheme(root, themeView(THEME_DEFAULTS, SMALL), document)
    expect(document.head.querySelector(`style[${FONT_STYLE_ATTRIBUTE}]`)).toBe(element)
  })

  it('does not touch the document outside the font style element', () => {
    applyTheme(root, themeView(THEME_DEFAULTS, FULL_HD), document)
    expect(document.head.children).toHaveLength(1)
    expect(document.documentElement.getAttribute('style')).toBeNull()
  })
})
