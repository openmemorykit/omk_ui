export interface CaptureSpec {
  readonly name: string
  readonly file: string
  readonly scenario: string
  readonly width: number
  readonly height: number
  readonly variant: string
  readonly scene: 'day' | 'night'
  readonly glyphs: 'xbox' | 'playStation'
  readonly side: 'left' | 'right'
  readonly accent: string | null
  readonly scale: number | null
  readonly reducedMotion: boolean
}
export const SCENARIO_IDS: readonly string[]
export function buildMatrix(): CaptureSpec[]
export function captureUrl(capture: CaptureSpec): string
