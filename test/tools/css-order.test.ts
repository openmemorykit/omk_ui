import { resolve } from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const PREVIEW_MODE = 'preview'
const BUILD_TIMEOUT_MS = 60_000

interface Emitted { readonly fileName: string; readonly type: string; readonly source?: string | Uint8Array }

async function builtCss(mode: string): Promise<string> {
  const result = await build({ configFile: resolve('vite.config.ts'), mode, logLevel: 'silent', build: { write: false } })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => ('output' in entry ? entry.output : []))
  return (outputs as readonly Emitted[])
    .filter((file) => file.type === 'asset' && file.fileName.endsWith('.css'))
    .map((file) => String(file.source))
    .join('')
}

function at(css: string, marker: string): number {
  const index = css.indexOf(marker)
  expect(index, `${marker} is in the built css`).toBeGreaterThanOrEqual(0)
  return index
}

describe.each([['production', 'production'], ['preview', PREVIEW_MODE]])('built css order (%s)', (_name, mode) => {
  it('puts the tokens, then the base, before every component rule', async () => {
    const css = await builtCss(mode)
    const tokens = at(css, '--panel-deep-rgb:')
    const base = at(css, '[data-surface]{')
    const componentRules = ['.omk-prompt{', '.omk-radial__ring{', '.omk-radial__center{', '.omk-row__value--warning{', '.omk-column[data-surface]{']
    expect(tokens).toBeLessThan(base)
    componentRules.forEach((rule) => expect(css.lastIndexOf(rule), rule).toBeGreaterThan(base))
  }, BUILD_TIMEOUT_MS)
})
