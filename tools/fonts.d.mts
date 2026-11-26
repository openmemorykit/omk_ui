export interface FontFamilyFiles {
  readonly cssName: string
  readonly package: string
  readonly weights: Readonly<Record<string, string>>
}
export interface CopyResult {
  readonly copied: string[]
  readonly missing: string[]
}
export function licenseName(packageName: string): string
export function copyFonts(manifest: Readonly<Record<string, FontFamilyFiles>>, sourceRoot: string, targetDir: string): CopyResult
