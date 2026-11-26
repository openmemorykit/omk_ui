export interface SizeFile { readonly path: string; readonly data: Buffer }
export const BUDGETS: {
  readonly jsBytes: number
  readonly jsGzipBytes: number
  readonly cssBytes: number
  readonly fontBytes: number
  readonly fontFamilies: number
}
export function collectFiles(root: string): SizeFile[]
export function checkSizes(files: readonly SizeFile[]): { report: string[]; errors: string[] }
