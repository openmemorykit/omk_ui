import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanCss, stripCss } from '../../tools/css-guard.mjs'

const forbidden: readonly (readonly [string, string])[] = [
  [':has(', '.a:has(.b){color:red}'],
  ['color-mix(', '.a{color:color-mix(in srgb,red,blue)}'],
  ['@container', '@container (min-width:10px){.a{color:red}}'],
  ['backdrop-filter', '.a{backdrop-filter:none}'],
  ['blur(', '.a{filter:blur(2px)}'],
  ['dvh', '.a{height:100dvh}'],
  ['svh', '.a{height:50.5svh}'],
  ['lvh', '.a{height:10lvh}'],
  ['text-wrap: balance', '.a{text-wrap:balance}'],
  ['translate', '.a{translate:1px 2px}'],
  ['rotate', '.a{color:red;rotate:10deg}'],
  ['scale', '.a{scale:1.1}'],
  ['sin(', '.a{width:calc(sin(1rad)*1px)}'],
  ['cos(', '.a{width:calc(cos(1rad)*1px)}'],
  ['tan(', '.a{width:calc(tan(1rad)*1px)}'],
  ['asin(', '.a{width:calc(asin(1)*1px)}'],
  ['acos(', '.a{width:calc(acos(1)*1px)}'],
  ['atan(', '.a{width:calc(atan(1)*1px)}'],
  ['atan2(', '.a{width:calc(atan2(1,1)*1px)}'],
  ['linear(', '.a{transition-timing-function:linear(0,1)}'],
  ['oklch(', '.a{color:oklch(0.5 0.1 20)}'],
  ['oklab(', '.a{color:oklab(0.5 0.1 0.1)}'],
  ['@starting-style', '@starting-style{.a{opacity:0}}'],
  [':modal', '.a:modal{color:red}'],
  ['linear-gradient(', '.a{background:linear-gradient(red,blue)}'],
  ['radial-gradient(', '.a{background:radial-gradient(red,blue)}'],
  ['conic-gradient(', '.a{background:conic-gradient(red,blue)}'],
  ['repeating-linear-gradient(', '.a{background:repeating-linear-gradient(red,blue 4px)}'],
  ['nesting', '.a{color:red;.b{color:blue}}'],
  ['nesting', '.a{&:hover{color:blue}}'],
  ['nested at-rule', '.a{@media (min-width:1px){color:blue}}'],
]

const allowed: readonly (readonly [string, string])[] = [
  ['linear in a font name', '.a{font-family:Linear Sans,sans-serif}'],
  ['linear timing keyword', '.a{transition:opacity 100ms linear}'],
  ['blur in a string', '.a::after{content:"blur(3px)"}'],
  ['blur in a single-quoted string', ".a::after{content:'filter: blur(3px)'}"],
  ['blur in a url', '.a{background:url(data:image/svg+xml;utf8,<svg filter="blur(2)"/>)}'],
  ['gradient in a url', '.a{background:url("img/linear-gradient(x).png")}'],
  ['custom property named scale', ':root{--scale:1;--translate:2px}'],
  ['transform functions', '.a{transform:translate(1px,2px) rotate(3deg) scale(1.1)}'],
  ['font-size-adjust', '.a{font-size-adjust:0.5}'],
  ['at-rules that wrap rules', '@media (min-width:1px){.a{color:red}}@supports (display:grid){.b{color:blue}}'],
  ['keyframes', '@keyframes spin{from{opacity:0}50%{opacity:.5}to{opacity:1}}'],
  ['media inside supports', '@supports (display:grid){@media (min-width:1px){.a{color:red}}}'],
  ['font-face', '@font-face{font-family:Foo;src:url(a.woff2)}'],
  ['comment mentioning a rule', '/* :has( and blur( */.a{color:red}'],
  ['sine word', '.casing{color:red}.dosin{color:red}'],
  ['dvh-like class', '.dvh{color:red}'],
]

describe('tools/css-guard', () => {
  it.each(forbidden)('rejects %s', (name, css) => {
    expect(scanCss(css).length).toBeGreaterThan(0)
  })

  it.each(allowed)('accepts %s', (_name, css) => {
    expect(scanCss(css)).toEqual([])
  })

  it('strips strings, urls and comments before scanning', () => {
    const stripped = stripCss('/* x */.a{content:"blur(";background:url( "a(b" )}')
    expect(stripped).not.toContain('blur')
    expect(stripped).not.toContain('a(b')
    expect(stripped).toContain('url()')
  })

  it('ignores escaped quotes inside strings', () => {
    expect(scanCss('.a::after{content:"say \\" blur(1)"}')).toEqual([])
  })

  it('names the rule in each finding', () => {
    expect(scanCss('.a{backdrop-filter:none}')).toContain('backdrop-filter')
  })

  it('runs from the command line over a folder and exits 1 on a finding', () => {
    const dir = mkdtempSync(join(tmpdir(), 'omk-css-guard-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'assets', 'ok.css'), '.a{color:red}')
    const script = join(process.cwd(), 'tools/css-guard.mjs')
    expect(spawnSync('node', [script, join(dir, 'assets')]).status).toBe(0)
    writeFileSync(join(dir, 'assets', 'bad.css'), '.a{filter:blur(1px)}')
    const run = spawnSync('node', [script, join(dir, 'assets')], { encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('bad.css')
  })

  it('fails when the folder does not exist', () => {
    expect(spawnSync('node', [join(process.cwd(), 'tools/css-guard.mjs'), '/nonexistent-omk']).status).toBe(1)
  })

  it('passes on a folder without css, as long as the folder exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'omk-css-guard-empty-'))
    expect(spawnSync('node', [join(process.cwd(), 'tools/css-guard.mjs'), dir]).status).toBe(0)
  })
})
