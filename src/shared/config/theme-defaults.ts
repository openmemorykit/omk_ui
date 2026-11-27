export const PanelSide = { Left: 'left', Right: 'right' } as const
export const FontFamily = { SofiaSansSemiCondensed: 'sofiaSansSemiCondensed', ArchivoNarrow: 'archivoNarrow' } as const
export const PANEL_BACKGROUND = '#0C0B13'

export const THEME_DEFAULTS = Object.freeze({
  accent: '#8F7BFF',
  side: PanelSide.Left,
  scale: 1,
  font: FontFamily.SofiaSansSemiCondensed,
  logo: null as string | null,
  monogram: 'O',
})
