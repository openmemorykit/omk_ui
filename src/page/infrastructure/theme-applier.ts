import type { ThemeView } from '../application/views/theme-view'
import { fontFaceCss } from '../theme/font-face'

export const FONT_STYLE_ATTRIBUTE = 'data-omk-fonts'

function fontStyleElement(doc: Document): HTMLStyleElement {
  const existing = doc.head.querySelector<HTMLStyleElement>(`style[${FONT_STYLE_ATTRIBUTE}]`)
  if (existing !== null) return existing
  const created = doc.createElement('style')
  created.setAttribute(FONT_STYLE_ATTRIBUTE, '')
  doc.head.append(created)
  return created
}

export function applyTheme(root: HTMLElement, view: ThemeView, doc: Document): void {
  Object.entries(view.cssVariables).forEach(([name, value]) => root.style.setProperty(name, value))
  root.style.setProperty('font-size', `${view.rootFontSizePx}px`)
  const style = fontStyleElement(doc)
  const css = fontFaceCss(view.fontFamily, import.meta.env.BASE_URL)
  if (style.textContent !== css) style.textContent = css
}
