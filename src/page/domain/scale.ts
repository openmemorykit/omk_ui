export const BASE_HEIGHT = 1080
export const SCALE_FLOOR = 0.8
export const RADIAL_DIAMETER = 848
export const RADIAL_MAX_HEIGHT_SHARE = 0.9
export const COLUMN_WIDTH = 480
export const COLUMN_MAX_WIDTH_SHARE = 0.4

export function computeScale(width: number, height: number, serverScale: number): number {
  if (![width, height, serverScale].every(Number.isFinite)) return SCALE_FLOOR
  const raw = (height / BASE_HEIGHT) * serverScale
  const radialCap = (RADIAL_MAX_HEIGHT_SHARE * height) / RADIAL_DIAMETER
  const columnCap = (COLUMN_MAX_WIDTH_SHARE * width) / COLUMN_WIDTH
  return Math.max(SCALE_FLOOR, Math.min(raw, radialCap, columnCap))
}
