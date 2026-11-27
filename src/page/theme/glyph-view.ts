import type { ValueOf } from '@openmemorykit/core/shared'
import { GlyphSet } from '../../protocol/page-vocabulary'
import { KeyGlyph, PadGlyph } from '../domain/legend'

export const BINDING_GLYPH = 'binding'

export type GlyphName = ValueOf<typeof KeyGlyph> | ValueOf<typeof PadGlyph> | typeof BINDING_GLYPH

export interface GlyphView {
  readonly classes: readonly string[]
  readonly text: string
  readonly paths: readonly string[]
}

const KEYCAP = 'omk-keycap'
const PAD = 'omk-pad'
const FACE = 'omk-pad--face'
const SHOULDER = 'omk-pad--shoulder'
const MENU = 'omk-pad--menu'
const STICK = 'omk-pad--stick'

const DPAD_OUTLINE = 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'

const KEY_SHAPES = new Map<GlyphName, readonly string[]>([
  [KeyGlyph.ArrowsVertical, ['M12 3v18', 'm8 7 4-4 4 4', 'm8 17 4 4 4-4']],
  [KeyGlyph.ArrowsHorizontal, ['M3 12h18', 'm7 8-4 4 4 4', 'm17 8 4 4-4 4']],
  [KeyGlyph.Arrows, ['M12 3v18', 'M3 12h18', 'm9 6 3-3 3 3', 'm9 18 3 3 3-3', 'm6 9-3 3 3 3', 'm18 9 3 3-3 3']],
  [KeyGlyph.Mouse, ['M12 3a5 5 0 0 0-5 5v8a5 5 0 0 0 10 0V8a5 5 0 0 0-5-5z', 'M12 3v6']],
])

const PAD_SHAPES = new Map<GlyphName, readonly string[]>([
  [PadGlyph.Dpad, [DPAD_OUTLINE]],
  [PadGlyph.DpadHorizontal, [DPAD_OUTLINE, 'M6 12h12']],
  [PadGlyph.DpadVertical, [DPAD_OUTLINE, 'M12 6v12']],
  [PadGlyph.Menu, ['M5 8h14', 'M5 12h14', 'M5 16h14']],
])

const VIEW_SHAPES = new Map<GlyphSet, readonly string[]>([
  [GlyphSet.Xbox, ['M4 9h11v9H4z', 'M9 6h11v9']],
  [GlyphSet.PlayStation, ['M12 16V5', 'm8 9 4-4 4 4', 'M5 19h14']],
])

const FACE_SHAPES = new Map<GlyphName, readonly string[]>([
  [PadGlyph.A, ['m7 7 10 10', 'm17 7-10 10']],
  [PadGlyph.B, ['M5 12a7 7 0 1 0 14 0a7 7 0 1 0-14 0']],
  [PadGlyph.X, ['M6 6h12v12H6z']],
  [PadGlyph.Y, ['M12 5l8 14H4z']],
])

const FACE_LETTERS = new Map<GlyphName, string>([
  [PadGlyph.A, 'A'],
  [PadGlyph.B, 'B'],
  [PadGlyph.X, 'X'],
  [PadGlyph.Y, 'Y'],
])

const SHOULDER_NAMES = new Map<GlyphSet, ReadonlyMap<GlyphName, string>>([
  [GlyphSet.Xbox, new Map<GlyphName, string>([[PadGlyph.Lb, 'LB'], [PadGlyph.Rb, 'RB']])],
  [GlyphSet.PlayStation, new Map<GlyphName, string>([[PadGlyph.Lb, 'L1'], [PadGlyph.Rb, 'R1']])],
])

const PAD_NAMES: ReadonlySet<GlyphName> = new Set(Object.values(PadGlyph))
const SHAPELESS: readonly string[] = []

function drawn(classes: readonly string[], paths: readonly string[]): GlyphView {
  return { classes, text: '', paths }
}

function written(classes: readonly string[], text: string): GlyphView {
  return { classes, text, paths: SHAPELESS }
}

function padView(glyph: GlyphName, glyphSet: GlyphSet): GlyphView {
  if (glyph === PadGlyph.LeftStick) return written([PAD, STICK], 'L')
  if (glyph === PadGlyph.View) return drawn([PAD, MENU], VIEW_SHAPES.get(glyphSet) ?? SHAPELESS)
  const letter = FACE_LETTERS.get(glyph)
  if (letter !== undefined) {
    return glyphSet === GlyphSet.PlayStation ? drawn([PAD, FACE], FACE_SHAPES.get(glyph) ?? SHAPELESS) : written([PAD, FACE], letter)
  }
  const shoulder = SHOULDER_NAMES.get(glyphSet)?.get(glyph)
  if (shoulder !== undefined) return written([PAD, SHOULDER], shoulder)
  return drawn(glyph === PadGlyph.Menu ? [PAD, MENU] : [PAD], PAD_SHAPES.get(glyph) ?? SHAPELESS)
}

export function glyphView(glyph: GlyphName, glyphSet: GlyphSet, label: string): GlyphView {
  if (PAD_NAMES.has(glyph)) return padView(glyph, glyphSet)
  const shape = KEY_SHAPES.get(glyph)
  return shape === undefined ? written([KEYCAP], label) : drawn([KEYCAP], shape)
}
