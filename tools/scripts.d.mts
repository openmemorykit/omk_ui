export interface ScriptOptions {
  readonly entryPoints: readonly string[]
  readonly outfile: string
  readonly bundle: boolean
  readonly minify: boolean
  readonly format: 'iife' | 'cjs'
  readonly platform: 'neutral' | 'node'
  readonly target: string
  readonly define: Readonly<Record<string, string>>
  readonly logLevel: 'silent'
}
export function readVersion(root: string): string
export function scriptOptions(root: string, version: string, distFolder?: string): ScriptOptions[]
export function buildScripts(root?: string, distFolder?: string): Promise<void>
