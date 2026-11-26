import { listOf } from '@openmemorykit/ui/contract'
import * as v from 'valibot'
import { CameraViewMode, SKIPPABLE_CAMERA_MODES } from './camera-view-mode'
import { contrastRatio } from './contrast'
import { FontFamily, PANEL_BACKGROUND, PanelSide, THEME_DEFAULTS } from './theme-defaults'

export { FontFamily, PANEL_BACKGROUND, PanelSide, THEME_DEFAULTS }
export const MIN_FOCUS_CONTRAST = 3

const ACCENT_LENGTH = 7
const LOGO_MAX_LENGTH = 69
const MIN_SCALE = 0.9
const MAX_SCALE = 1.1
const MONOGRAM_MAX_UNITS = 2
const MIN_PAD_HOLD_MS = 200
const MAX_PAD_HOLD_MS = 800
const MAX_VEHICLE_SPEED_LIMIT = 200
const MAX_SKIPPED_MODES = 4
const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/
const LOGO_PATTERN = /^[a-z0-9_-]{1,64}\.(png|webp)$/

const EMPTY_MODES: readonly CameraViewMode[] = Object.freeze([])

export const INPUT_DEFAULTS = Object.freeze({
  padHoldMs: 300,
  padHoldGesture: true,
  vehicleSpeedLimit: 10,
  cameraSkippedModes: EMPTY_MODES,
})
export const TRACE_DEFAULTS = Object.freeze({ onStart: false })

const AccentSchema = v.pipe(
  v.string(),
  v.length(ACCENT_LENGTH),
  v.regex(ACCENT_PATTERN),
  v.check((accent) => contrastRatio(accent, PANEL_BACKGROUND) >= MIN_FOCUS_CONTRAST),
)
const LogoSchema = v.pipe(v.string(), v.maxLength(LOGO_MAX_LENGTH), v.regex(LOGO_PATTERN))
const SkippedModesSchema = v.pipe(
  listOf(v.picklist(SKIPPABLE_CAMERA_MODES), MAX_SKIPPED_MODES),
  v.check((modes) => new Set(modes).size === modes.length),
)

export const THEME_FIELDS = {
  accent: v.optional(AccentSchema, THEME_DEFAULTS.accent),
  side: v.optional(v.picklist(Object.values(PanelSide)), THEME_DEFAULTS.side),
  scale: v.optional(v.pipe(v.number(), v.finite(), v.minValue(MIN_SCALE), v.maxValue(MAX_SCALE)), THEME_DEFAULTS.scale),
  font: v.optional(v.picklist(Object.values(FontFamily)), THEME_DEFAULTS.font),
  logo: v.optional(v.nullable(LogoSchema), THEME_DEFAULTS.logo),
  monogram: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(MONOGRAM_MAX_UNITS)), THEME_DEFAULTS.monogram),
}
export const INPUT_FIELDS = {
  padHoldMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(MIN_PAD_HOLD_MS), v.maxValue(MAX_PAD_HOLD_MS)), INPUT_DEFAULTS.padHoldMs),
  padHoldGesture: v.optional(v.boolean(), INPUT_DEFAULTS.padHoldGesture),
  vehicleSpeedLimit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_VEHICLE_SPEED_LIMIT)), INPUT_DEFAULTS.vehicleSpeedLimit),
  cameraSkippedModes: v.optional(SkippedModesSchema, INPUT_DEFAULTS.cameraSkippedModes),
}
export const TRACE_FIELDS = { onStart: v.optional(v.boolean(), TRACE_DEFAULTS.onStart) }

export const ThemeConfigSchema = v.object(THEME_FIELDS)
export const InputConfigSchema = v.object(INPUT_FIELDS)
export const TraceConfigSchema = v.object(TRACE_FIELDS)
export type ThemeConfig = v.InferOutput<typeof ThemeConfigSchema>
export type InputConfig = v.InferOutput<typeof InputConfigSchema>
export type TraceConfig = v.InferOutput<typeof TraceConfigSchema>

export interface KitConfig {
  readonly theme: ThemeConfig
  readonly input: InputConfig
  readonly trace: TraceConfig
}

export const DEFAULT_CONFIG: KitConfig = Object.freeze({ theme: THEME_DEFAULTS, input: INPUT_DEFAULTS, trace: TRACE_DEFAULTS })

export { CameraViewMode }
